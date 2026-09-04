import { describe, it, expect } from 'vitest'
import { todayInZone, formatDay } from '@/lib/local-date'

/**
 * Which day it is decides which leg is "today", whether the trip has started and
 * whether it has ended. toISOString() answers that in UTC — and Vercel runs in
 * UTC — so a traveller in Spiti was shown yesterday's leg until 05:30 every
 * morning, and further east the app is a whole day behind.
 */
describe('todayInZone', () => {
  it('returns an ISO calendar date', () => {
    expect(todayInZone('UTC')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('gives a different day either side of the date line', () => {
    // The bug, expressed as a test: these are the same instant.
    const east = todayInZone('Pacific/Kiritimati')   // UTC+14
    const west = todayInZone('Pacific/Niue')         // UTC-11
    expect(east).not.toBe(west)
    expect(east > west).toBe(true)
  })

  it('agrees with UTC when asked for UTC', () => {
    expect(todayInZone('UTC')).toBe(new Date().toISOString().slice(0, 10))
  })

  it('falls back to the server date rather than throwing on a bad zone', () => {
    // The zone arrives in a cookie, so it is untrusted input.
    const server = new Date().toISOString().slice(0, 10)
    for (const junk of ['Not/AZone', '../../etc', '']) {
      expect(todayInZone(junk)).toBe(server)
    }
  })
})

describe('formatDay', () => {
  it('formats a stored date for display', () => {
    expect(formatDay('2026-06-27')).toBe('Sat 27 Jun')
  })
  it('is the same date wherever it is read', () => {
    // A calendar date is not an instant. An earlier version anchored at midday
    // UTC, which survives \u00b112 and still slipped a day at UTC+14.
    const original = process.env.TZ
    for (const tz of ['Pacific/Kiritimati', 'Pacific/Niue', 'Asia/Kolkata', 'UTC']) {
      process.env.TZ = tz
      expect(formatDay('2026-06-27')).toBe('Sat 27 Jun')
    }
    process.env.TZ = original
  })

  it('returns the raw value for a malformed date', () => {
    expect(formatDay('not-a-date')).toBe('not-a-date')
  })
  it('returns an empty string for no date', () => {
    expect(formatDay(null)).toBe('')
  })
})
