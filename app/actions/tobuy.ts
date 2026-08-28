'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getWritableTripId } from '@/lib/trip'
import { sanitizeText } from '@/lib/sanitize'
import type { AssignedTo } from '@/lib/database.types'

function revalidateLists() {
  revalidatePath('/app/to-buy')
  revalidatePath('/app/pack')
}

export async function markAsBought(itemId: string) {
  const supabase = await createClient()
  await getWritableTripId()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('items') as any)
    .update({ status: 'owned' })
    .eq('id', itemId)
  if (error) throw new Error(error.message)
  revalidateLists()
}

export async function addToBuyItem(data: {
  category_id: number
  name: string
  qty?: string
  note?: string
  assigned_to: AssignedTo
}) {
  const supabase = await createClient()
  const { tripId } = await getWritableTripId()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('items') as any).insert({
    trip_id: tripId,
    category_id: data.category_id,
    name: sanitizeText(data.name),
    qty: data.qty ?? null,
    note: data.note != null ? sanitizeText(data.note, 500) : null,
    assigned_to: data.assigned_to,
    status: 'to_buy',
    scope: data.assigned_to === 'shared' ? 'shared' : 'each',
    carry_tags: [],
  })
  if (error) throw new Error(error.message)
  revalidateLists()
}
