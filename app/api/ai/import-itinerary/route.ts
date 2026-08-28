import { generateObject } from 'ai'
import { z } from 'zod'
import { AI_ENABLED, modelForRequest } from '@/lib/ai'
import { isAdmin } from '@/lib/admin'
import { getTripContext } from '@/lib/trip'
import { sanitizeText } from '@/lib/sanitize'
import { geocode } from '@/lib/geocode'

export const maxDuration = 60

/**
 * Turns a pasted itinerary into structured days.
 *
 * The model is asked only for what it can read off the page — day, date, place
 * names, notes. It is explicitly NOT asked for coordinates or altitude: those
 * are exactly the numbers a language model will invent confidently, and a wrong
 * altitude silently corrupts the AMS warnings. Open-Meteo's geocoder resolves
 * place names to lat/lon and elevation instead, from an authoritative source.
 *
 * Anything unresolved stays null and is reported back as a gap. Nothing is
 * guessed to make the output look complete.
 */
const DaySchema = z.object({
  day: z.number().int().min(1).max(60).describe('Day number, starting at 1'),
  date: z.string().nullable().describe('ISO date YYYY-MM-DD if one is stated, else null'),
  leg: z.string().describe('The day, as written — route or activity'),
  place: z.string().nullable()
    .describe('The single place to look up for weather: the town or landmark where the day ends. Null if none is named.'),
  highlights: z.string().nullable(),
  warnings: z.string().nullable().describe('Only genuine cautions stated in the source'),
  network: z.enum(['good', 'weak', 'patchy', 'none']).nullable()
    .describe('Only if the source says something about signal'),
})

const ImportSchema = z.object({
  trip_name: z.string().nullable(),
  days: z.array(DaySchema),
})

export async function POST(req: Request) {
  if (!AI_ENABLED) return Response.json({ error: 'AI not enabled' }, { status: 403 })

  const model = modelForRequest(req, await isAdmin())
  if (!model) return Response.json({ error: 'NO_KEY' }, { status: 402 })

  try {
    await getTripContext() // must be signed in and in a trip

    const { text } = await req.json()
    const source = typeof text === 'string' ? text.trim() : ''
    if (source.length < 20) {
      return Response.json({ error: 'Paste a bit more of the itinerary.' }, { status: 400 })
    }
    // Cap the input: a whole brochure would blow the context window and the
    // caller's budget with it.
    const clipped = source.slice(0, 24_000)

    const { object } = await generateObject({
      model,
      schema: ImportSchema,
      system:
        'You convert travel itineraries into structured days. Extract only what the source actually says. ' +
        'Never invent dates, places, warnings or signal quality. If something is not stated, return null. ' +
        'Never return coordinates or altitudes — they are resolved separately from a geographic database.',
      prompt: `Convert this itinerary into days.\n\n---\n${clipped}\n---`,
    })

    // Geography is proposed, never applied. The geocoder is unreliable for small
    // mountain settlements, and a wrong altitude would corrupt the AMS warnings,
    // so each day carries its suggestion for a human to accept or correct.
    const gaps: string[] = []
    const days = await Promise.all(object.days.map(async d => {
      const place = d.place?.trim() || null
      const suggestion = place ? await geocode(place) : null

      if (!place) gaps.push(`Day ${d.day}: no place named — no weather or altitude.`)
      else if (!suggestion) gaps.push(`Day ${d.day}: couldn't find “${place}”.`)
      else if (!suggestion.nameMatches) {
        gaps.push(`Day ${d.day}: “${place}” best matched “${suggestion.name}${suggestion.country ? ', ' + suggestion.country : ''}” — check before accepting.`)
      }
      if (!d.date) gaps.push(`Day ${d.day}: no date, so it won't line up with “today”.`)

      return {
        day: d.day,
        date: d.date,
        leg: sanitizeText(d.leg, 300),
        place,
        highlights: d.highlights ? sanitizeText(d.highlights, 500) : null,
        warnings: d.warnings ? sanitizeText(d.warnings, 500) : null,
        network: d.network,
        // Left null on purpose: filled only from a suggestion the user accepts.
        lat: null as number | null,
        lon: null as number | null,
        altitude_m: null as number | null,
        suggestion,
      }
    }))

    return Response.json({
      tripName: object.trip_name ? sanitizeText(object.trip_name, 80) : null,
      days: days.sort((a, b) => a.day - b.day),
      gaps,
    })
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Could not read that itinerary.' },
      { status: 502 },
    )
  }
}
