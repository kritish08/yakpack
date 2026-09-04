import { generateObject } from 'ai'
import { z } from 'zod'
import { AI_ENABLED, modelForRequest } from '@/lib/ai'
import { isAdmin } from '@/lib/admin'
import { createClient } from '@/lib/supabase/server'

const ParsedItemsSchema = z.object({
  items: z.array(z.object({
    name:               z.string().describe('Clean item name'),
    qty:                z.string().optional().describe('Quantity if obvious, e.g. "2"'),
    status:             z.enum(['owned', 'to_buy', 'standard']).default('to_buy'),
    assigned_to:        z.enum(['organiser', 'partner_1', 'partner_2', 'partner_3', 'shared']).default('shared'),
    suggested_category: z.string().optional().describe('Best matching category name from the provided list'),
  })),
})

export async function POST(req: Request) {
  if (!AI_ENABLED) return Response.json({ error: 'AI not enabled' }, { status: 403 })

  // Server key is admin-only; every other caller must bring their own.
  const model = modelForRequest(req, await isAdmin())
  if (!model) return Response.json({ error: 'NO_KEY' }, { status: 402 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { text, categories } = await req.json()
  if (!text?.trim()) return Response.json({ items: [] })

  const categoryContext = categories?.length
    ? `Available categories: ${(categories as { name: string }[]).map(c => `"${c.name}"`).join(', ')}.`
    : ''

  const prompt = `Parse the following text into packing list items for a Spiti Valley mountain trek. ${categoryContext} For each item: clean up the name, infer qty if mentioned, determine if it needs to be bought (to_buy) or is already owned, decide whether it belongs to the trip organiser ('organiser'), a partner ('partner_1', 'partner_2' or 'partner_3'), or everyone ('shared'), and pick the best matching category name from the list. Text: "${text}"`

  const { object } = await generateObject({
    model: model,
    schema: ParsedItemsSchema,
    prompt,
  })

  return Response.json(object)
}
