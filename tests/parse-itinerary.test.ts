import { describe, it, expect } from 'vitest'
import { parseItineraryText, hasDayMarkers } from '@/lib/parse-itinerary'

/**
 * The keyless importer. Most itineraries arrive already shaped as "Day 1 — ...",
 * so rules get there without a model — which matters because keys are BYOK, and
 * no key is the default state of a new account.
 */
describe('hasDayMarkers', () => {
  it('recognises an explicitly numbered plan', () => {
    expect(hasDayMarkers('Day 1 - Delhi\nDay 2 - Shimla')).toBe(true)
  })
  it('rejects prose, so a web page is not forced through the fallback', () => {
    // Without this, a page of navigation links parses as an itinerary.
    expect(hasDayMarkers('Spiti is a cold desert valley.\nIt lies in Himachal Pradesh.')).toBe(false)
  })
  it('needs more than one marker', () => {
    expect(hasDayMarkers('Day 1 - the only line')).toBe(false)
  })
})

describe('parseItineraryText — operator format', () => {
  const days = parseItineraryText([
    'Day 1 - Delhi to Shimla, overnight Volvo',
    'Day 2 - Shimla to Chitkul (3,450 m), the last inhabited village',
    'Day 3: Chitkul to Tabo via Nako, 3280 m',
    'Day 4 - Tabo to Kaza - 3800 m',
  ].join('\n'), 2026)

  it('reads every day', () => expect(days).toHaveLength(4))
  it('parses a comma-grouped altitude', () => expect(days[1].altitude).toBe(3450))
  it('takes the destination as the place, not the origin', () => {
    expect(days[1].place).toBe('Chitkul')
  })
  it('excludes a pass named with "via" — it is crossed, not slept at', () => {
    expect(days[2].place).toBe('Tabo')
  })
  it('leaves no altitude debris in the leg text', () => {
    for (const d of days) expect(d.leg).not.toMatch(/\d{3,4}\s*m\b/)
  })
  it('leaves no empty brackets where an altitude was removed', () => {
    expect(days[1].leg).toBe('Shimla to Chitkul, the last inhabited village')
  })
})

describe('parseItineraryText — altitude is the one that matters', () => {
  it('prefers where you sleep over the pass you cross', () => {
    // The dangerous case. Taking the first match yields 5,359 — the pass — and
    // altitude is what the AMS warnings run on.
    const [day] = parseItineraryText([
      'Day 2 - Leh to Nubra via Khardung La',
      '  The pass tops out at 5359 m. You sleep at 3050 m.',
    ].join('\n'))
    expect(day.altitude).toBe(3050)
  })

  it('ignores numbers that are not altitudes', () => {
    const [day] = parseItineraryText('Day 1 - drive 350 km, budget 4000 rupees\nDay 2 - rest')
    expect(day.altitude).toBeNull()
  })

  it('refuses an implausible altitude', () => {
    const [day] = parseItineraryText('Day 1 - orbit at 400000 m\nDay 2 - rest')
    expect(day.altitude).toBeNull()
  })
})

describe('parseItineraryText — dates', () => {
  it.each([
    ['Day 1 - 2027-05-14 - Arrive Leh', '2027-05-14'],
    ['Day 1 - 14 May 2027 - Arrive Leh', '2027-05-14'],
    ['Day 1 - May 14, 2027 - Arrive Leh', '2027-05-14'],
    ['Day 1 - 14/05/2027 - Arrive Leh', '2027-05-14'],
  ])('reads %s', (line, expected) => {
    const [day] = parseItineraryText(line + '\nDay 2 - rest', 2027)
    expect(day.date).toBe(expected)
  })

  it('uses the trip year when the source omits it', () => {
    const [day] = parseItineraryText('Day 1 - 14 May - Arrive Leh\nDay 2 - rest', 2027)
    expect(day.date).toBe('2027-05-14')
  })

  it('leaves the date null rather than inventing one', () => {
    const [day] = parseItineraryText('Day 1 - Arrive Leh\nDay 2 - rest')
    expect(day.date).toBeNull()
  })
})

describe('parseItineraryText — shapes and edge cases', () => {
  it('folds prose beneath a heading into that day', () => {
    const days = parseItineraryText([
      'Day 1 - Arrive Leh',
      '  Rest and acclimatise.',
      'Day 2 - Leh to Nubra',
    ].join('\n'))
    expect(days).toHaveLength(2)
    expect(days[0].leg).toContain('acclimatise')
  })

  it('treats one line per day when nothing is numbered', () => {
    const days = parseItineraryText('Manali, arrive late\nManali to Jispa 3200 m\nJispa to Sarchu')
    expect(days).toHaveLength(3)
    expect(days[1].altitude).toBe(3200)
  })

  it('renumbers sequentially so a repeated number cannot collide', () => {
    // day is half of the itinerary primary key; duplicates would collide on insert.
    const days = parseItineraryText('Day 0 - briefing\nDay 1 - Delhi\nDay 1 - Delhi again\nDay 3 - Shimla')
    expect(days.map(d => d.day)).toEqual([1, 2, 3, 4])
  })

  it('returns nothing for empty or unparseable input', () => {
    expect(parseItineraryText('')).toEqual([])
    expect(parseItineraryText('   \n  \n ')).toEqual([])
  })

  it('caps a runaway source at 60 days', () => {
    const many = Array.from({ length: 200 }, (_, i) => `Day ${i + 1} - somewhere`).join('\n')
    expect(parseItineraryText(many)).toHaveLength(60)
  })

  it('never leaves a leg empty', () => {
    for (const d of parseItineraryText('Day 1 - 3000 m\nDay 2 - 3100 m')) {
      expect(d.leg.length).toBeGreaterThan(0)
    }
  })
})
