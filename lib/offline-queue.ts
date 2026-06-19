// Client-side offline write outbox for `packed` toggles.
//
// When a packed toggle is made with no network, the mutation is queued in
// localStorage so it isn't lost on reload. The queue is replayed against
// Supabase on mount and whenever the browser fires the `online` event.
//
// Dependency-free and defensive: every read/parse is guarded so a corrupt
// or unavailable localStorage never throws into the UI.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

export type PackedOp = {
  op: 'insert' | 'delete'
  item_id: string
  user_key: string
}

const STORAGE_KEY = 'yakpack:packed-outbox:v1'

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage
  } catch {
    return false
  }
}

/** Read the queued ops. Always returns an array, never throws. */
export function readQueue(): PackedOp[] {
  if (!hasStorage()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (o): o is PackedOp =>
        o &&
        (o.op === 'insert' || o.op === 'delete') &&
        typeof o.item_id === 'string' &&
        typeof o.user_key === 'string',
    )
  } catch {
    return []
  }
}

function writeQueue(ops: PackedOp[]): void {
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
 * Enqueue a packed mutation. De-dupes opposing ops: if the queue already holds
 * the inverse op for the same (item_id, user_key), the two cancel out and the
 * existing op is removed instead of appending. A repeat of the same op collapses
 * to a single entry.
 */
export function enqueueOp(op: PackedOp): void {
  const queue = readQueue()
  const inverse: PackedOp['op'] = op.op === 'insert' ? 'delete' : 'insert'

  const inverseIdx = queue.findIndex(
    q => q.item_id === op.item_id && q.user_key === op.user_key && q.op === inverse,
  )
  if (inverseIdx !== -1) {
    // insert then delete (or vice versa) of the same row → no-op.
    queue.splice(inverseIdx, 1)
    writeQueue(queue)
    return
  }

  const sameIdx = queue.findIndex(
    q => q.item_id === op.item_id && q.user_key === op.user_key && q.op === op.op,
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
 * Replay queued ops against Supabase. Successful ops are removed from the queue;
 * ops that fail (still offline / transient error) are kept for the next flush.
 * Returns the number of ops successfully flushed.
 */
export async function flushQueue(supabase: Client): Promise<number> {
  const queue = readQueue()
  if (queue.length === 0) return 0

  const remaining: PackedOp[] = []
  let flushed = 0

  for (const op of queue) {
    try {
      if (op.op === 'delete') {
        const { error } = await supabase
          .from('packed')
          .delete()
          .eq('item_id', op.item_id)
          .eq('user_key', op.user_key)
        if (error) {
          remaining.push(op)
          continue
        }
      } else {
        const { error } = await supabase
          .from('packed')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .upsert({ item_id: op.item_id, user_key: op.user_key, packed: true } as any, {
            onConflict: 'item_id,user_key',
          })
        if (error) {
          remaining.push(op)
          continue
        }
      }
      flushed++
    } catch {
      // Network failure mid-replay — keep this op and bail on the rest so we
      // don't hammer a dead connection.
      remaining.push(op)
    }
  }

  writeQueue(remaining)
  return flushed
}
