import { createClient } from '@/lib/supabase/server'
import { localToday } from '@/lib/local-date'
import { requireTripContext } from '@/lib/trip'
import { stripJoin } from '@/lib/pack'
import type { Database } from '@/lib/database.types'

export type Item = Database['public']['Tables']['items']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type Packed = Database['public']['Tables']['packed']['Row']
export type Trip = Database['public']['Tables']['trips']['Row']

export type CategoryWithToBuy = Category & { items: Item[] }

export async function getToBuyData() {
  // requireTripContext, not getTripContext: a layout and its page render
  // concurrently in the App Router, so a user with no trip must be sent to
  // onboarding from here as well as from the layout — otherwise this throws
  // NO_TRIP and the route 500s before the layout's redirect lands.
  const ctx = await requireTripContext()
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

  const today = await localToday()

  return { ctx, categories, allItems, categoriesWithToBuy, packed, trip: ctx.trip, today }
}
