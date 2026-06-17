'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function markAsBought(itemId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('items')
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
  const { error } = await supabase.from('items').insert({
    ...data,
    status: 'to_buy',
    scope: data.assigned_to === 'shared' ? 'shared' : 'each',
    carry_tags: [],
    is_custom: true,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/to-buy')
  revalidatePath('/pack')
}
