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
