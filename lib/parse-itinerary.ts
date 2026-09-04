/**
 * Itinerary text → days, with no AI and no key.
 *
 * The AI importer reads a brochure and infers structure. Most itineraries do not
 * need that: they arrive already shaped as "Day 1 — Delhi to Shimla", because
 * that is how every operator, blog and email writes them. Parsing that shape
 * with rules means the manual path stops being a form to fill in one row at a
 * time, and it works for someone with no OpenAI key at all — which, since the
 * key is BYOK, is the default state of a new account.
 *
 * Deliberately conservative. It reads what is written and leaves everything else
 * null for the review step, rather than guessing to look clever: a wrong
 * altitude corrupts the AMS warnings, and a wrong date silently never matches
 * "today".
 */

export interface ParsedLine {
  day: number
  date: string | null
  leg: string
  /** Best guess at the place to look up, for the optional altitude lookup. */
  place: string | null
  altitude: number | null
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/**
 * Pulls a date out of a line and returns it with the date text removed.
 *
 * `defaultYear` covers "14 May" with no year, which is how most itineraries are
 * written — the trip's own start year is a far better guess than the current one
 * when the trip is months away.
 */
function extractDate(text: string, defaultYear: number): { date: string | null; rest: string } {
  // 2027-05-14
  let m = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (m) return { date: iso(+m[1], +m[2], +m[3]), rest: text.replace(m[0], ' ') }

  // 14 May 2027 · 14 May · 14th May
  m = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?(?:\s+(\d{4}))?\b/)
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) {
    const day = +m[1]
    if (day >= 1 && day <= 31) {
      return { date: iso(m[3] ? +m[3] : defaultYear, MONTHS[m[2].slice(0, 3).toLowerCase()], day), rest: text.replace(m[0], ' ') }
    }
  }

  // May 14, 2027 · May 14
  m = text.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/)
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) {
    const day = +m[2]
    if (day >= 1 && day <= 31) {
      return { date: iso(m[3] ? +m[3] : defaultYear, MONTHS[m[1].slice(0, 3).toLowerCase()], day), rest: text.replace(m[0], ' ') }
    }
  }

  // 14/05/2027 — day-first, because this app's itineraries are not American.
  // Ambiguous either way, so it is shown in the review step like everything else.
  m = text.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/)
  if (m) {
    const d = +m[1], mo = +m[2]
    let y = +m[3]
    if (y < 100) y += 2000
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) return { date: iso(y, mo, d), rest: text.replace(m[0], ' ') }
  }

  return { date: null, rest: text }
}

/**
 * Pulls the altitude that matters, and removes every altitude from the line.
 *
 * A day often names two: the pass it crosses and the place it ends. "Leh to
 * Nubra via Khardung La — the pass tops out at 5,359 m, you sleep at 3,050 m"
 * must yield 3,050. Sleeping altitude is what drives acclimatisation and the
 * AMS warnings; the pass is a number you pass through in an hour. Taking the
 * first match gets this exactly backwards.
 *
 * So: prefer an altitude written next to a sleeping word, otherwise take the
 * last one, since itinerary prose runs origin → destination.
 */
function extractAltitude(text: string): { altitude: number | null; rest: string } {
  // Requires the unit — a bare number is far more likely to be a distance, a
  // price or a time.
  const re = /\b(\d{1,2}[,.]?\d{3}|\d{3,4})\s*(?:m|metres|meters|mtr)\b/gi
  const hits: { value: number; index: number; raw: string }[] = []
  for (const m of text.matchAll(re)) {
    const n = parseInt(m[1].replace(/[,.]/g, ''), 10)
    // Everest is 8,849 m and the Dead Sea is −430 m; outside that it is not an
    // altitude in this context.
    if (Number.isFinite(n) && n >= 0 && n <= 9000) {
      hits.push({ value: n, index: m.index ?? 0, raw: m[0] })
    }
  }
  if (hits.length === 0) return { altitude: null, rest: text }

  // The altitude must FOLLOW the sleeping word and sit close behind it — "you
  // sleep at 3,050 m". A symmetric window is wrong: in "tops out at 5,359 m.
  // You sleep at 3,050 m" the pass is only twelve characters before "sleep",
  // so it matches first and the dangerous number wins.
  const SLEEP = /\b(sleep|stay|overnight|night|camp|halt|homestay|hotel)\b/gi
  const sleepAt = [...text.matchAll(SLEEP)].map(m => m.index ?? 0)
  const nearSleep = hits.filter(h => sleepAt.some(i => h.index > i && h.index - i <= 30)).pop()

  const chosen = nearSleep ?? hits[hits.length - 1]
  let rest = text
  for (const h of hits) rest = rest.replace(h.raw, ' ')
  return { altitude: chosen.value, rest }
}

