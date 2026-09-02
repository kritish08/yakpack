import 'server-only'

export interface GeoSuggestion {
  /** What was asked for. */
  query: string
  /** What the geographic database returned, so a wrong match is visible. */
  name: string
  country: string | null
  admin: string | null
  lat: number
  lon: number
  elevation: number | null
  /** True when the returned name is essentially the queried name. */
  nameMatches: boolean
}

function normalise(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Proposes coordinates for a place name. It never decides.
 *
 * Open-Meteo's geocoder is keyless and already the app's weather source, but it
 * is unreliable for small mountain settlements — "Kaza" resolves to Kazan' in
 * Russia at 61 m rather than Kaza in Spiti at 3,800 m, and Chitkul comes back
 * at 529 m against a true 3,450 m. Since altitude drives the acute-mountain-
 * sickness warnings, accepting those numbers silently would corrupt the one
 * feature with a safety dimension.
 *
 * So this returns a *suggestion* carrying the resolved name, country and
 * elevation, plus whether the name actually matched. The caller shows it to a
 * human, who confirms or corrects it. Nothing here is written unattended.
 */
export async function geocode(place: string): Promise<GeoSuggestion | null> {
  const q = place.trim()
  if (!q) return null

  try {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
    // Strip a trailing region hint for the lookup itself; it is only there to
    // disambiguate and the API matches on the settlement name.
    url.searchParams.set('name', q.split(',')[0].trim())
    url.searchParams.set('count', '5')
    url.searchParams.set('language', 'en')
    url.searchParams.set('format', 'json')

    // Place names do not move; an import hits this once per day of the trip.
    const res = await fetch(url.toString(), { next: { revalidate: 86_400 } })
    if (!res.ok) return null

    const body = await res.json()
    const results: unknown[] = body?.results ?? []
    if (results.length === 0) return null

    const wanted = normalise(q.split(',')[0])
    const region = q.includes(',') ? normalise(q.split(',').slice(1).join(' ')) : ''

    // Prefer a hit whose country or region matches the hint, then fall back to
    // the first result — which the caller still has to show to a human.
    const scored = (results as Record<string, unknown>[]).map(r => ({
      r,
      regionHit: region
        ? normalise(String(r.country ?? '')).includes(region) ||
          normalise(String(r.admin1 ?? '')).includes(region)
        : false,
      nameHit: normalise(String(r.name ?? '')) === wanted,
    }))
    const best =
      scored.find(s => s.regionHit && s.nameHit) ??
      scored.find(s => s.nameHit) ??
      scored[0]

    const hit = best.r
    if (typeof hit.latitude !== 'number' || typeof hit.longitude !== 'number') return null

    return {
      query: q,
      name: String(hit.name ?? q),
      country: (hit.country as string) ?? null,
      admin: (hit.admin1 as string) ?? null,
      lat: hit.latitude,
      lon: hit.longitude,
      elevation: typeof hit.elevation === 'number' ? Math.round(hit.elevation) : null,
      nameMatches: best.nameHit,
    }
  } catch {
    return null
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Route-aware resolution
 *
 * Picking the single best match for a place name in isolation is the wrong
 * problem. "Tabo" is a village in Spiti at 3,281 m and also a town in Ivory
 * Coast; "Manali" is the Himachal hill station at 2,108 m and also four places
 * in Tamil Nadu, one of them at 6 m. Open-Meteo returns them all and orders them
 * by its own popularity notion, which on this dataset puts the wrong one first
 * more often than not.
 *
 * But an itinerary is not a set of unrelated names — it is a route, and a route
 * is geographically coherent. Days are hundreds of kilometres apart, not
 * thousands. So the other days on the trip disambiguate each one: among all the
 * candidates for "Tabo", the right one is the one near where you were yesterday.
 *
 * This turned three of four wrong answers into right ones on a real Spiti
 * itinerary, where the correct candidate was sitting at position 2 or 5 in the
 * list all along.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface GeoCandidate {
  name: string
  country: string | null
  admin: string | null
  lat: number
  lon: number
  elevation: number | null
  nameMatches: boolean
}

export interface RoutePick extends GeoCandidate {
  query: string
  /** Distance from the trip's anchor point. Large means "probably wrong". */
  distanceKm: number
}

/** Great-circle distance in km. */
export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Every candidate for a place name, unranked beyond what the API returned. */
export async function geocodeCandidates(place: string, count = 10): Promise<GeoCandidate[]> {
  const q = place.trim()
  if (!q) return []
  try {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
    url.searchParams.set('name', q.split(',')[0].trim())
    url.searchParams.set('count', String(count))
    url.searchParams.set('language', 'en')
    url.searchParams.set('format', 'json')

    const res = await fetch(url.toString(), { next: { revalidate: 86_400 } })
    if (!res.ok) return []
    const body = await res.json()
    const results: Record<string, unknown>[] = body?.results ?? []

    const wanted = normalise(q.split(',')[0])
    return results
      .filter(r => typeof r.latitude === 'number' && typeof r.longitude === 'number')
      .map(r => ({
        name: String(r.name ?? q),
        country: (r.country as string) ?? null,
        admin: (r.admin1 as string) ?? null,
        lat: r.latitude as number,
        lon: r.longitude as number,
        elevation: typeof r.elevation === 'number' ? Math.round(r.elevation) : null,
        nameMatches: normalise(String(r.name ?? '')) === wanted,
      }))
  } catch {
    return []
  }
}

/** How far apart two days of one trip can plausibly be before it looks wrong. */
const CLUSTER_KM = 600

/**
 * Chooses one candidate per place, using the whole route as context.
 *
 * Two passes. First a vote: each candidate scores a point for every *other*
 * place that has some candidate within CLUSTER_KM of it, and the winner becomes
 * the anchor. That finds the region the trip actually happens in without
 * trusting any single name, which matters because the most confident-looking
 * name is often the wrong one.
 *
 * Then each place takes its candidate nearest the anchor, and the anchor walks
 * forward to that pick so a genuinely long trip can drift across a map.
 *
 * Pure, so it is testable without touching the network.
 */
export function resolveRoute(
  queries: (string | null)[],
  candidates: GeoCandidate[][],
): (RoutePick | null)[] {
  const flat = candidates.map((cs, i) => ({ i, cs })).filter(x => x.cs.length > 0)
  if (flat.length === 0) return queries.map(() => null)

  let best: { c: GeoCandidate; score: number } | null = null
  for (const { i, cs } of flat) {
    for (const c of cs) {
      // Distance-weighted, not a yes/no within some radius. A binary vote scores
      // a loose sprawl the same as a tight cluster, and that is exactly how
      // "Shimla" once resolved to Shimlai in Pakistan: four other candidates
      // happened to fall inside the radius, so it tied with the real Shimla
      // whose neighbours sit 120 km away rather than 500.
      let score = 0
      for (const other of flat) {
        if (other.i === i) continue
        const nearest = Math.min(...other.cs.map(o => haversineKm(c.lat, c.lon, o.lat, o.lon)))
        if (nearest < CLUSTER_KM) score += 1 - nearest / CLUSTER_KM
      }
      // A candidate whose name is exactly what was asked for is worth a nudge,
      // but never enough to outvote the geography.
      if (c.nameMatches) score += 0.25

      if (!best || score > best.score) best = { c, score }
    }
  }

  let anchor = best!.c
  return candidates.map((cs, i) => {
    const q = queries[i]
    if (!q || cs.length === 0) return null

    const pick = cs.reduce((a, b) =>
      haversineKm(anchor.lat, anchor.lon, b.lat, b.lon) < haversineKm(anchor.lat, anchor.lon, a.lat, a.lon) ? b : a)

    const distanceKm = Math.round(haversineKm(anchor.lat, anchor.lon, pick.lat, pick.lon))
    // Only advance the anchor to a plausible neighbour, so one absurd result
    // cannot drag the rest of the route across the world with it.
    if (distanceKm <= CLUSTER_KM) anchor = pick
    return { ...pick, query: q, distanceKm }
  })
}
