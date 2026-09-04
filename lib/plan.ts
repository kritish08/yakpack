import { createClient } from '@/lib/supabase/server'
import { getTripContacts, requireTripContext } from '@/lib/trip'
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
  // requireTripContext, not getTripContext: a layout and its page render
  // concurrently in the App Router, so a user with no trip must be sent to
  // onboarding from here as well as from the layout — otherwise this throws
  // NO_TRIP and the route 500s before the layout's redirect lands.
  const ctx = await requireTripContext()
  const supabase = await createClient()

  const [legsRes, contacts] = await Promise.all([
    supabase.from('itinerary').select('*').eq('trip_id', ctx.tripId).order('day'),
    getTripContacts(ctx.tripId),
  ])

  const legs = (legsRes.data ?? []) as Leg[]
  const today = new Date().toISOString().slice(0, 10)

  return { legs, contacts, trip: ctx.trip, ctx, today }
}
