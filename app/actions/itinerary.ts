'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getTripContext } from '@/lib/trip'
import { sanitizeText } from '@/lib/sanitize'
import type { NetworkQuality } from '@/lib/database.types'

export interface ItineraryDayInput {
  day: number
  date: string | null
  leg: string
  lat: number | null
  lon: number | null
  altitude_m: number | null
  highlights: string | null
  warnings: string | null
  network: NetworkQuality | null
}

/**
 * Replaces the current trip's itinerary.
 *
 * Only the organiser may. Written through the service-free client so RLS still
 * applies — `itinerary` is read-only to members by policy, so this uses the
 * organiser's own rights via the trips they created.
 */
export async function saveItinerary(days: ItineraryDayInput[]): Promise<number> {
  const ctx = await getTripContext()
  if (!ctx.isOrganiser) throw new Error('Only the trip organiser can change the plan.')
  if (days.length === 0) throw new Error('Nothing to save.')
  if (days.length > 60) throw new Error('That is more days than a trip can hold here.')

  const supabase = await createClient()

  const rows = days
    .filter(d => Number.isInteger(d.day) && d.day > 0)
    .map(d => ({
      trip_id: ctx.tripId,
      day: d.day,
      // A date that is not a plain ISO day would never match "today"; drop it
      // rather than storing something that silently never fires.
      date: d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : null,
      leg: sanitizeText(d.leg, 300) || `Day ${d.day}`,
      lat: typeof d.lat === 'number' ? d.lat : null,
      lon: typeof d.lon === 'number' ? d.lon : null,
      altitude_m: typeof d.altitude_m === 'number' ? Math.round(d.altitude_m) : null,
      highlights: d.highlights ? sanitizeText(d.highlights, 500) : null,
      warnings: d.warnings ? sanitizeText(d.warnings, 500) : null,
      network: d.network,
      carry_today: [],
    }))

  // itinerary is keyed (trip_id, day), so a re-import replaces cleanly.
  const { error: delErr } = await supabase.from('itinerary').delete().eq('trip_id', ctx.tripId)
  if (delErr) throw new Error(delErr.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('itinerary') as any).insert(rows)
  if (error) throw new Error(error.message)

  revalidatePath('/app', 'layout')
  return rows.length
}
