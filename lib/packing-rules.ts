import type { ItemScope, ItemStatus } from '@/lib/database.types'

/**
 * A packing list derived from the trip itself, with no AI involved.
 *
 * This is the floor. Pemba curates on top of it when the traveller has a key,
 * but the rules here always run, for two reasons: the app must be complete and
 * useful with `AI_ENABLED=false` or no key at all, and a language model that
 * forgets your passport should not be the only thing standing between you and
 * the airport. Anything marked `essential` is unioned back in after curation,
 * so an omission by the model cannot silently drop it.
 *
 * The inputs are only what an itinerary actually tells us — how long, how high,
 * how much gain in a day, which month, how many people. Everything else would be
 * a guess dressed up as a rule.
 */

export interface TripFacts {
  days: number
  people: number
  /** Highest altitude on the route, metres. Null when no day was located. */
  maxAltitude: number | null
  /** Largest single-day altitude gain, metres — what actually drives AMS. */
  maxGain: number | null
  /** Month of departure, 1–12. Null when no day carries a date. */
  startMonth: number | null
}

export interface SeedItem {
  category: string
  name: string
  note?: string
  scope: ItemScope
  status: ItemStatus
  /** Survives curation: re-added if the model leaves it out. */
  essential?: boolean
  /** Why this item is on the list — shown in review, never stored. */
  because?: string
}

interface DayLike {
  date: string | null
  altitude_m: number | null
}

/** Reads the facts the rules need out of whatever days the import produced. */
export function factsFromDays(days: DayLike[], people = 1): TripFacts {
  const alts = days.map(d => d.altitude_m).filter((a): a is number => typeof a === 'number')
  const maxAltitude = alts.length > 0 ? Math.max(...alts) : null

  // Gain is measured between consecutive *located* days. An unlocated day in the
  // middle would otherwise read as a drop to zero and back.
  let maxGain: number | null = null
  let prev: number | null = null
  for (const d of days) {
    if (d.altitude_m == null) continue
    if (prev != null) maxGain = Math.max(maxGain ?? 0, d.altitude_m - prev)
    prev = d.altitude_m
  }

  const firstDated = days.find(d => d.date)?.date ?? null
  const month = firstDated ? Number(firstDated.slice(5, 7)) : null

  return {
    days: Math.max(days.length, 1),
    people: Math.max(people, 1),
    maxAltitude,
    maxGain,
    startMonth: month && month >= 1 && month <= 12 ? month : null,
  }
}

const CORE: SeedItem[] = [
  // Documents & money — the category where forgetting one thing ends the trip.
  { category: 'Documents & Money', name: 'ID / passport',            scope: 'each',   status: 'standard', essential: true },
  { category: 'Documents & Money', name: 'Tickets & bookings',       scope: 'shared', status: 'standard', essential: true, note: 'Downloaded, not just in the inbox' },
  { category: 'Documents & Money', name: 'Cash',                     scope: 'each',   status: 'to_buy',   essential: true, note: 'Cards and UPI fail more often than you expect' },
  { category: 'Documents & Money', name: 'Bank / travel card',       scope: 'each',   status: 'standard' },
  { category: 'Documents & Money', name: 'Travel insurance details', scope: 'shared', status: 'to_buy' },

  { category: 'Health',            name: 'Personal medication',      scope: 'each',   status: 'to_buy',   essential: true, note: 'Enough for the whole trip, in its original box' },
  { category: 'Health',            name: 'Basic first-aid kit',      scope: 'shared', status: 'to_buy',   essential: true },
  { category: 'Health',            name: 'Painkillers',              scope: 'shared', status: 'to_buy' },
  { category: 'Health',            name: 'Rehydration salts',        scope: 'shared', status: 'to_buy' },
  { category: 'Health',            name: 'Hand sanitiser',           scope: 'shared', status: 'standard' },

  { category: 'Gadgets & Charging', name: 'Phone',                   scope: 'each',   status: 'standard', essential: true },
  { category: 'Gadgets & Charging', name: 'Charger + cables',        scope: 'each',   status: 'standard', essential: true },
  { category: 'Gadgets & Charging', name: 'Power bank',              scope: 'each',   status: 'to_buy' },
  { category: 'Gadgets & Charging', name: 'Earphones',               scope: 'each',   status: 'standard' },

  { category: 'Clothing',          name: 'Underwear & socks',        scope: 'each',   status: 'standard', essential: true },
  { category: 'Clothing',          name: 'Daily outfits',            scope: 'each',   status: 'standard' },
  { category: 'Clothing',          name: 'Sleepwear',                scope: 'each',   status: 'standard' },
  { category: 'Clothing',          name: 'Comfortable walking shoes', scope: 'each',  status: 'standard', essential: true },

  { category: 'Toiletries',        name: 'Toothbrush & toothpaste',  scope: 'each',   status: 'standard', essential: true },
  { category: 'Toiletries',        name: 'Deodorant',                scope: 'each',   status: 'standard' },
  { category: 'Toiletries',        name: 'Shampoo & soap',           scope: 'shared', status: 'standard' },
  { category: 'Toiletries',        name: 'Sunscreen',                scope: 'shared', status: 'to_buy' },
  { category: 'Toiletries',        name: 'Lip balm',                 scope: 'each',   status: 'to_buy' },

  { category: 'Bags',              name: 'Main bag',                 scope: 'each',   status: 'standard', essential: true },
  { category: 'Bags',              name: 'Daypack',                  scope: 'each',   status: 'standard' },
  { category: 'Bags',              name: 'Reusable water bottle',    scope: 'each',   status: 'to_buy',   essential: true },
]

