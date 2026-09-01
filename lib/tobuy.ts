import { createClient } from '@/lib/supabase/server'
import { ensureTripContext } from '@/lib/trip'
import { stripJoin } from '@/lib/pack'
import type { Database } from '@/lib/database.types'

export type Item = Database['public']['Tables']['items']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type Packed = Database['public']['Tables']['packed']['Row']
export type Trip = Database['public']['Tables']['trips']['Row']

export type CategoryWithToBuy = Category & { items: Item[] }

export async function getToBuyData() {
  // ensureTripContext, not getTripContext: a layout and its page render
  // concurrently in the App Router, so the layout's bootstrap has not
  // necessarily finished when this runs. A user whose signup and first session
  // were separated by email confirmation would otherwise get a 500 on their very
  // first visit, and only a reload would fix it. The RPC is idempotent, so
  // whichever of the two gets there first wins.
  const ctx = await ensureTripContext()
  const supabase = await createClient()

  const [categoriesRes, allItemsRes, packedRes] = await Promise.all([
    supabase.from('categories').select('*').eq('trip_id', ctx.tripId).order('sort_order'),
    supabase.from('items').select('*').eq('trip_id', ctx.tripId).order('sort_order'),
    supabase
      .from('packed')
      .select('item_id, user_key, packed, packed_at, items!inner(trip_id)')
      .eq('items.trip_id', ctx.tripId),
  ])

  const categories = (categoriesRes.data ?? []) as Category[]
  const allItems = (allItemsRes.data ?? []) as Item[]
  // Derive the to-buy subset locally — avoids a second full table scan.
  const toBuyItems = allItems.filter(i => i.status === 'to_buy')
  const packed = stripJoin(packedRes.data)

  const categoriesWithToBuy: CategoryWithToBuy[] = categories
    .map(cat => ({ ...cat, items: toBuyItems.filter(i => i.category_id === cat.id) }))
    .filter(cat => cat.items.length > 0)

  const today = new Date().toISOString().slice(0, 10)

  return { ctx, categories, allItems, categoriesWithToBuy, packed, trip: ctx.trip, today }
}
