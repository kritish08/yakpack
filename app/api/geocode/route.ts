import { getTripContext } from '@/lib/trip'
import { geocode } from '@/lib/geocode'
import { sanitizeText } from '@/lib/sanitize'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Proposes coordinates and elevations for a handful of place names.
 *
 * Server-side for two reasons: lib/geocode.ts is `server-only`, and the CSP's
 * connect-src does not list the geocoding host, so the browser could not reach
 * it anyway. Both are deliberate — keeping the allowlist short is the point of
 * having one.
 *
 * The response is a *proposal*. Open-Meteo puts "Kaza" in Kazan', Russia at
 * 61 m against a true 3,800 m in Spiti, and altitude drives the AMS warnings,
 * so every suggestion carries the resolved name, country and elevation plus
 * whether the name actually matched — and the UI makes a human tick it before
 * any of it is used.
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
  if (!Array.isArray(places)) {
    return Response.json({ error: 'Bad request.' }, { status: 400 })
  }

  // One lookup per day of a trip, and a trip is capped at 60 days.
  const wanted = places
    .slice(0, 60)
    .map(p => (typeof p === 'string' ? sanitizeText(p, 60) : ''))

  // Deduplicated: a route that returns to the same town should not pay for it
  // twice, and Open-Meteo is a free service worth being polite to.
  const unique = [...new Set(wanted.filter(Boolean))]
  const found = new Map<string, Awaited<ReturnType<typeof geocode>>>()
  await Promise.all(unique.map(async q => { found.set(q, await geocode(q)) }))

  return Response.json({ suggestions: wanted.map(q => (q ? found.get(q) ?? null : null)) })
}
