import { AI_ENABLED } from '@/lib/ai'
import { getBriefing } from '@/lib/briefing'

export const revalidate = 3600 // cache 1 hour per leg+date

export async function GET() {
  if (!AI_ENABLED) return Response.json({ error: 'AI not enabled' }, { status: 403 })

  const briefing = await getBriefing()
  if (briefing === null) return new Response('Unauthorized', { status: 401 })

  return Response.json({ briefing })
}
