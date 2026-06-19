import { streamText, tool, stepCountIs, convertToModelMessages } from 'ai'
import { z } from 'zod'
import { AI_ENABLED, getAzureModel, PEMBA_SYSTEM } from '@/lib/ai'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'

export const maxDuration = 30

type ItineraryRow = Database['public']['Tables']['itinerary']['Row']
type ItemRow = Database['public']['Tables']['items']['Row']
type CategoryRow = Database['public']['Tables']['categories']['Row']

export async function POST(req: Request) {
  if (!AI_ENABLED) return new Response('AI not enabled', { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { messages } = await req.json()

  // Drop any tool parts that never reached a terminal state (input-streaming /
  // input-available / approval-*). These appear when a confirmation sheet was
  // dismissed by closing the app, or in conversations saved by older builds —
  // convertToModelMessages() throws on unresolved tool calls otherwise.
  const TERMINAL = new Set(['output-available', 'output-error', 'output-denied'])
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const sanitized = (messages as any[]).map((m: any) => {
    if (!Array.isArray(m.parts)) return m
    const parts = m.parts.filter((p: any) => {
      const isTool = typeof p?.type === 'string' && (p.type.startsWith('tool-') || p.type === 'dynamic-tool')
      if (!isTool) return true
      return TERMINAL.has(p.state)
    })
    return { ...m, parts }
  }).filter((m: any) => (m.parts?.length ?? 0) > 0)
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Cap conversation length: old saved chats embed full packing-list tool
  // results, so token cost grows unbounded. Keep only the most recent ~20
  // messages (system is passed separately, not in this array, so a tail
  // slice is safe).
  const trimmed = sanitized.slice(-20)

  const result = streamText({
    onError: (err) => {
      console.error('[chat] streamText error:', JSON.stringify(err, null, 2))
    },
    model: getAzureModel(),
    system: PEMBA_SYSTEM,
    messages: await convertToModelMessages(trimmed),
    stopWhen: stepCountIs(5),
    tools: {

      // ── Read tools (auto-execute) ──────────────────────────────────

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
            const wx = await fetch(url, { next: { revalidate: 1800 } }).then(r => r.json())
            return { leg: leg.leg, altitude_m: leg.altitude_m, weather: wx }
          } catch {
            return { error: 'Weather fetch failed' }
          }
        },
      }),

      getCategories: tool({
        description: 'Get all packing categories with their IDs — use before addItems to pick the right category.',
        inputSchema: z.object({}),
        execute: async () => {
          const { data } = await supabase
            .from('categories')
            .select('id, name, icon, sort_order')
            .order('sort_order')
          return data as Pick<CategoryRow, 'id' | 'name' | 'icon' | 'sort_order'>[] | null
        },
      }),

      getPackingState: tool({
        description: 'Get full packing list — items with status, category, assignment, qty, and whether each is packed.',
        inputSchema: z.object({
          filter: z.enum(['all', 'unpacked', 'to_buy']).optional()
            .describe('Filter: all items, unpacked only, or items still to buy'),
        }),
        execute: async ({ filter }: { filter?: 'all' | 'unpacked' | 'to_buy' }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let q = (supabase.from('items') as any)
            .select('id, name, status, assigned_to, scope, carry_tags, category_id, qty, note')
            .order('sort_order')
          if (filter === 'to_buy') q = q.eq('status', 'to_buy')
          const { data: items } = await q as {
            data: Pick<ItemRow, 'id' | 'name' | 'status' | 'assigned_to' | 'scope' | 'category_id' | 'qty' | 'note'>[] | null
          }

          if (filter === 'unpacked') {
            const { data: packed } = await supabase.from('packed').select('item_id')
            const packedSet = new Set(packed?.map((p: { item_id: string }) => p.item_id))
            return (items ?? []).filter(i => !packedSet.has(i.id))
          }
          return items
        },
      }),

      // ── Write tools (no execute — user must confirm via client UI) ──

      addItems: tool({
        description:
          'Suggest items to add to the packing list. Always tell the user what you are adding BEFORE calling this. Use getCategories() first if you need the right category_id.',
        inputSchema: z.object({
          items: z.array(z.object({
            name:        z.string().describe('Item name'),
            qty:         z.string().optional().describe('Optional quantity, e.g. "2"'),
            status:      z.enum(['owned', 'to_buy', 'standard']).default('standard'),
            assigned_to: z.enum(['kritish', 'partner', 'shared']).default('shared'),
            category_id: z.number().optional().describe('Category ID from getCategories — omit to use default'),
          })),
          reason: z.string().describe('Why these items are suggested'),
        }),
      }),

      updateItem: tool({
        description:
          'Update an existing packing list item. Always describe the change to the user BEFORE calling this — they must confirm. Use getPackingState() to find the item ID first.',
        inputSchema: z.object({
          id:      z.string().describe('Item ID to update (from getPackingState)'),
          changes: z.object({
            name:        z.string().optional().describe('New item name'),
            qty:         z.string().nullable().optional().describe('New quantity, or null to clear'),
            status:      z.enum(['owned', 'to_buy', 'standard']).optional(),
            assigned_to: z.enum(['kritish', 'partner', 'shared']).optional(),
            category_id: z.number().optional(),
          }),
          reason: z.string().describe('Why this change is being made'),
        }),
      }),

      deleteItem: tool({
        description:
          "Permanently delete a packing list item EVERYWHERE — it is removed from the entire pack (Pack, Summary, and the shopping list) for both people and cannot be undone. Use ONLY when the user clearly wants the item gone entirely. Always describe exactly what will be deleted and get a strong explicit confirmation BEFORE calling. If the user only means \"remove from the shopping list\" / \"I'm not buying this\" / \"stop buying this\", do NOT use deleteItem — instead call updateItem to set status to 'standard', which keeps the item in the pack but takes it off the shopping list. Use getPackingState() to find the item ID first.",
        inputSchema: z.object({
          id:     z.string().describe('Item ID to delete'),
          name:   z.string().describe('Item name for display in confirmation'),
          reason: z.string().describe('Why this item should be removed'),
        }),
      }),

      markAsBought: tool({
        description:
          "Mark a to-buy item as purchased (changes status to 'owned'). Tell the user first, then they confirm.",
        inputSchema: z.object({
          id:   z.string().describe('Item ID'),
          name: z.string().describe('Item name for display in confirmation'),
        }),
      }),

    },
  })

  return result.toUIMessageStreamResponse()
}
