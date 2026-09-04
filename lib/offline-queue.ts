// Client-side offline write outbox.
//
// Two kinds of mutation are queued when there is no network, so neither is lost
// on reload:
//
//   packed — checking something off on Pack.
//   status — marking something bought on Summary.
//
// The second was missing for a long time, and its absence was the sharper gap:
// Summary is used standing in a shop, which is exactly where signal is worst,
// and a failed write there did not merely fail — the optimistic update was
// rolled back, so the item you had just bought reappeared on your list.
//
// The queue replays against Supabase on mount and on the browser's `online`
// event. Both tables allow a trip member to write directly under RLS, which is
// what lets the replay happen from the client at all; server actions are POSTs
// and cannot be queued.
//
// Dependency-free and defensive: every read/parse is guarded so a corrupt
// or unavailable localStorage never throws into the UI.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AssignedTo, Database, ItemStatus } from '@/lib/database.types'

type Packed = Database['public']['Tables']['packed']['Row']

export type PackedOp = {
  kind?: 'packed'
  op: 'insert' | 'delete'
  item_id: string
  user_key: AssignedTo
}

/** A change to an item's status — "bought", or put back on the list. */
export type StatusOp = {
  kind: 'status'
  item_id: string
  status: ItemStatus
}

export type Op = PackedOp | StatusOp

export const isStatusOp = (o: Op): o is StatusOp => o.kind === 'status'
export const isPackedOp = (o: Op): o is PackedOp => o.kind !== 'status'

const STORAGE_KEY = 'yakpack:outbox:v2'
/** Superseded key, drained once on first read so nothing queued is stranded. */
const LEGACY_KEY = 'yakpack:packed-outbox:v1'

const STATUSES: ItemStatus[] = ['owned', 'to_buy', 'standard']
const USER_KEYS: AssignedTo[] = ['organiser', 'partner_1', 'partner_2', 'shared']

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage
  } catch {
    return false
  }
}

function parseOps(raw: string | null): Op[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((o): o is Op => {
      if (!o || typeof o.item_id !== 'string') return false
      if (o.kind === 'status') return STATUSES.includes(o.status)
      return (o.op === 'insert' || o.op === 'delete') && USER_KEYS.includes(o.user_key)
    })
  } catch {
    return []
  }
}

/** Read the queued ops. Always returns an array, never throws. */
export function readQueue(): Op[] {
  if (!hasStorage()) return []
  try {
    const current = parseOps(window.localStorage.getItem(STORAGE_KEY))

    // Anything left in the previous key belongs to a session that queued
    // check-offs and then took this update. Draining it here rather than
    // ignoring it is the difference between "your toggles synced" and "your
    // toggles quietly vanished when the app updated".
    const legacyRaw = window.localStorage.getItem(LEGACY_KEY)
    if (legacyRaw) {
      const merged = [...parseOps(legacyRaw), ...current]
      window.localStorage.removeItem(LEGACY_KEY)
      writeQueue(merged)
      return merged
    }
    return current
  } catch {
    return []
  }
}

function writeQueue(ops: Op[]): void {
  if (!hasStorage()) return
  try {
    if (ops.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY)
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ops))
    }
  } catch {
    // Storage full or unavailable — drop silently rather than crash the UI.
  }
}

/**
 * Enqueue a mutation.
 *
 * Packed ops de-dupe against their inverse: an insert then a delete of the same
 * row cancel out, and a repeat collapses to one entry. Status ops collapse to
 * the most recent value for an item, because only the last one is true — three
 * taps of "bought" then "not buying" should replay as one write, not four.
 */
