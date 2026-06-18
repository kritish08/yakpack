import type { Leg } from '@/lib/plan'

export type AmsLevel = 'none' | 'watch' | 'high'

export interface AmsRisk {
  level: AmsLevel
  note:  string
}

/**
 * Rule-based AMS (acute mountain sickness) risk for a given leg, derived from the
 * sleeping-altitude gain vs the previous day's leg. AI-independent — works fully
 * with AI_ENABLED=false. Client-safe (no server-only imports), so it can be used
 * from client components without pulling next/headers into the browser bundle.
 *
 * Heuristic:
 *   - 'high'  : sleeping above ~3500 m AND gain > ~800 m vs previous day
 *   - 'watch' : gain > ~500 m while above 3000 m
 *   - 'none'  : otherwise
 */
export function amsRisk(legs: Leg[], day: number): AmsRisk {
  const idx = legs.findIndex(l => l.day === day)
  if (idx < 0) return { level: 'none', note: '' }

  const alt = legs[idx].altitude_m ?? 0
  const prevAlt = idx > 0 ? (legs[idx - 1].altitude_m ?? 0) : alt
  const gain = alt - prevAlt

  if (alt > 3500 && gain > 800) {
    return {
      level: 'high',
      note: `Big climb from ${prevAlt.toLocaleString()}m → hydrate hard, climb slow, watch for AMS.`,
    }
  }
  if (alt > 3000 && gain > 500) {
    return {
      level: 'watch',
      note: `Gaining ${gain.toLocaleString()}m today → take it easy, drink water, rest if heady.`,
    }
  }
  return { level: 'none', note: '' }
}
