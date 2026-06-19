import { generateObject } from 'ai'
import { z } from 'zod'
import { AI_ENABLED, getAzureModel, PEMBA_SYSTEM } from '@/lib/ai'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'

export const revalidate = 1800

type ItineraryRow = Database['public']['Tables']['itinerary']['Row']
type ItemRow = Database['public']['Tables']['items']['Row']

const GapSchema = z.object({
  gaps: z.array(z.object({
    title: z.string().describe('Short gap title'),
    detail: z.string().describe('Why this matters for the trip'),
    severity: z.enum(['high', 'medium', 'low']),
    suggested_items: z.array(z.string()).optional().describe('Items to add if applicable'),
  })),
})

export async function GET() {
  if (!AI_ENABLED) return Response.json({ error: 'AI not enabled' }, { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: rawItems }, { data: packed }, { data: rawItinerary }] = await Promise.all([
    (supabase.from('items') as any).select('name, status, assigned_to, carry_tags').order('sort_order'),
    supabase.from('packed').select('item_id'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('itinerary') as any).select('day, altitude_m, network, warnings, carry_today').order('day'),
  ])
  const items = rawItems as Pick<ItemRow, 'name' | 'status' | 'assigned_to'>[] | null
  const itinerary = rawItinerary as Pick<ItineraryRow, 'day' | 'altitude_m' | 'network' | 'warnings' | 'carry_today'>[] | null

  const unpackedItems = (items ?? []).map(i => i.name)
  const highAltDays = itinerary?.filter(l => (l.altitude_m ?? 0) > 4000).map(l => `Day ${l.day}`) ?? []
  const offlineDays = itinerary?.filter(l => l.network === 'none').map(l => `Day ${l.day}`) ?? []

  const prompt = `You are analysing a Spiti Valley packing list for two travellers.
Unpacked items (${unpackedItems.length}): ${unpackedItems.slice(0, 30).join(', ')}${unpackedItems.length > 30 ? '...' : ''}.
High-altitude days (>4000m): ${highAltDays.join(', ')}.
Fully offline days (no signal): ${offlineDays.join(', ')}.
Items to buy: ${items?.filter(i => i.status === 'to_buy').map(i => i.name).join(', ') ?? 'none'}.

Identify the top packing gaps or risks. Focus on safety-critical items (altitude, cold, medical), offline preparation, and anything missing for high-altitude days. Return up to 5 gaps.`

  const { object } = await generateObject({
    model: getAzureModel(),
    system: PEMBA_SYSTEM,
    schema: GapSchema,
    prompt,
  })

  return Response.json(object)
}
