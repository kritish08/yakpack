'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export default function OfflineIndicator() {
  // Start optimistic (online) to avoid a flash before hydration.
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

  if (online) return null

  return (
    <div
      role="status"
      className="fixed top-0 inset-x-0 z-[70] flex items-center justify-center gap-2 bg-accent-3 text-bg py-1.5 px-4"
    >
      <WifiOff size={13} aria-hidden="true" />
      <span className="font-mono text-[11px] uppercase tracking-wider">
        Offline — showing last saved
      </span>
    </div>
  )
}
