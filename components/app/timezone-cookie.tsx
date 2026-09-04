'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Tells the server which timezone the traveller is actually in.
 *
 * The server cannot know: on Vercel it runs in UTC, and the trip's own location
 * is not the same thing as where the person holding the phone is standing. So
 * the browser reports its zone once, and every "is today day 4 yet" question is
 * answered against it.
 *
 * Refreshes only when the value changes — on first visit, and again if someone
 * crosses into a new zone mid-trip, which for this app is a normal Tuesday.
 * Refreshing unconditionally would loop.
 */
export default function TimezoneCookie() {
  const router = useRouter()

  useEffect(() => {
    let tz = ''
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    } catch {
      return
    }
    if (!tz) return

    const current = document.cookie
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('yak_tz='))
      ?.slice('yak_tz='.length)

    if (current && decodeURIComponent(current) === tz) return

    document.cookie = `yak_tz=${encodeURIComponent(tz)};path=/;max-age=31536000;SameSite=Lax`
    router.refresh()
  }, [router])

  return null
}
