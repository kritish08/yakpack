import { normaliseExtracted } from '@/lib/text-normalise'

/**
 * HTML → the readable text of a page.
 *
 * Deliberately a regex pass rather than a DOM parser. The output is fed to a
 * language model and shown to a human for review, so structural fidelity buys
 * nothing — what matters is dropping the chrome (nav, script, style, cookie
 * banners) so the model reads the itinerary and not the site menu, and staying
 * dependency-free on a code path that already handles hostile input.
 */

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ',
  ndash: '–', mdash: '—', minus: '−', hellip: '…', bull: '•', middot: '·', sdot: '·',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', sbquo: '‚', bdquo: '„', prime: '′', Prime: '″',
  deg: '°', times: '×', divide: '÷', plusmn: '±', frac12: '½', frac14: '¼', frac34: '¾',
  // Arrows carry the route in an itinerary — "Leh &rarr; Nubra" is the whole line.
  rarr: '→', larr: '←', uarr: '↑', darr: '↓', harr: '↔', rArr: '⇒', lArr: '⇐',
  copy: '©', reg: '®', trade: '™', euro: '€', pound: '£', yen: '¥', cent: '¢',
  eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', uuml: 'ü', ouml: 'ö', auml: 'ä', ntilde: 'ñ',
  aacute: 'á', iacute: 'í', oacute: 'ó', uacute: 'ú', szlig: 'ß', aring: 'å', oslash: 'ø',
  shy: '', zwnj: '', zwj: '', lrm: '', rlm: '',
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
}

function safeCodePoint(n: number): string {
  // Out-of-range or surrogate code points throw; a malformed entity should not
  // take down the import.
  if (!Number.isFinite(n) || n < 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return ''
  return String.fromCodePoint(n)
}

/** The page title, if it has one worth using as a trip name. */
export function htmlTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!m) return null
  const t = decodeEntities(m[1]).replace(/\s+/g, ' ').trim()
  return t || null
}

export function htmlToText(html: string): string {
  let s = html

  // Whole subtrees that are never content.
  // <head> first: otherwise the <title> is emitted as the opening line of the
  // body, and the model reads the site's name as the trip's first day.
  s = s.replace(/<head\b[\s\S]*?<\/head>/i, ' ')
  s = s.replace(/<(script|style|noscript|template|svg|iframe|form|select)\b[\s\S]*?<\/\1>/gi, ' ')
  s = s.replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, ' ')
  s = s.replace(/<!--[\s\S]*?-->/g, ' ')

  // Keep the shape of lists and rows: a day-by-day itinerary is almost always
  // one of them, and collapsing it to a single line loses the day boundaries
  // the extractor depends on.
  s = s.replace(/<\/(p|div|section|article|h[1-6]|li|tr|blockquote)\s*>/gi, '\n')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/t[dh]\s*>/gi, ' · ')
  s = s.replace(/<li\b[^>]*>/gi, '\n- ')

  s = s.replace(/<[^>]+>/g, ' ')
  s = decodeEntities(s)

  return normaliseExtracted(s)
}
