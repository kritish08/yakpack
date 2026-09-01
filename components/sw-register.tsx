'use client'

import { useEffect } from 'react'

export default function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Never in development. Under `next dev` the /_next/static/* chunk paths are
    // reused across rebuilds, so the worker's cache-first rule pins stale code at
    // a live URL and hydration dies — see the comment in public/sw.js. Anything
    // already registered from an earlier run is torn down here as well, so a
    // browser that picked one up recovers on its next load.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations()
        .then(regs => Promise.all(regs.map(r => r.unregister())))
        .then(() => caches?.keys?.())
        .then(keys => Promise.all((keys ?? []).map(k => caches.delete(k))))
        .catch(() => {})
      return
    }

    let reloading = false
    // When a new SW takes control, reload once so the user gets fresh assets.
    const onControllerChange = () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Check for an updated worker on load.
        reg.update().catch(() => {})
        // If one is already waiting, activate it.
        if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING')
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              installing.postMessage('SKIP_WAITING')
            }
          })
        })
      })
      .catch(() => {
        // SW registration failing shouldn't break the app.
      })

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  return null
}
