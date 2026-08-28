import { generateText } from 'ai'
import { AI_ENABLED, modelForRequest, PEMBA_SYSTEM } from '@/lib/ai'
import { isAdmin } from '@/lib/admin'
import { createClient } from '@/lib/supabase/server'
import { getTripContext } from '@/lib/trip'
import type { Database } from '@/lib/database.types'

export const revalidate = 86400 // cache 24h per leg+date

type ItineraryRow = Database['public']['Tables']['itinerary']['Row']

export async function GET(req: Request) {
  if (!AI_ENABLED) return Response.json({ error: 'AI not enabled' }, { status: 403 })

  // Server key is admin-only; every other caller must bring their own.
  const model = modelForRequest(req, await isAdmin())
  if (!model) return Response.json({ error: 'NO_KEY' }, { status: 402 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const day = Number(searchParams.get('day'))
  if (!Number.isFinite(day) || day <= 0) {
    return Response.json({ error: 'Invalid day' }, { status: 400 })
  }

  const { tripId } = await getTripContext()

  const { data: rawLeg } = await supabase
    .from('itinerary')
    .select('*')
    .eq('trip_id', tripId)
    .eq('day', day)
    .single()
  const leg = rawLeg as ItineraryRow | null

  if (!leg) return Response.json({ error: 'Leg not found' }, { status: 404 })

  // Altitude gain vs the previous leg (for AMS framing)
  const { data: rawPrev } = await supabase
    .from('itinerary')
    .select('altitude_m')
    .eq('trip_id', tripId)
    .lt('day', day)
    .order('day', { ascending: false })
    .limit(1)
    .single()
  const prevAlt = (rawPrev as { altitude_m: number | null } | null)?.altitude_m ?? null
  const alt = leg.altitude_m ?? 0
  const gain = prevAlt != null ? alt - prevAlt : null
  const climbNote = gain != null ? `Altitude change vs previous day: ${gain >= 0 ? '+' : ''}${gain}m (now ${alt}m).` : `Altitude: ${alt}m.`

  let weatherSummary = 'Weather data unavailable.'
  if (leg.lat && leg.lon) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${leg.lat}&longitude=${leg.lon}&daily=temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max&forecast_days=1&timezone=auto`
      const wx = await fetch(url, { next: { revalidate: 86400 } }).then(r => r.json())
      const d = wx.daily
      weatherSummary = `Weather: high ${Math.round(d?.temperature_2m_max?.[0] ?? 0)}° / low ${Math.round(d?.temperature_2m_min?.[0] ?? 0)}°, UV ${d?.uv_index_max?.[0] ?? '?'}, rain ${d?.precipitation_probability_max?.[0] ?? 0}%.`
    } catch {
      weatherSummary = 'Weather data unavailable.'
    }
  }

  const prompt = `Write a practical 2-3 sentence Pemba insight for Day ${leg.day} — ${leg.leg}. ${climbNote} ${weatherSummary} Highlights: ${leg.highlights ?? 'none'}. Warnings: ${leg.warnings ?? 'none'}. Tonight's prep: ${leg.prep_tonight ?? 'none'}. Focus on altitude/acclimatisation, weather-driven layering, and what to prep. Be warm and concise. No medication doses.`

  try {
    const { text } = await generateText({
      model:  model,
      system: PEMBA_SYSTEM,
      prompt,
    })
    return Response.json({ insight: text })
  } catch {
    return Response.json({ error: 'Insight unavailable' }, { status: 502 })
  }
}
