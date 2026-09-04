import { describe, it, expect } from 'vitest'
import { amsRisk } from '@/lib/ams'
import { deriveCarryTags } from '@/lib/weather'

/**
 * The one feature with a safety dimension, and the reason a wrong altitude is
 * worse than no altitude. No AI anywhere near it.
 */
describe('amsRisk', () => {
  // amsRisk takes whole itinerary rows; only day and altitude affect the result.
  const leg = (day: number, altitude_m: number | null) => ({
    trip_id: 't', day, date: null, leg: `Day ${day}`, lat: null, lon: null,
    altitude_m, highlights: null, carry_today: [], prep_tonight: null,
    warnings: null, network: null, fun: null, tip: null,
  })
  const legs = [leg(1, 2200), leg(2, 3450), leg(3, 3450), leg(4, 4587)]
  it('returns a risk for a day that exists', () => {
    expect(amsRisk(legs, 4)).toBeTruthy()
  })
  it('does not throw on a day with no altitude', () => {
    expect(() => amsRisk([leg(1, null)], 1)).not.toThrow()
  })
  it('does not throw on an unknown day', () => {
    expect(() => amsRisk(legs, 99)).not.toThrow()
  })
  it('does not throw on an empty itinerary', () => {
    expect(() => amsRisk([], 1)).not.toThrow()
  })
})

describe('deriveCarryTags', () => {
  // Shaped as Open-Meteo actually returns it: parallel arrays under `daily`.
  const wx = (o: { tempMin?: number; rain?: number; uv?: number }) => ({
    daily: {
      temperature_2m_min: [o.tempMin ?? 10],
      temperature_2m_max: [20],
      precipitation_probability_max: [o.rain ?? 0],
      uv_index_max: [o.uv ?? 1],
    },
  })

  it('asks for cold kit below 5 degrees', () => {
    expect(deriveCarryTags(wx({ tempMin: 2 }) as never, 1000)).toContain('cold')
  })
  it('asks for cold kit above 4,000 m whatever the forecast', () => {
    expect(deriveCarryTags(wx({ tempMin: 20 }) as never, 4500)).toContain('cold')
  })
  it('asks for rain kit at 50 percent or more', () => {
    expect(deriveCarryTags(wx({ rain: 50 }) as never, 500)).toContain('rain')
  })
  it('asks for sun protection at UV 6 or more', () => {
    expect(deriveCarryTags(wx({ uv: 6 }) as never, 500)).toContain('uv')
  })
  it('asks for nothing on a mild low day', () => {
    expect(deriveCarryTags(wx({}) as never, 500)).toEqual([])
  })
})
