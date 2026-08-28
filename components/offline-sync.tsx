'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { flushQueue } from '@/lib/offline-queue'

/**
 * App-wide replay of the offline `packed` outbox.
 *
 * Mounted in the authenticated layout rather than on the Pack screen, because
 * toggles queued offline must sync whichever tab the app happens to reopen on —
 * previously the flush only ran if the user navigated to /pack.
 *
 * Runs on mount and on every `online` event. When ops actually land, the server
 * data is now behind, so the RSC payload is refreshed to pull server truth back
 * into the tree.
 */
export default function OfflineSync() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let cancelled = false

    const flush = async () => {
      try {
        const n = await flushQueue(supabase)
        if (n > 0 && !cancelled) router.refresh()
      } catch {
        // Still offline — ops stay queued for the next attempt.
      }
    }

    void flush()
    window.addEventListener('online', flush)
    return () => {
      cancelled = true
      window.removeEventListener('online', flush)
    }
  }, [supabase, router])

  return null
}