/**
 * Conditional blocks.
 *
 * Each states the fact that triggers it, so the review screen can say *why* an
 * item is on the list. "Because you cross 4,590 m" is a reason a traveller can
 * argue with; an unexplained oxygen can is just clutter.
 */
function conditional(f: TripFacts): SeedItem[] {
  const out: SeedItem[] = []
  const alt = f.maxAltitude ?? 0
  const push = (because: string, items: Omit<SeedItem, 'because'>[]) =>
    out.push(...items.map(i => ({ ...i, because })))

  if (alt >= 2500) {
    push(`the route reaches ${alt.toLocaleString()} m`, [
      { category: 'Health',     name: 'Altitude headache tablets', scope: 'shared', status: 'to_buy', note: 'Ask a doctor before the trip about anything stronger' },
      { category: 'Clothing',   name: 'Warm mid-layer / fleece',   scope: 'each',   status: 'standard' },
      { category: 'Toiletries', name: 'High-SPF sunscreen',        scope: 'shared', status: 'to_buy', note: 'UV climbs sharply with altitude' },
      { category: 'Toiletries', name: 'Moisturiser',               scope: 'each',   status: 'to_buy', note: 'Thin air is very dry' },
    ])
  }

  if (alt >= 3500) {
    push(`you sleep above 3,500 m`, [
      { category: 'Clothing', name: 'Thermal base layer', scope: 'each',   status: 'to_buy' },
      { category: 'Clothing', name: 'Warm hat & gloves',  scope: 'each',   status: 'to_buy' },
      { category: 'Health',   name: 'Pulse oximeter',     scope: 'shared', status: 'to_buy', note: 'Optional, but it turns "I feel off" into a number' },
    ])
  }

  if (alt >= 4000) {
    push(`the route crosses 4,000 m`, [
      { category: 'Clothing', name: 'Insulated jacket',       scope: 'each',   status: 'to_buy' },
      { category: 'Gadgets & Charging', name: 'Headtorch',    scope: 'each',   status: 'to_buy', note: 'Power is unreliable this high' },
    ])
  }

  if ((f.maxGain ?? 0) >= 1200) {
    push(`you gain ${f.maxGain!.toLocaleString()} m in a single day`, [
      { category: 'Health', name: 'Extra water for the ascent day', scope: 'each', status: 'standard', note: 'Fast gain is what causes altitude sickness, not height alone' },
    ])
  }

  if (f.days >= 7) {
    push(`the trip runs ${f.days} days`, [
      { category: 'Toiletries', name: 'Travel laundry soap', scope: 'shared', status: 'to_buy' },
      { category: 'Clothing',   name: 'Spare shoes',         scope: 'each',   status: 'standard' },
    ])
  }

  if (f.people > 1) {
    push(`there are ${f.people} of you`, [
      { category: 'Gadgets & Charging', name: 'Multi-port charger', scope: 'shared', status: 'to_buy', note: 'One socket, two phones' },
    ])
  }

  // Northern-hemisphere winter. Stated as a hemisphere assumption rather than
  // pretended to be climate science.
  if (f.startMonth != null && (f.startMonth <= 2 || f.startMonth >= 11) && alt >= 1500) {
    push('you travel in winter, at altitude', [
      { category: 'Clothing', name: 'Heavy socks', scope: 'each', status: 'to_buy' },
    ])
  }

  return out
}

/** The full rule-derived list, de-duplicated by category + name. */
export function baseList(facts: TripFacts): SeedItem[] {
  const all = [...CORE, ...conditional(facts)]
  const seen = new Map<string, SeedItem>()
  for (const item of all) {
    const key = `${item.category}::${item.name}`.toLowerCase()
    // A conditional item wins over the core one it duplicates: it carries the
    // reason, and its note is the trip-specific one.
    seen.set(key, seen.has(key) ? { ...seen.get(key)!, ...item } : item)
  }
  return [...seen.values()]
}

/** Category display order — documents first, because that is the panic list. */
export const CATEGORY_ORDER = [
  'Documents & Money',
  'Health',
  'Clothing',
  'Toiletries',
  'Gadgets & Charging',
  'Bags',
]

export function sortItems(items: SeedItem[]): SeedItem[] {
  const rank = (c: string) => {
    const i = CATEGORY_ORDER.indexOf(c)
    return i === -1 ? CATEGORY_ORDER.length : i
  }
  return items.slice().sort((a, b) => rank(a.category) - rank(b.category) || a.name.localeCompare(b.name))
}
