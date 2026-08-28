'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getWritableTripId } from '@/lib/trip'
import type { AssignedTo, ItemScope, ItemStatus, TablesInsert, TablesUpdate } from '@/lib/database.types'
import { sanitizeText as sanitizeName } from '@/lib/sanitize'

function revalidateLists() {
  revalidatePath('/app/pack')
  revalidatePath('/app/to-buy')
}

export async function addItem(data: {
  category_id: number
  name: string
  qty?: string
  note?: string
  status: ItemStatus
  assigned_to: AssignedTo
  scope: ItemScope
}) {
  const supabase = await createClient()
  // trip_id is resolved from the session, never accepted from the caller — a
  // crafted request must not be able to name someone else's trip. RLS refuses it
  // regardless; this makes it a bug rather than an attack surface.
  const { tripId } = await getWritableTripId()

  const payload: TablesInsert<'items'> = {
    ...data,
    trip_id: tripId,
    name: sanitizeName(data.name),
    note: data.note != null ? sanitizeName(data.note, 500) : data.note,
    carry_tags: [],
    is_custom: true,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('items') as any).insert(payload)
  if (error) throw new Error(error.message)
  revalidateLists()
}

export async function updateItem(id: string, data: {
  name?: string
  qty?: string | null
  note?: string | null
  status?: ItemStatus
  assigned_to?: AssignedTo
  scope?: ItemScope
  category_id?: number
}) {
  const supabase = await createClient()
  const { memberKey } = await getWritableTripId()

  const payload: TablesUpdate<'items'> = {
    ...data,
    ...(data.name != null ? { name: sanitizeName(data.name) } : {}),
    ...(data.note != null ? { note: sanitizeName(data.note, 500) } : {}),
  }

  // Read the current scope first so packed rows are only reconciled when it
  // actually changes.
  let currentScope: ItemScope | null = null
  if (data.scope != null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('items') as any)
      .select('scope')
      .eq('id', id)
      .single() as { data: { scope: ItemScope } | null }
    currentScope = existing?.scope ?? null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('items') as any).update(payload).eq('id', id)
  if (error) throw new Error(error.message)

  // 'each' → one packed row per member; 'shared' → a single shared row.
  // Existing packed state resets, which is the honest outcome: the rows it
  // described no longer exist.
  if (data.scope != null && currentScope != null && data.scope !== currentScope) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('packed') as any).delete().eq('item_id', id)
    // Only this member's row is pre-created; the others appear when those people
    // first tap the item. "No row" already means "not packed".
    const rows =
      data.scope === 'each'
        ? [{ item_id: id, user_key: memberKey, packed: false }]
        : [{ item_id: id, user_key: 'shared', packed: false }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: packErr } = await (supabase.from('packed') as any).insert(rows)
    if (packErr) throw new Error(packErr.message)
  }

  revalidateLists()
}

/**
 * Take an item off the shopping list without deleting it: status becomes
 * 'standard' so it leaves Summary but stays in the pack.
 */
export async function removeFromShopping(id: string) {
  const supabase = await createClient()
  await getWritableTripId()

  const payload: TablesUpdate<'items'> = { status: 'standard' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('items') as any).update(payload).eq('id', id)
  if (error) throw new Error(error.message)
  revalidateLists()
}

export async function deleteItem(id: string) {
  const supabase = await createClient()
  await getWritableTripId()

  await supabase.from('packed').delete().eq('item_id', id)
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidateLists()
}
