import { generateObject } from 'ai'
import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { AI_ENABLED, modelForRequest, PEMBA_SYSTEM } from '@/lib/ai'
import { isAdmin } from '@/lib/admin'
import { localToday } from '@/lib/local-date'
import { createClient } from '@/lib/supabase/server'
import { getTripContext } from '@/lib/trip'
import type { Database } from '@/lib/database.types'

type ItemRow = Database['public']['Tables']['items']['Row']
type ItineraryRow = Database['public']['Tables']['itinerary']['Row']

const GapSchema = z.object({
  gaps: z.array(z.object({
    title:           z.string().describe('Short gap title'),
    detail:          z.string().describe('Why this matters for the trip — one sentence'),
    severity:        z.enum(['high', 'medium', 'low']),
    suggested_items: z.array(z.string()).optional(),
  })),
})

/** Cached per trip + day; see the briefing route for why the key is excluded. */
const generateGapsCached = unstable_cache(
  async (
    _tripId: string,
    _date: string,
    unpackedItems: string[],
    toBuyItems: string[],
    highAltDays: string[],
    offlineDays: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: any,
  ) => {
    const { object } = await generateObject({
      model,
      system: PEMBA_SYSTEM,
      schema: GapSchema,
      prompt:
        `Review this Spiti Valley packing list for risky gaps. Items on the list: ${unpackedItems.join(', ') || 'none'}. ` +
        `Still to buy: ${toBuyItems.join(', ') || 'none'}. Days above 4,000 m: ${highAltDays.join(', ') || 'none'}. ` +
        `Days with no network: ${offlineDays.join(', ') || 'none'}. ` +
        `Name at most 4 genuine gaps for a high-altitude cold-desert trip. Skip anything already covered.`,
    })
    return object
  },
  ['ai-gaps'],
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

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const [{ data: rawItems }, { data: rawItinerary }] = await Promise.all([
      (supabase.from('items') as any).select('name, status').eq('trip_id', tripId).order('sort_order'),
      (supabase.from('itinerary') as any).select('day, altitude_m, network').eq('trip_id', tripId).order('day'),
    ])
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const items = rawItems as Pick<ItemRow, 'name' | 'status'>[] | null
    const itinerary = rawItinerary as Pick<ItineraryRow, 'day' | 'altitude_m' | 'network'>[] | null

    const unpacked = (items ?? []).map(i => i.name)
    const toBuy    = (items ?? []).filter(i => i.status === 'to_buy').map(i => i.name)
    const highAlt  = itinerary?.filter(l => (l.altitude_m ?? 0) > 4000).map(l => `Day ${l.day}`) ?? []
    const offline  = itinerary?.filter(l => l.network === 'none').map(l => `Day ${l.day}`) ?? []

    const today = await localToday()
    const { gaps } = await generateGapsCached(
      tripId, today, unpacked, toBuy, highAlt, offline, model,
    )

    return Response.json({ gaps })
  } catch {
    return Response.json({ error: 'UNAVAILABLE' }, { status: 502 })
  }
}
