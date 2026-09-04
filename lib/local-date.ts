import 'server-only'
import { cookies } from 'next/headers'

export const TZ_COOKIE = 'yak_tz'

/**
 * Today's date, in the traveller's own timezone.
 *
 * `new Date().toISOString().slice(0, 10)` is UTC, and this app decides real
 * things from it: which day of the itinerary is "today", whether the trip has
 * started, whether it has ended. On Vercel the server runs in UTC, so a
 * traveller in Spiti (UTC+5:30) was shown yesterday's leg until half past five
 * every morning. Further east it is worse — in Kiritimati the app is a whole day
 * behind.
 *
 * The zone comes from a cookie the browser sets from its own
 * Intl.DateTimeFormat().resolvedOptions().timeZone, which is the only party that
 * actually knows. It is untrusted input, so an unusable value falls back to the
 * server's date rather than throwing a page away.
 *
 * `en-CA` because it formats as YYYY-MM-DD, which is what the itinerary stores.
 */
export function todayInZone(timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || undefined,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

export async function localToday(): Promise<string> {
  const tz = (await cookies()).get(TZ_COOKIE)?.value
  return todayInZone(tz ? decodeURIComponent(tz) : undefined)
}

/**
 * "Sat 27 Jun" — for telling someone when their trip ended.
 *
 * Read at midday UTC so the label cannot slip a day either side when it is
 * rendered from a different zone than it was written in.
 */
export function formatDay(date: string | null, timeZone?: string): string {
  if (!date) return ''
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZone || undefined,
      weekday: 'short', day: 'numeric', month: 'short',
    }).format(new Date(date + 'T12:00:00Z'))
  } catch {
    return date
  }
}
