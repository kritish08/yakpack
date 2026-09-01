/**
 * Tidying extracted text without changing what it says.
 *
 * Shared by the PDF and HTML paths because they arrive with the same two
 * problems from different causes: pdf.js emits one string per text run, so a
 * two-column brochure comes out ragged, and an HTML page carries the wrapping
 * its own layout happened to need. Both produce words split across lines and
 * runs of blank space, and both cost tokens and confuse the day-boundary
 * detection the extractor depends on.
 */

/**
 * Rejoins a word broken across a line by the source's wrapping — "acclima-\n
 * tisation". Deliberately only when a lowercase letter sits on both sides:
 * "Kaza - 3,800 m" and "Leh-\nLadakh" as a real hyphenated proper noun are left
 * alone, because joining those would invent a word that is not in the source.
 */
export function rejoinHyphenated(s: string): string {
  return s.replace(/([a-z])-[^\S\n]*\n[^\S\n]*([a-z])/g, '$1$2')
}

/** Collapses horizontal runs, trims every line, and caps blank runs at one. */
export function tidyLines(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/­/g, '')        // soft hyphens
    .replace(/[^\S\n]+/g, ' ')
    .split('\n')
    .map(l => l.trim())
    .filter((l, i, a) => l !== '' || a[i - 1] !== '')
    .join('\n')
    .trim()
}

/** The full pass: rejoin first, because tidying would erase the line break. */
export function normaliseExtracted(s: string): string {
  return tidyLines(rejoinHyphenated(s.replace(/\r\n?/g, '\n')))
}
