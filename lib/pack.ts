import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'

export type Category = Database['public']['Tables']['categories']['Row']
export type Item = Database['public']['Tables']['items']['Row']
export type Packed = Database['public']['Tables']['packed']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']

export type CategoryWithItems = Category & { items: Item[] }

export async function getPackData() {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const [profileRes, categoriesRes, itemsRes, packedRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('items').select('*').order('sort_order'),
    supabase.from('packed').select('*'),
  ])

  const profile = profileRes.data!
  const categories = categoriesRes.data ?? []
  const items = itemsRes.data ?? []
  const packed = packedRes.data ?? []

  const categoriesWithItems: CategoryWithItems[] = (categories as Category[]).map(cat => ({
    id: cat.id,
    name: cat.name,
    icon: cat.icon,
    sort_order: cat.sort_order,
    items: (items as Item[]).filter(i => i.category_id === cat.id),
  }))

  return { profile, categoriesWithItems, packed }
}
