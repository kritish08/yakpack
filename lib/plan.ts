import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'

export type Leg = Database['public']['Tables']['itinerary']['Row']
export type Trip = Database['public']['Tables']['trip']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']

export interface LegWeather {
  temp_max: number
  temp_min: number
  rain_pct: number
  uv:       number
}

export async function getPlanData() {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const [legsRes, tripRes, profileRes] = await Promise.all([
    supabase.from('itinerary').select('*').order('day'),
    supabase.from('trip').select('*').eq('id', 1).single(),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
  ])

  const legs = (legsRes.data ?? []) as Leg[]
  const trip = tripRes.data as Trip | null
  const profile = profileRes.data!

  const today = new Date().toISOString().slice(0, 10)

  return { legs, trip, profile, today }
}

