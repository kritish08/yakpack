'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TablesInsert, TablesUpdate } from '@/lib/database.types'
import { sanitizeText as sanitizeName } from '@/lib/sanitize'

export async function addItem(data: {
  category_id: number
  name: string
  qty?: string
  note?: string
  status: 'owned' | 'to_buy' | 'standard'
  assigned_to: 'kritish' | 'partner' | 'shared'
  scope: 'each' | 'shared'
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const payload: TablesInsert<'items'> = {
    ...data,
    name: sanitizeName(data.name),
    note: data.note != null ? sanitizeName(data.note, 500) : data.note,
    carry_tags: [],
    is_custom: true,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('items') as any).insert(payload)
  if (error) throw new Error(error.message)
  revalidatePath('/pack')
  revalidatePath('/to-buy')
}

export async function updateItem(id: string, data: {
  name?: string
  qty?: string | null
  note?: string | null
  status?: 'owned' | 'to_buy' | 'standard'
  assigned_to?: 'kritish' | 'partner' | 'shared'
  scope?: 'each' | 'shared'
  category_id?: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const payload: TablesUpdate<'items'> = {
    ...data,
    ...(data.name != null ? { name: sanitizeName(data.name) } : {}),
    ...(data.note != null ? { note: sanitizeName(data.note, 500) } : {}),
  }

  // If scope is changing, read the current scope first so we only reconcile
  // packed rows when it actually differs.
  let currentScope: 'each' | 'shared' | null = null
  if (data.scope != null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('items') as any)
      .select('scope')
      .eq('id', id)
      .single() as { data: { scope: 'each' | 'shared' } | null }
    currentScope = existing?.scope ?? null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('items') as any).update(payload).eq('id', id)
  if (error) throw new Error(error.message)

  // Reconcile packed rows when scope actually changed: 'each' → two per-person
  // rows; 'shared' → one shared row. Existing packed state is reset to false.
  if (data.scope != null && currentScope != null && data.scope !== currentScope) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('packed') as any).delete().eq('item_id', id)
    const rows =
      data.scope === 'each'
        ? [
            { item_id: id, user_key: 'kritish', packed: false },
            { item_id: id, user_key: 'partner', packed: false },
          ]
        : [{ item_id: id, user_key: 'shared', packed: false }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: packErr } = await (supabase.from('packed') as any).insert(rows)
    if (packErr) throw new Error(packErr.message)
  }

  revalidatePath('/pack')
  revalidatePath('/to-buy')
}

/**
 * Remove an item from the "to buy" shopping view WITHOUT deleting it.
 * Sets status to 'standard' so it leaves the shopping list but remains in Pack.
 */
export async function removeFromShopping(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const payload: TablesUpdate<'items'> = { status: 'standard' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('items') as any).update(payload).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/pack')
  revalidatePath('/to-buy')
}

export async function deleteItem(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await supabase.from('packed').delete().eq('item_id', id)
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/pack')
  revalidatePath('/to-buy')
}
