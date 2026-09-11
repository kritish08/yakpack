import { generateText } from 'ai'
import { unstable_cache } from 'next/cache'
import { AI_ENABLED, modelForRequest, PEMBA_SYSTEM } from '@/lib/ai'
import { isAdmin } from '@/lib/admin'
import { localToday } from '@/lib/local-date'
import { createClient } from '@/lib/supabase/server'
import { getTripContext } from '@/lib/trip'
import type { Database } from '@/lib/database.types'

type ItineraryRow = Database['public']['Tables']['itinerary']['Row']

/**
 * Pemba's morning briefing for today's leg.
 *
 * A route handler rather than a server component because the caller's OpenAI key
 * lives in their browser (BYOK) and only reaches us as a request header — server
 * components never see it.
 *
 * Cached per (trip, day, date): both members of a trip see the same briefing, so
 * the second one to open the app costs nothing. The key is deliberately not part
 * of the cache key — the content depends on the trip, not on who paid for it.
 */
const generateBriefingCached = unstable_cache(
  async (
    _tripId: string,
    _date: string,
    day: number,
    highlights: string,
    altitude_m: number,
    warnings: string | null,
    weatherSummary: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: any,
  ): Promise<string> => {
    const prompt = `Morning briefing — Day ${day}: ${highlights}. Altitude: ${altitude_m}m. ${weatherSummary}${warnings ? ` Heads-up: ${warnings}.` : ''} Under 70 words — practical, warm, energising.`
    const { text } = await generateText({ model, system: PEMBA_SYSTEM, prompt })
    return text
  },
  ['ai-briefing'],
  { revalidate: 3600 },
)

export async function GET(req: Request) {
  if (!AI_ENABLED) return Response.json({ error: 'AI not enabled' }, { status: 403 })

  // Server key is admin-only; every other caller must bring their own.
  const model = modelForRequest(req, await isAdmin())
  if (!model) return Response.json({ error: 'NO_KEY' }, { status: 402 })

  try {
    const supabase = await createClient()
    const { tripId } = await getTripContext()
    const today = await localToday()

    const { data: rawLeg } = await supabase
      .from('itinerary')
      .select('*')
      .eq('trip_id', tripId)
      .lte('date', today)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
    const leg = rawLeg as ItineraryRow | null

    if (!leg) {
      return Response.json({ text: "Trip hasn't started yet — stay packed and ready. 🐂" })
    }

    let weatherSummary = ''
    if (leg.lat && leg.lon) {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${leg.lat}&longitude=${leg.lon}&current=temperature_2m,apparent_temperature&daily=temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max&forecast_days=1&timezone=auto`
        const wx = await fetch(url, { next: { revalidate: 1800 } }).then(r => r.json())
        const d = wx.daily
        weatherSummary = `Weather: ${wx.current?.temperature_2m}°C now, high ${d?.temperature_2m_max?.[0]}° / low ${d?.temperature_2m_min?.[0]}°, UV ${d?.uv_index_max?.[0]}, rain ${d?.precipitation_probability_max?.[0]}%.`
      } catch { /* forecast is optional context */ }
    }

    const text = await generateBriefingCached(
      tripId,
      today,
      leg.day ?? 1,
      leg.highlights ?? leg.leg ?? '',
      leg.altitude_m ?? 3800,
      leg.warnings,
      weatherSummary,
      model,
    )

    return Response.json({ text })
  } catch {
    // A rejected key or an unreachable model should hide the card, not break Today.
    return Response.json({ error: 'UNAVAILABLE' }, { status: 502 })
  }
}
