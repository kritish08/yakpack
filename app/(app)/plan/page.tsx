import { Suspense } from 'react'
import { getPlanData } from '@/lib/plan'
import { AI_ENABLED } from '@/lib/ai'
import PlanScreen from '@/components/plan/plan-screen'
import PlanAiInsight, { PlanAiInsightSkeleton } from '@/components/plan/plan-ai-insight'
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

// Async server component that streams Pemba's insight for today's leg
async function TodayInsightSlot({ leg, weather }: { leg: Leg; weather: LegWeather | null }) {
  return <PlanAiInsight leg={leg} weather={weather} />
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

  const todayLeg = legs.find(l => l.date === today) ?? null
  const todayWeather = todayLeg ? (weatherMap[todayLeg.day] ?? null) : null

  // Pemba's AI insight for today's leg — Suspense-streamed independently
  const todayInsightNode = AI_ENABLED && todayLeg ? (
    <Suspense fallback={<PlanAiInsightSkeleton />}>
      <TodayInsightSlot leg={todayLeg} weather={todayWeather} />
    </Suspense>
  ) : null

  return (
    <PlanScreen
      {...data}
      weatherMap={weatherMap}
      aiEnabled={AI_ENABLED}
      todayInsightNode={todayInsightNode}
    />
  )
}
