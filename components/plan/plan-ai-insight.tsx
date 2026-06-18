import { unstable_cache } from 'next/cache'
import { generateText } from 'ai'
import { getAzureModel, PEMBA_SYSTEM } from '@/lib/ai'
import type { Leg, LegWeather } from '@/lib/plan'

const generateInsight = unstable_cache(
  async (
    day: number, legName: string, altitude_m: number,
    highlights: string, warnings: string | null, weatherSummary: string,
  ): Promise<string> => {
    const prompt = `Write a 2-sentence Pemba insight for Day ${day} — ${legName} (altitude ${altitude_m}m). ${weatherSummary}. Highlights: ${highlights}. Warnings: ${warnings ?? 'none'}. Be practical and energising. No medication doses.`
    const { text } = await generateText({
      model:  getAzureModel(),
      system: PEMBA_SYSTEM,
      prompt,
    })
    return text
  },
  ['plan-day-insight'],
  { revalidate: 86400 }, // 24h — regenerates once per day
)

interface Props {
  leg:     Leg
  weather: LegWeather | null
}

export default async function PlanAiInsight({ leg, weather }: Props) {
  const weatherSummary = weather
    ? `Weather: ${weather.temp_min}–${weather.temp_max}°C, rain ${weather.rain_pct}%, UV ${weather.uv}`
    : 'Weather data unavailable'

  try {
    const text = await generateInsight(
      leg.day,
      leg.leg,
      leg.altitude_m ?? 0,
      leg.highlights ?? '',
      leg.warnings ?? null,
      weatherSummary,
    )
    return (
      <div className="px-4 py-3 flex gap-2.5 items-start border-t border-accent/15 bg-accent/3">
        <span className="text-sm shrink-0 mt-px">🐂</span>
        <p className="font-body text-sm leading-relaxed text-text/80 italic">{text}</p>
      </div>
    )
  } catch {
    return null
  }
}

export function PlanAiInsightSkeleton() {
  return (
    <div className="px-4 py-3 flex gap-2.5 items-center border-t border-accent/15 bg-accent/3">
      <span className="text-sm shrink-0">🐂</span>
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="h-3 bg-border/50 rounded-full animate-pulse w-full" />
        <div className="h-3 bg-border/50 rounded-full animate-pulse w-4/5" />
      </div>
    </div>
  )
}
