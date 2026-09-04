import { describe, it, expect } from 'vitest'
import { factsFromDays, baseList, sortItems, CATEGORY_ORDER } from '@/lib/packing-rules'

/**
 * The floor beneath Pemba. This is what a traveller with no OpenAI key gets, and
 * what the model is handed as a starting point when there is one — so an
 * omission here is an omission everywhere.
 */
const spiti = [2200, 3450, 3450, 3280, 3800, 4587, 4300, 2000, 216]
  .map((a, i) => ({ date: `2026-06-${String(19 + i).padStart(2, '0')}`, altitude_m: a }))
const tokyo = [40, 40, 40].map((a, i) => ({ date: `2026-04-0${i + 2}`, altitude_m: a }))

describe('factsFromDays', () => {
  it('reads the highest point', () => {
    expect(factsFromDays(spiti).maxAltitude).toBe(4587)
  })
  it('measures the largest single-day gain', () => {
    // 2,200 -> 3,450 on day two. Gain, not height, is what causes AMS.
    expect(factsFromDays(spiti).maxGain).toBe(1250)
  })
  it('measures gain between located days, skipping the unlocated', () => {
    // An unlocated day in the middle must not read as a drop to zero and back.
    const gappy = [{ date: null, altitude_m: 2000 }, { date: null, altitude_m: null }, { date: null, altitude_m: 2500 }]
    expect(factsFromDays(gappy).maxGain).toBe(500)
  })
  it('copes with no altitudes and no dates at all', () => {
    const f = factsFromDays([{ date: null, altitude_m: null }])
    expect(f.maxAltitude).toBeNull()
    expect(f.maxGain).toBeNull()
    expect(f.startMonth).toBeNull()
    expect(f.days).toBe(1)
  })
  it('never reports fewer than one day or one person', () => {
    const f = factsFromDays([], 0)
    expect(f.days).toBe(1)
    expect(f.people).toBe(1)
  })
})

describe('baseList — the list follows the route', () => {
  const high = baseList(factsFromDays(spiti, 2))
  const low = baseList(factsFromDays(tokyo, 1))
  const has = (list: { name: string }[], re: RegExp) => list.some(i => re.test(i.name))

  it('gives a high route insulation', () => expect(has(high, /Insulated jacket/)).toBe(true))
  it('does not give a city trip insulation', () => expect(has(low, /Insulated jacket/)).toBe(false))
  it('does not give a city trip altitude medication', () => expect(has(low, /[Aa]ltitude/)).toBe(false))
  it('gives both a passport', () => {
    expect(has(high, /ID \/ passport/)).toBe(true)
    expect(has(low, /ID \/ passport/)).toBe(true)
  })
  it('adds a shared charger only when there is more than one person', () => {
    expect(has(high, /Multi-port charger/)).toBe(true)
    expect(has(low, /Multi-port charger/)).toBe(false)
  })
  it('explains every conditional item with a fact about this trip', () => {
    // An unexplained oxygen can is clutter; a reason can be argued with.
    for (const item of high.filter(i => i.because)) {
      expect(item.because).toMatch(/route|sleep|gain|days|of you|winter/)
    }
  })
  it('never duplicates an item within a category', () => {
    const keys = high.map(i => `${i.category}::${i.name}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
  it('always carries the essentials, whatever the trip', () => {
    for (const list of [high, low]) {
      expect(list.filter(i => i.essential).length).toBeGreaterThan(5)
    }
  })
  it('produces a usable list even when nothing is known about the trip', () => {
    const blind = baseList(factsFromDays([{ date: null, altitude_m: null }]))
    expect(blind.length).toBeGreaterThan(20)
  })
})

describe('sortItems', () => {
  it('puts documents first, because that is the panic list', () => {
    const sorted = sortItems(baseList(factsFromDays(spiti, 2)))
    expect(sorted[0].category).toBe(CATEGORY_ORDER[0])
  })
  it('places unknown categories after the known ones', () => {
    const sorted = sortItems([
      { category: 'Zzz Custom', name: 'x', scope: 'each', status: 'standard' },
      { category: 'Health', name: 'y', scope: 'each', status: 'standard' },
    ])
    expect(sorted[0].category).toBe('Health')
  })
})
