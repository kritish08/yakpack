import { describe, it, expect, beforeEach, vi } from 'vitest'

/** A localStorage the outbox can be exercised against. */
const store = new Map<string, string>()
;(globalThis as Record<string, unknown>).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
  },
}

const { readQueue, enqueueOp, clearQueue, applyOps, applyStatusOps, flushQueue } =
  await import('@/lib/offline-queue')

beforeEach(() => { store.clear() })

/**
 * The outbox is what makes a check-off on a mountain road survive. It only ever
 * runs when something has already gone wrong, so it is exactly the code least
 * likely to be exercised by hand.
 */
describe('enqueueOp — packed', () => {
  it('cancels an op against its inverse', () => {
    enqueueOp({ op: 'insert', item_id: 'x', user_key: 'organiser' })
    enqueueOp({ op: 'delete', item_id: 'x', user_key: 'organiser' })
    expect(readQueue()).toHaveLength(0)
  })
  it('collapses duplicates', () => {
    enqueueOp({ op: 'insert', item_id: 'y', user_key: 'shared' })
    enqueueOp({ op: 'insert', item_id: 'y', user_key: 'shared' })
    expect(readQueue()).toHaveLength(1)
  })
  it('keeps ops for different people on the same item', () => {
    enqueueOp({ op: 'insert', item_id: 'z', user_key: 'organiser' })
    enqueueOp({ op: 'insert', item_id: 'z', user_key: 'partner_3' })
    expect(readQueue()).toHaveLength(2)
  })
})

describe('enqueueOp — status', () => {
  it('collapses to the most recent value, because only the last is true', () => {
    enqueueOp({ kind: 'status', item_id: 'a', status: 'owned' })
    enqueueOp({ kind: 'status', item_id: 'a', status: 'standard' })
    enqueueOp({ kind: 'status', item_id: 'a', status: 'owned' })
    const q = readQueue()
    expect(q).toHaveLength(1)
    expect((q[0] as { status: string }).status).toBe('owned')
  })
  it('does not disturb a packed op for the same item', () => {
    enqueueOp({ op: 'insert', item_id: 'b', user_key: 'shared' })
    enqueueOp({ kind: 'status', item_id: 'b', status: 'owned' })
    expect(readQueue()).toHaveLength(2)
  })
})

describe('readQueue — durability', () => {
  it('drains the superseded storage key rather than stranding it', () => {
    // Someone who queued check-offs offline and then took an app update would
    // otherwise watch them vanish — the exact failure the outbox prevents.
    store.set('yakpack:packed-outbox:v1', JSON.stringify([
      { op: 'insert', item_id: 'old', user_key: 'organiser' },
    ]))
    expect(readQueue()).toHaveLength(1)
    expect(store.get('yakpack:packed-outbox:v1')).toBeUndefined()
    expect(readQueue()).toHaveLength(1)
  })
  it('reads corrupt storage as empty instead of throwing into the UI', () => {
    store.set('yakpack:outbox:v2', '{not json')
    expect(readQueue()).toEqual([])
  })
  it('rejects entries with an unknown status or user_key', () => {
    store.set('yakpack:outbox:v2', JSON.stringify([
      { kind: 'status', item_id: 'a', status: 'nonsense' },
      { op: 'insert', item_id: 'b', user_key: 'partner_9' },
    ]))
    expect(readQueue()).toEqual([])
  })
  it('accepts partner_3 — a slot added after the validator was written', () => {
    // This list silently drops ops it does not recognise, so widening the trip
    // without widening it here would discard a fourth traveller's progress.
    enqueueOp({ op: 'insert', item_id: 'c', user_key: 'partner_3' })
    expect(readQueue()).toHaveLength(1)
  })
})

describe('projections over cached pages', () => {
  it('applyOps replays packed toggles', () => {
    const rows = applyOps([], [{ op: 'insert', item_id: 'i', user_key: 'shared' }])
    expect(rows).toHaveLength(1)
    expect(rows[0].packed).toBe(true)
  })
  it('applyOps ignores status ops', () => {
    expect(applyOps([], [{ kind: 'status', item_id: 'i', status: 'owned' }])).toHaveLength(0)
  })
  it('applyStatusOps marks bought items without mutating the input', () => {
    const items = [{ id: 'i1', status: 'to_buy' as const }, { id: 'i2', status: 'to_buy' as const }]
    const out = applyStatusOps(items, [{ kind: 'status', item_id: 'i1', status: 'owned' }])
    expect(out[0].status).toBe('owned')
    expect(out[1].status).toBe('to_buy')
    expect(items[0].status).toBe('to_buy')
  })
})

describe('flushQueue', () => {
  it('writes both kinds and keeps only what failed', async () => {
    enqueueOp({ kind: 'status', item_id: 'ok', status: 'owned' })
    enqueueOp({ kind: 'status', item_id: 'bad', status: 'owned' })
    enqueueOp({ op: 'insert', item_id: 'p', user_key: 'shared' })

    const calls: string[] = []
    const client = {
      from(table: string) {
        return {
          update: (v: Record<string, unknown>) => ({
            eq: (_c: string, id: string) => {
              calls.push(`${table}.update:${id}`)
              return Promise.resolve({ error: id === 'bad' ? { message: 'boom' } : null })
            },
          }),
          upsert: () => { calls.push('packed.upsert'); return Promise.resolve({ error: null }) },
          delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
        }
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flushed = await flushQueue(client as any)
    expect(flushed).toBe(2)
    expect(calls).toContain('packed.upsert')
    const left = readQueue()
    expect(left).toHaveLength(1)
    expect(left[0].item_id).toBe('bad')
  })

  it('keeps everything when the network throws mid-replay', async () => {
    clearQueue()
    enqueueOp({ kind: 'status', item_id: 'a', status: 'owned' })
    const client = { from: () => ({ update: () => ({ eq: () => { throw new TypeError('offline') } }) }) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await flushQueue(client as any)).toBe(0)
    expect(readQueue()).toHaveLength(1)
  })

  it('is a no-op on an empty queue', async () => {
    clearQueue()
    const spy = vi.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await flushQueue({ from: spy } as any)).toBe(0)
    expect(spy).not.toHaveBeenCalled()
  })
})
