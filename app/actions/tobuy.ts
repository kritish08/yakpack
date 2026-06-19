'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function markAsBought(itemId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('items') as any)
    .update({ status: 'owned' })
    .eq('id', itemId)
  if (error) throw new Error(error.message)
  revalidatePath('/to-buy')
  revalidatePath('/pack')
}

export async function addToBuyItem(data: {
  category_id: number
  name: string
  qty?: string
  note?: string
  assigned_to: 'kritish' | 'partner' | 'shared'
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('items') as any).insert({
    category_id: data.category_id,
    name: data.name,
    qty: data.qty ?? null,
    note: data.note ?? null,
    assigned_to: data.assigned_to,
    status: 'to_buy',
    scope: data.assigned_to === 'shared' ? 'shared' : 'each',
    carry_tags: [],
  })
  if (error) throw new Error(error.message)
  revalidatePath('/to-buy')
  revalidatePath('/pack')
}
