import { generateText } from 'ai'
import { unstable_cache } from 'next/cache'
import Link from 'next/link'
import { AI_ENABLED, getAzureModel, PEMBA_SYSTEM } from '@/lib/ai'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'

type ItineraryRow = Database['public']['Tables']['itinerary']['Row']

const generateBriefingCached = unstable_cache(
  async (
    day: number,
    highlights: string,
    altitude_m: number,
    warnings: string | null,
    weatherSummary: string,
  ): Promise<string> => {
    const prompt = `Morning briefing — Day ${day}: ${highlights}. Altitude: ${altitude_m}m. ${weatherSummary}${warnings ? ` Heads-up: ${warnings}.` : ''} Under 70 words — practical, warm, energising.`
    const { text } = await generateText({
      model: getAzureModel(),
      system: PEMBA_SYSTEM,
      prompt,
    })
    return text
  },
  ['ai-briefing'],
  { revalidate: 3600 }
)

export default async function AiBriefingCard() {
  if (!AI_ENABLED) return null

  try {
    const supabase = await createClient()
    const today = new Date().toISOString().slice(0, 10)

    const { data: rawLeg } = await supabase
      .from('itinerary')
      .select('*')
      .lte('date', today)
      .order('date', { ascending: false })
      .limit(1)
      .single()
    const leg = rawLeg as ItineraryRow | null

    let weatherSummary = ''
    if (leg?.lat && leg?.lon) {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${leg.lat}&longitude=${leg.lon}&current=temperature_2m,apparent_temperature&daily=temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max&forecast_days=1&timezone=auto`
        const wx = await fetch(url, { next: { revalidate: 1800 } }).then(r => r.json())
        const d = wx.daily
        weatherSummary = `Weather: ${wx.current?.temperature_2m}°C now, high ${d?.temperature_2m_max?.[0]}° / low ${d?.temperature_2m_min?.[0]}°, UV ${d?.uv_index_max?.[0]}, rain ${d?.precipitation_probability_max?.[0]}%.`
      } catch { /* silently skip weather */ }
    }

    const briefingText = leg
      ? await generateBriefingCached(
          leg.day ?? 1,
          leg.highlights ?? leg.leg ?? '',
          leg.altitude_m ?? 3800,
          leg.warnings,
          weatherSummary,
        )
      : "Trip hasn't started yet — stay packed and ready. Departure: June 19. 🐂"

    return (
      <div className="bg-surface border border-accent/20 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-base">🐂</span>
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">Pemba&apos;s take</p>
        </div>
        <p className="font-body text-sm text-text leading-relaxed">{briefingText}</p>
        <Link
          href="/ask"
          className="mt-3 inline-flex items-center gap-1 font-mono text-xs text-accent hover:underline"
        >
          Ask Pemba more →
        </Link>
      </div>
    )
  } catch {
    return null
  }
}

export function AiBriefingCardSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-2xl p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-base opacity-40">🐂</span>
        <div className="h-3 w-24 bg-border rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-border rounded w-full" />
        <div className="h-3 bg-border rounded w-5/6" />
        <div className="h-3 bg-border rounded w-3/4" />
      </div>
    </div>
  )
}
