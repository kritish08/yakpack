import { createClient } from '@/lib/supabase/server'
import { getTripContacts, getTripContext } from '@/lib/trip'
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
  const ctx = await getTripContext()
  const supabase = await createClient()

  const [legsRes, contacts] = await Promise.all([
    supabase.from('itinerary').select('*').eq('trip_id', ctx.tripId).order('day'),
    getTripContacts(ctx.tripId),
  ])

  const legs = (legsRes.data ?? []) as Leg[]
  const today = new Date().toISOString().slice(0, 10)

  return { legs, contacts, trip: ctx.trip, ctx, today }
}
