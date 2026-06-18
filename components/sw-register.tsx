'use client'

import { useEffect } from 'react'

export default function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

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
