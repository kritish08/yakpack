'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TablesInsert, TablesUpdate } from '@/lib/database.types'

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
  const payload: TablesInsert<'items'> = {
    ...data,
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
  const payload: TablesUpdate<'items'> = data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('items') as any).update(payload).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/pack')
  revalidatePath('/to-buy')
}

export async function deleteItem(id: string) {
  const supabase = await createClient()
  await supabase.from('packed').delete().eq('item_id', id)
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/pack')
  revalidatePath('/to-buy')
}
