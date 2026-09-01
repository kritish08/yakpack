import { createClient } from '@/lib/supabase/server'
import { ensureTripContext, type TripContext } from '@/lib/trip'
import type { Database } from '@/lib/database.types'

export type Category = Database['public']['Tables']['categories']['Row']
export type Item = Database['public']['Tables']['items']['Row']
export type Packed = Database['public']['Tables']['packed']['Row']

export type CategoryWithItems = Category & { items: Item[] }

export async function getPackData() {
  // ensureTripContext, not getTripContext: a layout and its page render
  // concurrently in the App Router, so the layout's bootstrap has not
  // necessarily finished when this runs. A user whose signup and first session
  // were separated by email confirmation would otherwise get a 500 on their very
  // first visit, and only a reload would fix it. The RPC is idempotent, so
  // whichever of the two gets there first wins.
  const ctx = await ensureTripContext()
  const supabase = await createClient()

  const [categoriesRes, itemsRes, packedRes] = await Promise.all([
    supabase.from('categories').select('*').eq('trip_id', ctx.tripId).order('sort_order'),
    supabase.from('items').select('*').eq('trip_id', ctx.tripId).order('sort_order'),
    // `packed` carries no trip_id — it inherits scope from its item, so the
    // filter goes through an inner join rather than a column on the row.
    supabase
      .from('packed')
      .select('item_id, user_key, packed, packed_at, items!inner(trip_id)')
      .eq('items.trip_id', ctx.tripId),
  ])

  const categories = (categoriesRes.data ?? []) as Category[]
  const items = (itemsRes.data ?? []) as Item[]
  const packed = stripJoin(packedRes.data)

  const categoriesWithItems: CategoryWithItems[] = categories.map(cat => ({
    ...cat,
    items: items.filter(i => i.category_id === cat.id),
  }))

  return { ctx, categoriesWithItems, packed }
}

/** Drops the `items` join column the scoping filter needs but callers do not. */
export function stripJoin(rows: unknown): Packed[] {
  if (!Array.isArray(rows)) return []
  return rows.map(r => {
    const { item_id, user_key, packed, packed_at } = r as Packed
    return { item_id, user_key, packed, packed_at }
  })
}

export type { TripContext }
