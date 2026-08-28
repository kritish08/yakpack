import { createClient } from '@/lib/supabase/server'
import { getTripContext } from '@/lib/trip'
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

  const { data } = await supabase
    .from('itinerary')
    .select('*')
    .eq('trip_id', ctx.tripId)
    .order('day')

  const legs = (data ?? []) as Leg[]
  const today = new Date().toISOString().slice(0, 10)

  return { legs, trip: ctx.trip, ctx, today }
}
