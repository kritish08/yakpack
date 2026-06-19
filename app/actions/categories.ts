'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addCategory(data: { name: string; icon?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxRes } = await (supabase as any)
    .from('categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single() as { data: { sort_order: number } | null }
  const sort_order = (maxRes?.sort_order ?? 0) + 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('categories').insert({
    name:       data.name.trim(),
    icon:       data.icon?.trim() || null,
    sort_order,
  })
  if (error) throw new Error((error as { message: string }).message)
  revalidatePath('/to-buy')
  revalidatePath('/pack')
}

export async function updateCategory(id: number, data: { name?: string; icon?: string | null }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const payload = {
    ...(data.name !== undefined ? { name: data.name.trim() } : {}),
    ...(data.icon !== undefined ? { icon: data.icon?.trim() || null } : {}),
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('categories').update(payload).eq('id', id)
  if (error) throw new Error((error as { message: string }).message)
  revalidatePath('/to-buy')
  revalidatePath('/pack')
}

export async function deleteCategory(id: number): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
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
  revalidatePath('/to-buy')
  revalidatePath('/pack')
}
