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
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', deg: '°', middot: '·', bull: '•', times: '×',
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

  return s
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map(l => l.trim())
    .filter((l, i, arr) => l !== '' || arr[i - 1] !== '')  // no double blanks
    .join('\n')
    .trim()
}
