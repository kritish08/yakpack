import { describe, it, expect } from 'vitest'
import { safeNext, DEFAULT_NEXT } from '@/lib/safe-next'

/**
 * ?next= is attacker-controlled. `startsWith('/')` is the obvious check and the
 * wrong one: a protocol-relative //evil.com and a backslashed /\\evil.com both
 * pass it and both navigate off-site after login.
 */
describe('safeNext', () => {
  it.each([
    ['//evil.com', 'protocol-relative'],
    ['//evil.com/path', 'protocol-relative with a path'],
    ['/\\evil.com', 'backslash, which browsers normalise to //'],
    ['https://evil.com', 'absolute'],
    ['http://evil.com', 'absolute, insecure'],
    ['javascript:alert(1)', 'script scheme'],
    ['', 'empty'],
  ])('refuses %s (%s) and falls back', raw => {
    expect(safeNext(raw)).toBe(DEFAULT_NEXT)
  })

  it('refuses null and undefined', () => {
    expect(safeNext(null)).toBe(DEFAULT_NEXT)
    expect(safeNext(undefined)).toBe(DEFAULT_NEXT)
  })

  it('allows ordinary in-app paths', () => {
    for (const p of ['/app', '/app/pack', '/app/settings?tab=ai']) {
      expect(safeNext(p)).toBe(p)
    }
  })

  it('honours an explicit fallback', () => {
    expect(safeNext('//evil.com', '/somewhere')).toBe('/somewhere')
  })
})
