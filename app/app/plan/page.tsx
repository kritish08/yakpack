import { getPlanData } from '@/lib/plan'
import { AI_ENABLED } from '@/lib/ai'
import PlanScreen from '@/components/plan/plan-screen'
import type { LegWeather, Leg } from '@/lib/plan'

async function fetchLegWeather(lat: number, lon: number): Promise<LegWeather | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max&forecast_days=1&timezone=auto`
    const data = await fetch(url, { next: { revalidate: 1800 } }).then(r => r.json())
    const d = data.daily
    return {
      temp_max: Math.round(d.temperature_2m_max?.[0] ?? 0),
      temp_min: Math.round(d.temperature_2m_min?.[0] ?? 0),
      rain_pct: d.precipitation_probability_max?.[0] ?? 0,
      uv:       d.uv_index_max?.[0] ?? 0,
    }
  } catch {
    return null
  }
}

export default async function PlanPage() {
  const data = await getPlanData()
  const { legs, today } = data

  // Fetch weather for today + next 3 upcoming legs in parallel
  const upcoming = legs.filter(l => l.date && l.date >= today).slice(0, 4)
  const weatherEntries = await Promise.all(
    upcoming.map(async leg => {
      if (!leg.lat || !leg.lon) return [leg.day, null] as const
      const wx = await fetchLegWeather(leg.lat, leg.lon)
      return [leg.day, wx] as const
    })
  )
  const weatherMap: Record<number, LegWeather | null> = Object.fromEntries(weatherEntries)

  // Per-day insights are fetched client-side by DayCard so they can carry the
  // caller's own OpenAI key; there is no separate server-rendered one.
  return (
    <PlanScreen
      {...data}
      weatherMap={weatherMap}
      aiEnabled={AI_ENABLED}
      isOrganiser={data.ctx.isOrganiser}
    />
  )
}
