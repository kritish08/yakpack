import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'

export type Item = Database['public']['Tables']['items']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type Packed = Database['public']['Tables']['packed']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Trip = Database['public']['Tables']['trip']['Row']

export type CategoryWithToBuy = Category & { items: Item[] }

export async function getToBuyData() {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const [profileRes, categoriesRes, allItemsRes, toBuyItemsRes, packedRes, tripRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('items').select('*').order('sort_order'),
    supabase.from('items').select('*').eq('status', 'to_buy').order('sort_order'),
    supabase.from('packed').select('*'),
    supabase.from('trip').select('*').eq('id', 1).single(),
  ])

  const profile = profileRes.data!
  const categories = (categoriesRes.data ?? []) as Category[]
  const allItems = (allItemsRes.data ?? []) as Item[]
  const toBuyItems = (toBuyItemsRes.data ?? []) as Item[]
  const packed = (packedRes.data ?? []) as Packed[]
  const trip = tripRes.data as Trip | null

  const categoriesWithToBuy: CategoryWithToBuy[] = categories
    .map(cat => ({ ...cat, items: toBuyItems.filter(i => i.category_id === cat.id) }))
    .filter(cat => cat.items.length > 0)

  const today = new Date().toISOString().slice(0, 10)

  return { profile, categories, allItems, categoriesWithToBuy, packed, trip, today }
}
