import { createClient } from '@/lib/supabase/server'
import { getTripContacts, ensureTripContext } from '@/lib/trip'
import type { Database } from '@/lib/database.types'

export type Leg = Database['public']['Tables']['itinerary']['Row']
export type Trip = Database['public']['Tables']['trips']['Row']

export interface LegWeather {
  temp_max: number
  temp_min: number
  rain_pct: number
  uv:       number
}

export async function getPlanData() {
  // ensureTripContext, not getTripContext: a layout and its page render
  // concurrently in the App Router, so the layout's bootstrap has not
  // necessarily finished when this runs. A user whose signup and first session
  // were separated by email confirmation would otherwise get a 500 on their very
  // first visit, and only a reload would fix it. The RPC is idempotent, so
  // whichever of the two gets there first wins.
  const ctx = await ensureTripContext()
  const supabase = await createClient()

  const [legsRes, contacts] = await Promise.all([
    supabase.from('itinerary').select('*').eq('trip_id', ctx.tripId).order('day'),
    getTripContacts(ctx.tripId),
  ])

  const legs = (legsRes.data ?? []) as Leg[]
  const today = new Date().toISOString().slice(0, 10)

  return { legs, contacts, trip: ctx.trip, ctx, today }
}
