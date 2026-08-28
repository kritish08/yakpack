'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getWritableTripId } from '@/lib/trip'
import { sanitizeText } from '@/lib/sanitize'

function revalidateLists() {
  revalidatePath('/app/to-buy')
  revalidatePath('/app/pack')
}

export async function addCategory(data: { name: string; icon?: string }) {
  const supabase = await createClient()
  const { tripId } = await getWritableTripId()

  // sort_order continues this trip's sequence, not the global one.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxRes } = await (supabase as any)
    .from('categories')
    .select('sort_order')
    .eq('trip_id', tripId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { sort_order: number } | null }
  const sort_order = (maxRes?.sort_order ?? 0) + 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('categories').insert({
    trip_id: tripId,
    name: sanitizeText(data.name, 60),
    icon: data.icon ? sanitizeText(data.icon, 8) || null : null,
    sort_order,
  })
  if (error) throw new Error((error as { message: string }).message)
  revalidateLists()
}

export async function updateCategory(id: number, data: { name?: string; icon?: string | null }) {
  const supabase = await createClient()
  await getWritableTripId()
  const payload = {
    ...(data.name !== undefined ? { name: sanitizeText(data.name, 60) } : {}),
    ...(data.icon !== undefined ? { icon: data.icon ? sanitizeText(data.icon, 8) || null : null } : {}),
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('categories').update(payload).eq('id', id)
  if (error) throw new Error((error as { message: string }).message)
  revalidateLists()
}

export async function deleteCategory(id: number): Promise<void> {
  const supabase = await createClient()
  await getWritableTripId()
  const { count } = await supabase
    .from('items')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)
  if (count && count > 0) {
    throw new Error(`This category has ${count} item${count > 1 ? 's' : ''} — move or delete them first.`)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('categories').delete().eq('id', id)
  if (error) throw new Error((error as { message: string }).message)
  revalidateLists()
}
