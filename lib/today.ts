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

export async function fetchWeather(lat: number, lon: number, baseUrl: string): Promise<WeatherData | null> {
  try {
    const res = await fetch(`${baseUrl}/api/weather?lat=${lat}&lon=${lon}`, {
      next: { revalidate: 1800 },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
