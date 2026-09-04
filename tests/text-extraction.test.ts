import { describe, it, expect } from 'vitest'
import { htmlToText, htmlTitle } from '@/lib/html-text'
import { rejoinHyphenated, tidyLines, normaliseExtracted } from '@/lib/text-normalise'

describe('rejoinHyphenated', () => {
  it('rejoins a word broken by the source wrapping', () => {
    expect(rejoinHyphenated('acclima-\ntisation')).toBe('acclimatisation')
  })
  it('leaves a real hyphenated proper noun alone', () => {
    // Only lowercase-to-lowercase joins, so a name is never invented.
    expect(rejoinHyphenated('Leh-\nLadakh')).toBe('Leh-\nLadakh')
  })
  it('leaves a dash used as punctuation alone', () => {
    expect(rejoinHyphenated('Kaza -\n3,800 m')).toBe('Kaza -\n3,800 m')
  })
})

describe('tidyLines', () => {
  it('collapses horizontal runs and trims', () => {
    expect(tidyLines('  a   b  \n   c ')).toBe('a b\nc')
  })
  it('caps blank runs at one', () => {
    expect(normaliseExtracted('a\n\n\n\nb')).toBe('a\n\nb')
  })
})

describe('htmlToText', () => {
  const page = [
    '<!doctype html><html><head><title>Ladakh Explorer - 6 Days | Wanderlust</title>',
    '<style>.nav{color:red}</style><script>window.x=1</script></head><body>',
    '<nav><a href="/">Home</a></nav>',
    '<article><h2>Ladakh Explorer &ndash; 6 Days</h2>',
    '<table><tr><th>Day</th><th>Route</th></tr>',
    '<tr><td>1</td><td>Arrive Leh</td></tr>',
    '<tr><td>2</td><td>Leh &rarr; Nubra via Khardung&nbsp;La</td></tr></table>',
    '<ul><li>Acclima-',
    'tisation day</li><li>Temperatures &minus;5&deg;C</li>',
    '<li>Caf&eacute; at Diskit &mdash; open 7&ndash;9</li></ul></article>',
    '<footer>&copy; 2027 Wanderlust</footer></body></html>',
  ].join('\n')
  const text = htmlToText(page)

  it('keeps the day rows', () => {
    expect(text).toContain('Arrive Leh')
    expect(text).toContain('Nubra')
  })
  it('keeps day boundaries on separate lines', () => {
    expect(text.split('\n').filter(l => /Leh|Nubra/.test(l).valueOf()).length).toBeGreaterThanOrEqual(2)
  })
  it('drops script, style, nav and footer', () => {
    for (const junk of ['window.x', 'color:red', 'Home', 'Wanderlust']) {
      expect(text).not.toContain(junk)
    }
  })
  it('decodes entities, arrows included', () => {
    // "Leh -> Nubra" is the whole line in an itinerary table.
    expect(text).toContain('Leh \u2192 Nubra')
    expect(text).toContain('\u22125\u00b0C')
    expect(text).toContain('Caf\u00e9')
  })
  it('leaves no raw entities behind', () => {
    expect(text).not.toMatch(/&[a-z]+;/i)
  })
  it('keeps the title out of the body', () => {
    // Otherwise the model reads the site name as day one.
    expect(text).not.toContain('| Wanderlust')
  })
  it('still exposes the title separately', () => {
    expect(htmlTitle(page)).toBe('Ladakh Explorer - 6 Days | Wanderlust')
  })
  it('rejoins hyphen-split words', () => {
    expect(text).toContain('Acclimatisation')
  })
  it('survives malformed markup', () => {
    expect(() => htmlToText('<p>unclosed <b>tags &notreal; <')).not.toThrow()
  })
})
