import { streamText, tool, stepCountIs } from 'ai'
import { z } from 'zod'
import { AI_ENABLED, getAzureModel, PEMBA_SYSTEM } from '@/lib/ai'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'

export const maxDuration = 30

type ItineraryRow = Database['public']['Tables']['itinerary']['Row']
type ItemRow = Database['public']['Tables']['items']['Row']

export async function POST(req: Request) {
  if (!AI_ENABLED) return new Response('AI not enabled', { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { messages } = await req.json()

  const result = streamText({
    model: getAzureModel(),
    system: PEMBA_SYSTEM,
    messages,
    stopWhen: stepCountIs(5),
    tools: {
      getCurrentLeg: tool({
        description: "Get today's itinerary leg based on the current date.",
        inputSchema: z.object({}),
        execute: async () => {
          const today = new Date().toISOString().slice(0, 10)
          const { data } = await supabase
            .from('itinerary')
            .select('*')
            .lte('date', today)
            .order('date', { ascending: false })
            .limit(1)
            .single()
          const leg = data as ItineraryRow | null
          return leg ?? { message: 'Trip has not started yet', today }
        },
      }),

      getItinerary: tool({
        description: 'Get the full 9-day trip itinerary with all legs, dates, and details.',
        inputSchema: z.object({}),
        execute: async () => {
          const { data } = await supabase.from('itinerary').select('*').order('day')
          return data as ItineraryRow[] | null
        },
      }),

      getWeather: tool({
        description: 'Get weather forecast for a specific itinerary day.',
        inputSchema: z.object({
          day: z.number().int().min(1).max(9).describe('Day number 1–9'),
        }),
        execute: async ({ day }: { day: number }) => {
          const { data: rawLeg } = await supabase
            .from('itinerary')
            .select('lat, lon, leg, altitude_m')
            .eq('day', day)
            .single()
          const leg = rawLeg as Pick<ItineraryRow, 'lat' | 'lon' | 'leg' | 'altitude_m'> | null
          if (!leg?.lat) return { error: 'Day not found' }
          try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${leg.lat}&longitude=${leg.lon}&current=temperature_2m,weather_code,apparent_temperature,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max,sunrise,sunset&forecast_days=1&timezone=auto`
            const wx = await fetch(url).then(r => r.json())
            return { leg: leg.leg, altitude_m: leg.altitude_m, weather: wx }
          } catch {
            return { error: 'Weather fetch failed' }
          }
        },
      }),

      getPackingState: tool({
        description: 'Get packing list items with their status.',
        inputSchema: z.object({
          filter: z.enum(['all', 'unpacked', 'to_buy']).optional()
            .describe('Filter: all items, unpacked only, or items still to buy'),
        }),
        execute: async ({ filter }: { filter?: 'all' | 'unpacked' | 'to_buy' }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let q = (supabase.from('items') as any).select('id, name, status, assigned_to, scope, carry_tags').order('sort_order')
          if (filter === 'to_buy') q = q.eq('status', 'to_buy')
          const { data: items } = await q as { data: Pick<ItemRow, 'id' | 'name' | 'status' | 'assigned_to'>[] | null }

          if (filter === 'unpacked') {
            const { data: packed } = await supabase.from('packed').select('item_id')
            const packedSet = new Set(packed?.map((p: { item_id: string }) => p.item_id))
            return (items ?? []).filter((i) => !packedSet.has(i.id))
          }
          return items
        },
      }),

      addItems: tool({
        description:
          'Suggest items to add to the packing list. Always tell the user what you are adding BEFORE calling this tool. The user must confirm before items are saved.',
        inputSchema: z.object({
          items: z.array(z.object({
            name: z.string().describe('Item name'),
            qty: z.string().optional().describe('Optional quantity, e.g. "2"'),
            status: z.enum(['owned', 'to_buy', 'standard']).default('standard'),
            assigned_to: z.enum(['kritish', 'partner', 'shared']).default('shared'),
          })),
          reason: z.string().describe('Why these items are suggested'),
        }),
        // No execute — client handles confirm + actual DB write
      }),
    },
  })

  return result.toUIMessageStreamResponse()
}