export function enqueueOp(op: Op): void {
  const queue = readQueue()

  if (isStatusOp(op)) {
    const rest = queue.filter(q => !(isStatusOp(q) && q.item_id === op.item_id))
    rest.push(op)
    writeQueue(rest)
    return
  }

  const inverse: PackedOp['op'] = op.op === 'insert' ? 'delete' : 'insert'

  const inverseIdx = queue.findIndex(
    q => isPackedOp(q) && q.item_id === op.item_id && q.user_key === op.user_key && q.op === inverse,
  )
  if (inverseIdx !== -1) {
    // insert then delete (or vice versa) of the same row → no-op.
    queue.splice(inverseIdx, 1)
    writeQueue(queue)
    return
  }

  const sameIdx = queue.findIndex(
    q => isPackedOp(q) && q.item_id === op.item_id && q.user_key === op.user_key && q.op === op.op,
  )
  if (sameIdx !== -1) {
    // Already queued — collapse duplicates.
    return
  }

  queue.push(op)
  writeQueue(queue)
}

export function clearQueue(): void {
  writeQueue([])
}

type Client = SupabaseClient<Database>

/**
 * Replay queued ops against Supabase.
 *
 * Successful ops are removed; ops that fail — still offline, or a transient
 * error — are kept for the next flush. Returns how many were flushed.
 */
export async function flushQueue(supabase: Client): Promise<number> {
  const queue = readQueue()
  if (queue.length === 0) return 0

  const remaining: Op[] = []
  let flushed = 0

  for (const op of queue) {
    try {
      if (isStatusOp(op)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('items') as any)
          .update({ status: op.status })
          .eq('id', op.item_id)
        if (error) { remaining.push(op); continue }
      } else if (op.op === 'delete') {
        const { error } = await supabase
          .from('packed')
          .delete()
          .eq('item_id', op.item_id)
          .eq('user_key', op.user_key)
        if (error) { remaining.push(op); continue }
      } else {
        const { error } = await supabase
          .from('packed')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .upsert({ item_id: op.item_id, user_key: op.user_key, packed: true } as any, {
            onConflict: 'item_id,user_key',
          })
        if (error) { remaining.push(op); continue }
      }
      flushed++
    } catch {
      // Network failure mid-replay — keep this op and carry on; the rest are
      // retried on the next flush rather than hammering a dead connection.
      remaining.push(op)
    }
  }

  writeQueue(remaining)
  return flushed
}

/**
 * Project the pending outbox onto a `packed` row set.
 *
 * The page HTML served from the SW's PAGE_CACHE carries the `initialPacked`
 * that was server-rendered when the page was last cached — i.e. from BEFORE any
 * offline toggles. Without replaying the outbox over it, a reload while offline
 * makes the user's offline check-offs look lost, even though they are queued and
 * will sync. Applying the queue keeps the UI honest until the flush lands.
 */
export function applyOps(rows: Packed[], ops: Op[]): Packed[] {
  const packedOps = ops.filter(isPackedOp)
  if (packedOps.length === 0) return rows
  let next = rows
  for (const op of packedOps) {
    const matches = (r: Packed) => r.item_id === op.item_id && r.user_key === op.user_key
    if (op.op === 'delete') {
      next = next.filter(r => !matches(r))
    } else if (!next.some(matches)) {
      next = [...next, {
        item_id: op.item_id,
        user_key: op.user_key,
        packed: true,
        packed_at: null,
      }]
    }
  }
  return next
}

/**
 * Project queued status changes onto a server-rendered item list.
 *
 * Same reason as applyOps. A page served from the service worker's cache carries
 * the statuses as they were when it was last cached — before anything was marked
 * bought offline. Without replaying the queue over it, a reload puts everything
 * you just bought back on the shopping list, which is precisely the moment a
 * traveller stops trusting the app.
 */
export function applyStatusOps<T extends { id: string; status: ItemStatus }>(
  items: T[],
  ops: Op[],
): T[] {
  const byId = new Map(ops.filter(isStatusOp).map(o => [o.item_id, o.status]))
  if (byId.size === 0) return items
  return items.map(i => (byId.has(i.id) ? { ...i, status: byId.get(i.id)! } : i))
}
