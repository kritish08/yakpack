import { getTripContext } from '@/lib/trip'
import { geocodeCandidates, resolveRoute } from '@/lib/geocode'
import { sanitizeText } from '@/lib/sanitize'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Proposes an elevation per day, using the whole route to disambiguate.
 *
 * Resolving each name on its own is the wrong problem. Open-Meteo returns every
 * "Tabo" and "Manali" on earth ordered by its own popularity notion, and on this
 * dataset that puts the wrong one first more often than not: Tabo resolves to
 * Ivory Coast, Manali to a place in Tamil Nadu at 6 m.
 *
 * An itinerary is a route though, and a route is geographically coherent — days
 * are hundreds of kilometres apart, not thousands. So the other days
 * disambiguate each one. On a real Spiti itinerary this turned three of four
 * wrong answers into right ones; the correct candidate had been sitting at
 * position 2 or 5 in the list the whole time.
 *
 * Still a proposal. Kaza is simply not in the dataset — the nearest candidate is
 * 833 km away in Afghanistan — so `distanceKm` travels with each suggestion and
 * the UI says how far off-route it is. Nothing is applied without a tap.
 */
export async function POST(req: Request) {
  try {
    await getTripContext()
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let places: unknown
  try {
    ({ places } = await req.json())
  } catch {
    return Response.json({ error: 'Bad request.' }, { status: 400 })
  }
  if (!Array.isArray(places)) return Response.json({ error: 'Bad request.' }, { status: 400 })

  // A trip is capped at 60 days, so this is bounded by construction.
  const wanted = places
    .slice(0, 60)
    .map(p => (typeof p === 'string' ? sanitizeText(p, 60) : ''))
    .map(p => (p ? p : null))

  // Deduplicated before fetching: a route that returns to the same town should
  // not pay for it twice, and Open-Meteo is a free service worth being polite to.
  const unique = [...new Set(wanted.filter((p): p is string => Boolean(p)))]
  const byPlace = new Map<string, Awaited<ReturnType<typeof geocodeCandidates>>>()
  await Promise.all(unique.map(async q => { byPlace.set(q, await geocodeCandidates(q)) }))

  const candidates = wanted.map(q => (q ? byPlace.get(q) ?? [] : []))
  return Response.json({ suggestions: resolveRoute(wanted, candidates) })
}
