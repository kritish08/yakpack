import { generateText } from 'ai'
import { AI_ENABLED, getAzureModel, PEMBA_SYSTEM } from '@/lib/ai'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'

type ItineraryRow = Database['public']['Tables']['itinerary']['Row']

/**
 * Generates Pemba's morning briefing for today's leg.
 *
 * Runs entirely server-side: creates the cookie-bound Supabase client directly,
 * so it works from server components (e.g. the Ask screen) without an HTTP
 * round-trip that would drop the auth cookie and 401.
 *
 * Returns null when AI is disabled, the user is unauthenticated, or any error
 * occurs — callers should fall back gracefully.
 */
export async function getBriefing(): Promise<string | null> {
  if (!AI_ENABLED) return null

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const today = new Date().toISOString().slice(0, 10)

    const { data: rawLeg } = await supabase
      .from('itinerary')
      .select('*')
      .lte('date', today)
      .order('date', { ascending: false })
      .limit(1)
      .single()
    const leg = rawLeg as ItineraryRow | null

    if (!leg) {
      return "Trip hasn't started yet — stay packed and ready. Departure: June 19. 🐂"
    }

    let weatherSummary = ''
    if (leg.lat && leg.lon) {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${leg.lat}&longitude=${leg.lon}&current=temperature_2m,apparent_temperature&daily=temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max&forecast_days=1&timezone=auto`
        const wx = await fetch(url).then(r => r.json())
        const d = wx.daily
        weatherSummary = `Today's weather at ${leg.leg}: ${wx.current?.temperature_2m}°C (feels ${wx.current?.apparent_temperature}°C). High ${d?.temperature_2m_max?.[0]}° / Low ${d?.temperature_2m_min?.[0]}°. UV ${d?.uv_index_max?.[0]}, rain ${d?.precipitation_probability_max?.[0]}%.`
      } catch {
        weatherSummary = 'Weather data unavailable.'
      }
    }

    const prompt = `Generate a concise morning briefing for Day ${leg.day}: ${leg.highlights}. Altitude: ${leg.altitude_m}m. ${weatherSummary} Warnings: ${leg.warnings ?? 'none'}. Tip: ${leg.tip ?? 'none'}. Keep it under 80 words, practical and energising.`

    const { text } = await generateText({
      model: getAzureModel(),
      system: PEMBA_SYSTEM,
      prompt,
    })

    return text
  } catch {
    return null
  }
}
