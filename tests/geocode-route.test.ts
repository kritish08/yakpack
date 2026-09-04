import { describe, it, expect } from 'vitest'
import { resolveRoute, haversineKm, type GeoCandidate } from '@/lib/geocode'
import candidates from './fixtures/geocoder-candidates.json'

/**
 * Real Open-Meteo responses, captured once and frozen here.
 *
 * Fixtures rather than live calls on purpose: the point of these tests is the
 * ranking algorithm, and a test that also depends on a free third-party service
 * being reachable fails on a train for reasons that have nothing to do with the
 * code. The data is real, which matters — the whole reason route-awareness
 * exists is that this geocoder's own ordering is wrong more often than not.
 */
type Fixture = Omit<GeoCandidate, 'nameMatches'>
const fx = candidates as unknown as Record<string, Fixture[]>

/** The API returns no nameMatches; the resolver only needs lat/lon/elevation. */
function candidatesFor(place: string, query = place): GeoCandidate[] {
  const wanted = query.toLowerCase().replace(/[^a-z0-9]/g, '')
  return (fx[place] ?? []).map(c => ({
    ...c,
    nameMatches: c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === wanted,
  }))
}

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(31.1, 77.17, 31.1, 77.17)).toBe(0)
  })
  it('matches a known distance', () => {
    // Delhi to Shimla, about 280 km great-circle.
    const d = haversineKm(28.61, 77.21, 31.10, 77.17)
    expect(d).toBeGreaterThan(260)
    expect(d).toBeLessThan(300)
  })
  it('is symmetric', () => {
    const a = haversineKm(28.61, 77.21, 31.10, 77.17)
    const b = haversineKm(31.10, 77.17, 28.61, 77.21)
    expect(a).toBeCloseTo(b, 6)
  })
})

describe('resolveRoute — a route disambiguates its own place names', () => {
  const route = ['Shimla', 'Chitkul', 'Tabo', 'Kaza', 'Chandratal', 'Manali']
  const picks = resolveRoute(route, route.map(p => candidatesFor(p)))
  const by = Object.fromEntries(route.map((p, i) => [p, picks[i]]))

  // Truth, from maps rather than from the geocoder.
  it.each([
    ['Shimla', 2073],
    ['Chitkul', 3450],
    ['Tabo', 3281],
    ['Manali', 2108],
  ])('resolves %s to roughly %i m', (place, truth) => {
    expect(by[place]).not.toBeNull()
    expect(Math.abs((by[place]!.elevation ?? 0) - (truth as number))).toBeLessThan(400)
  })

  it('picks the Himachal Tabo, not the one in Ivory Coast', () => {
    expect(by.Tabo!.country).toBe('India')
  })

  it('picks the Himachal Manali, not the one in Tamil Nadu at 6 m', () => {
    // The failure this fixes: name matched exactly, elevation was wrong by 2 km.
    expect(by.Manali!.admin).toMatch(/Himachal/)
    expect(by.Manali!.elevation).toBeGreaterThan(1500)
  })

  it('flags a place the dataset does not hold instead of pretending', () => {
    // Kaza in Spiti is simply absent; the nearest candidate is in Afghanistan.
    // No ranking can invent it, so the honest outcome is a large distance.
    expect(by.Kaza!.distanceKm).toBeGreaterThan(400)
  })

  it('returns null where there are no candidates at all', () => {
    expect(by.Chandratal).toBeNull()
  })

  it('keeps every resolved day close to the rest of the route', () => {
    const onRoute = route.filter(p => p !== 'Kaza').map(p => by[p]).filter(Boolean)
    for (const p of onRoute) expect(p!.distanceKm).toBeLessThan(400)
  })
})

describe('resolveRoute — the anchor vote', () => {
  it('is distance-weighted, not a yes/no radius', () => {
    // The regression this guards: a binary "within 600 km" vote scored a loose
    // sprawl the same as a tight cluster, and resolved Shimla to Shimlai in
    // Pakistan because four unrelated candidates happened to fall inside it.
    const route = ['Shimla', 'Chitkul', 'Tabo', 'Kaza', 'Chandratal', 'Manali']
    const picks = resolveRoute(route, route.map(p => candidatesFor(p)))
    expect(picks[0]!.country).toBe('India')
    expect(picks[0]!.name).toBe('Shimla')
  })

  it('has no Himalayan bias — an Alpine route resolves too', () => {
    const route = ['Chamonix', 'Zermatt', 'Grindelwald']
    const picks = resolveRoute(route, route.map(p => candidatesFor(p)))
    expect(picks.every(p => p !== null)).toBe(true)
    for (const p of picks) expect(p!.elevation).toBeGreaterThan(900)
  })

  it('resolves a Ladakh route and flags only the absent place', () => {
    const route = ['Leh', 'Nubra', 'Kargil']
    const [leh, nubra, kargil] = resolveRoute(route, route.map(p => candidatesFor(p)))
    expect(leh!.elevation).toBeGreaterThan(3000)
    expect(kargil!.elevation).toBeGreaterThan(2000)
    // Nubra is not in the dataset; the only candidate is in Indonesia.
    expect(nubra!.distanceKm).toBeGreaterThan(1000)
  })
})

describe('resolveRoute — degenerate input', () => {
  it('returns nulls when nothing has candidates', () => {
    expect(resolveRoute(['a', 'b'], [[], []])).toEqual([null, null])
  })
  it('returns null for a day with no place', () => {
    const picks = resolveRoute([null, 'Leh'], [[], candidatesFor('Leh')])
    expect(picks[0]).toBeNull()
    expect(picks[1]).not.toBeNull()
  })
  it('handles a single place with a single candidate', () => {
    const picks = resolveRoute(['Chamonix'], [candidatesFor('Chamonix')])
    expect(picks[0]!.distanceKm).toBe(0)
  })
})
