import { generateObject } from 'ai'
import { z } from 'zod'
import { AI_ENABLED, getAzureModel } from '@/lib/ai'
import { createClient } from '@/lib/supabase/server'

const ParsedItemsSchema = z.object({
  items: z.array(z.object({
    name: z.string(),
    qty: z.string().optional(),
    status: z.enum(['owned', 'to_buy', 'standard']).default('standard'),
    assigned_to: z.enum(['kritish', 'partner', 'shared']).default('shared'),
  })),
})

export async function POST(req: Request) {
  if (!AI_ENABLED) return Response.json({ error: 'AI not enabled' }, { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { text } = await req.json()
  if (!text?.trim()) return Response.json({ items: [] })

  const { object } = await generateObject({
    model: getAzureModel(),
    schema: ParsedItemsSchema,
    prompt: `Parse the following text into packing list items for a Spiti Valley trip. Infer qty, owned/to_buy status, and whether shared or individual (kritish/partner) from context. Text: "${text}"`,
  })

  return Response.json(object)
}
