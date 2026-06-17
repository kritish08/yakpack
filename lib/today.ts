import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'
import type { WeatherData } from '@/lib/weather'

export type Leg = Database['public']['Tables']['itinerary']['Row']
export type Item = Database['public']['Tables']['items']['Row']

export async function getTodayData() {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const today = new Date().toISOString().slice(0, 10)

  const [legsRes, itemsRes, profileRes] = await Promise.all([
    supabase.from('itinerary').select('*').order('day'),
    supabase.from('items').select('*'),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
  ])

  const legs = (legsRes.data ?? []) as Leg[]
  const items = (itemsRes.data ?? []) as Item[]
  const profile = profileRes.data!

  // Find today's leg; if before trip show Day 1 preview; if after trip show last day
  const todayLeg: Leg | undefined =
    legs.find(l => l.date === today) ??
    (today < (legs[0]?.date ?? '') ? legs[0] : legs[legs.length - 1]) ??
    legs[0]

  const isToday = todayLeg?.date === today
  const isFuture = todayLeg?.date ? today < todayLeg.date : false
  const isPast = todayLeg?.date ? today > todayLeg.date : false

  return { todayLeg, legs, items, profile, isToday, isFuture, isPast }
}

// Calls Open-Meteo directly — avoids SSRF from trusting Host header to build an internal URL.
// The /api/weather route handler exists for client-side fetches; server components skip it.
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