/**
 * The place worth looking up: where the day *ends*.
 *
 * "Leh to Nubra via Khardung La" should look up Nubra, not Leh — you sleep at
 * the destination, and sleeping altitude is what drives acclimatisation. So the
 * segment after the last "to"/arrow wins, with any "via …" tail dropped.
 */
function extractPlace(leg: string): string | null {
  // Order matters. Sentence and clause boundaries are found first, on the text
  // as written: stripping filler verbs beforehand destroys the very punctuation
  // that marks where the name ends, and "Arrive Leh. Rest and acclimatise."
  // collapses into "Leh and Altitude".
  let s = leg.split(/(?<=\w)[.;!?](?:\s|$)/)[0]   // first sentence
             .split(',')[0]                        // first clause
             .replace(/\((?:[^)]*)\)/g, ' ')       // parentheticals
             .replace(/\bvia\b[^,;–—-]*/gi, ' ')   // a pass is not a stop

  // Now the verbs, which are never part of a place name.
  s = s.replace(/\b(overnight|drive|arrive|depart|explore|rest|transfer|sightseeing|acclimatis\w*|acclimatiz\w*|halt|stay|night)\b/gi, ' ')

  // Where the day ends, not where it starts: you sleep at the destination, and
  // sleeping altitude is what drives acclimatisation.
  const legs = s.split(/\s(?:to|→|->|–|—)\s/i)
  s = legs.length > 1 ? legs[legs.length - 1] : s

  const words = s
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => /[a-z]/i.test(w))
    .filter(w => !/^(and|the|a|an|at|with|from|for|near|then|in|on)$/i.test(w))
    .slice(0, 3)
    .join(' ')

  return words.length >= 2 && words.length <= 60 ? words : null
}

/**
 * Whether the text is explicitly numbered by day.
 *
 * The difference between "Day 1 — Delhi to Shimla" and an arbitrary web page is
 * the difference between parsing and guessing. With markers, the rules are
 * reliable enough to use unattended; without them, the one-line-per-day fallback
 * would happily turn a page of navigation links into an itinerary. So callers
 * ask first, and only trust the rules when the source is actually shaped like a
 * day-by-day plan.
 */
export function hasDayMarkers(text: string): boolean {
  const lines = text.split('\n').filter(l => /^\s*day\s*\d{1,2}\b/i.test(l))
  return lines.length >= 2
}

const DAY_MARKER = /^\s*(?:day\s*)?(\d{1,2})\s*(?:[-–—:.)\]]|\s)\s*(.+)$/i

/**
 * Parses pasted itinerary text into days.
 *
 * Two shapes are handled. If any line carries an explicit "Day N" marker, only
 * those lines start days and everything under one is folded into it — that is
 * how brochures are written, with prose beneath each heading. Otherwise every
 * non-empty line becomes one day in order, which is how people write their own
 * notes.
 */
export function parseItineraryText(text: string, defaultYear?: number): ParsedLine[] {
  const year = defaultYear ?? new Date().getFullYear()
  const lines = text.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  if (lines.length === 0) return []

  const explicit = lines.some(l => /^\s*day\s*\d{1,2}\b/i.test(l))

  const raw: { day: number; text: string }[] = []
  for (const line of lines) {
    const m = line.match(DAY_MARKER)
    const isDayHeading = explicit ? /^\s*day\s*\d{1,2}\b/i.test(line) : Boolean(m)

    if (isDayHeading && m) {
      raw.push({ day: parseInt(m[1], 10), text: m[2] })
    } else if (raw.length > 0 && explicit) {
      // Prose belonging to the day above it.
      raw[raw.length - 1].text += ' ' + line
    } else if (!explicit) {
      raw.push({ day: raw.length + 1, text: line })
    }
  }
  if (raw.length === 0) return []

  const out = raw.map((r, i) => {
    const a = extractAltitude(r.text)
    const d = extractDate(a.rest, year)
    // Removing a date or an altitude leaves holes — "Chitkul ( ), the last
    // village", "Altitude ." — so close them up rather than storing the debris.
    const leg = d.rest
      .replace(/\(\s*\)/g, ' ')
      .replace(/\[\s*\]/g, ' ')
      .replace(/\s+([.,;:])/g, '$1')
      .replace(/([(\[])\s+/g, '$1')
      .replace(/\s*[.,;:·]\s*(?=[.,;:·])/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s\-–—:•*·.,]+/, '')
      .replace(/[\s\-–—:·,;]+$/, '')
      .replace(/\s+\.$/, '')
      .trim()
    return {
      // Renumbered sequentially: a source that starts at Day 0, repeats a
      // number, or skips one must not produce a duplicate primary key.
      day: i + 1,
      date: d.date,
      leg: leg.slice(0, 300) || `Day ${i + 1}`,
      place: extractPlace(leg),
      altitude: a.altitude,
    }
  })

  return out.slice(0, 60)
}
