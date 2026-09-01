import { generateObject } from 'ai'
import { z } from 'zod'
import { AI_ENABLED, modelForRequest, PEMBA_SYSTEM } from '@/lib/ai'
import { isAdmin } from '@/lib/admin'
import { getTripContext } from '@/lib/trip'
import { sanitizeText } from '@/lib/sanitize'
import { baseList, factsFromDays, sortItems, CATEGORY_ORDER, type SeedItem } from '@/lib/packing-rules'

export const maxDuration = 60

/**
 * Pemba curates a packing list for one specific trip.
 *
 * The rules in lib/packing-rules.ts run first and their output is handed to the
 * model as a starting point, rather than the model being asked to invent a list
 * from nothing. That ordering is the whole design:
 *
 *   - It is a floor, not a suggestion. Every item marked `essential` is unioned
 *     back in afterwards, so a model that forgets a passport cannot cost anyone
 *     a flight. Curation can reword and re-note an essential, never delete it.
 *   - It grounds the answer. The model is given the trip's real altitude, gain,
 *     duration and month, so it argues with specifics instead of producing the
 *     same generic list it would for any holiday.
 *   - It degrades to something complete. With no key the caller never reaches
 *     this route and gets the floor directly, which is a usable list rather than
 *     an empty screen.
 *
 * Nothing here writes. The proposal goes back for review, same as the geocoder's
 * suggestions — the user accepts a list before a single row is created.
 */
const ItemSchema = z.object({
  category: z.string().describe('One of the given categories, or a new one if genuinely needed'),
  name: z.string(),
  note: z.string().nullable().describe('Short, practical, trip-specific. Null if there is nothing useful to add.'),
  scope: z.enum(['each', 'shared']).describe("'each' = one per person; 'shared' = one between the group"),
  status: z.enum(['owned', 'to_buy', 'standard']),
  because: z.string().nullable()
    .describe('Why THIS trip needs it, citing a real detail — altitude, duration, month, a place on the route. Null for obvious universals.'),
})

const ListSchema = z.object({
  items: z.array(ItemSchema).max(80),
  dropped: z.array(z.string()).describe('Names from the starting list that this trip genuinely does not need, with no explanation'),
})

export async function POST(req: Request) {
  if (!AI_ENABLED) return Response.json({ error: 'AI not enabled' }, { status: 403 })

  const model = modelForRequest(req, await isAdmin())
  if (!model) return Response.json({ error: 'NO_KEY' }, { status: 402 })

  try {
    const ctx = await getTripContext()

    const body = await req.json()
    const rawDays = Array.isArray(body?.days) ? body.days : []
    const people = ctx.members.length || 1
    const tripName = typeof body?.tripName === 'string' ? sanitizeText(body.tripName, 80) : ''

    interface ImportedDay { day: number; date: string | null; leg: string; altitude_m: number | null }
    const days: ImportedDay[] = rawDays.slice(0, 60).map((d: Record<string, unknown>) => ({
      day: Number(d?.day) || 0,
      date: typeof d?.date === 'string' ? d.date : null,
      leg: typeof d?.leg === 'string' ? sanitizeText(d.leg, 200) : '',
      altitude_m: typeof d?.altitude_m === 'number' ? d.altitude_m : null,
    }))

    const facts = factsFromDays(days, people)
    const floor = sortItems(baseList(facts))

    const { object } = await generateObject({
      model,
      schema: ListSchema,
      system:
        PEMBA_SYSTEM +
        '\n\nYou are now building a packing list. Rules that override anything else:\n' +
        '- Work from the starting list you are given. Keep what fits, reword what is vague, ' +
        'add what this specific trip needs, and list genuinely irrelevant items under "dropped".\n' +
        '- Every item must earn its place from a real detail of THIS trip. No generic filler.\n' +
        '- Never name a prescription drug, a dose, or a brand of medication. Say what the ' +
        'category is and to ask a doctor.\n' +
        '- Prefer fewer, better items. A list nobody reads protects nobody.',
      prompt:
        `Trip: ${tripName || 'unnamed'}\n` +
        `Length: ${facts.days} days · Travellers: ${facts.people}\n` +
        `Highest point: ${facts.maxAltitude != null ? facts.maxAltitude + ' m' : 'unknown'}\n` +
        `Biggest single-day gain: ${facts.maxGain != null ? facts.maxGain + ' m' : 'unknown'}\n` +
        `Departure month: ${facts.startMonth ?? 'unknown'}\n\n` +
        `Route:\n${days.map(d => `  Day ${d.day}: ${d.leg}${d.altitude_m != null ? ` (${d.altitude_m} m)` : ''}`).join('\n') || '  (no days yet)'}\n\n` +
        `Categories to prefer: ${CATEGORY_ORDER.join(', ')}\n\n` +
        `Starting list:\n${floor.map(i => `  [${i.category}] ${i.name}${i.essential ? ' *' : ''}`).join('\n')}\n\n` +
        `Items marked * are mandatory and must stay.`,
    })

    // Union the floor's essentials back in. The model is asked to keep them and
    // usually does; this makes it structural rather than a matter of trust.
    const proposed: SeedItem[] = object.items.map(i => ({
      category: sanitizeText(i.category, 40) || 'Other',
      name: sanitizeText(i.name, 80),
      note: i.note ? sanitizeText(i.note, 160) : undefined,
      scope: i.scope,
      status: i.status,
      because: i.because ? sanitizeText(i.because, 120) : undefined,
    })).filter(i => i.name.length > 0)

    const have = new Set(proposed.map(i => i.name.toLowerCase()))
    const restored: string[] = []
    for (const e of floor.filter(i => i.essential)) {
      if (!have.has(e.name.toLowerCase())) {
        proposed.push({ ...e, because: e.because ?? 'Always packed — restored automatically' })
        restored.push(e.name)
      }
    }

    return Response.json({
      facts,
      items: sortItems(proposed),
      restored,
      dropped: object.dropped.slice(0, 20).map(d => sanitizeText(d, 80)),
      curated: true,
    })
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Could not build a list.' },
      { status: 502 },
    )
  }
}
