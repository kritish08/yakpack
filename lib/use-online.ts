'use client'

import { useEffect, useState } from 'react'

/**
 * Whether the browser currently believes it has a connection.
 *
 * Starts optimistic and corrects after mount, deliberately: `navigator` does not
 * exist during the server render, and guessing "offline" would flash an offline
 * notice at every user on every first paint.
 *
 * `navigator.onLine` only knows whether there is *a* network, not whether
 * anything is reachable across it — a hotel portal or a pass with one dead bar
 * both report true. So this is used to explain a failure that already happened,
 * never to decide whether to attempt one.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  return online
}
