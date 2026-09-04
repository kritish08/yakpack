import { createClient } from '@/lib/supabase/server'
import { localToday } from '@/lib/local-date'
import { requireTripContext } from '@/lib/trip'
import { stripJoin } from '@/lib/pack'
import type { Database } from '@/lib/database.types'
import type { WeatherData } from '@/lib/weather'

export type Leg = Database['public']['Tables']['itinerary']['Row']
export type Item = Database['public']['Tables']['items']['Row']

export async function getTodayData() {
  // requireTripContext, not getTripContext: a layout and its page render
  // concurrently in the App Router, so a user with no trip must be sent to
  // onboarding from here as well as from the layout — otherwise this throws
  // NO_TRIP and the route 500s before the layout's redirect lands.
  const ctx = await requireTripContext()
  const supabase = await createClient()

  const today = await localToday()

  const [legsRes, itemsRes, packedRes] = await Promise.all([
    supabase.from('itinerary').select('*').eq('trip_id', ctx.tripId).order('day'),
    supabase.from('items').select('*').eq('trip_id', ctx.tripId),
    supabase
      .from('packed')
      .select('item_id, user_key, packed, packed_at, items!inner(trip_id)')
      .eq('items.trip_id', ctx.tripId),
  ])

  const legs  = (legsRes.data  ?? []) as Leg[]
  const items = (itemsRes.data ?? []) as Item[]

  // Count an item packed only from THIS member's perspective: their own rows
  // plus shared ones. Without the filter an item reads as packed when either
  // person has packed it.
  const myKeys = new Set<string>([ctx.memberKey, 'shared'])
  const packedIds = new Set(
    stripJoin(packedRes.data)
      .filter(r => myKeys.has(r.user_key))
      .map(r => r.item_id),
  )

  // Before departure show Day 1 as a preview; after the trip show the last day.
  const todayLeg: Leg | undefined =
    legs.find(l => l.date === today) ??
    (today < (legs[0]?.date ?? '') ? legs[0] : legs[legs.length - 1]) ??
    legs[0]

  const isToday  = todayLeg?.date === today
  const isFuture = todayLeg?.date ? today < todayLeg.date : false
  const isPast   = todayLeg?.date ? today > todayLeg.date : false

  return { todayLeg, legs, items, ctx, packedIds, isToday, isFuture, isPast }
}

// Calls Open-Meteo directly — avoids SSRF from trusting the Host header to build
// an internal URL. The /api/weather route exists for client-side fetches.
export async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', String(lat))
    url.searchParams.set('longitude', String(lon))
    url.searchParams.set('current', 'temperature_2m,weather_code,apparent_temperature,wind_speed_10m')
    url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max')
    url.searchParams.set('timezone', 'Asia/Kolkata')
    url.searchParams.set('forecast_days', '1')

    const res = await fetch(url.toString(), { next: { revalidate: 1800 } })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
