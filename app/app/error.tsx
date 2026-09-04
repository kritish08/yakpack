'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { RotateCw } from 'lucide-react'

/**
 * Something inside the app threw.
 *
 * Without this file Next renders its own bare "Application error: a client-side
 * exception has occurred", which tells a traveller nothing and offers no way
 * back. The two things worth giving them are a retry — most failures here are a
 * lost connection on a mountain road, and retrying genuinely works — and a route
 * out of whichever screen broke.
 *
 * The message itself is deliberately not shown. In production Next replaces it
 * with a digest anyway, and an unfiltered error string is exactly where internal
 * detail leaks.
 */
export default function AppError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[yakpack] screen failed:', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <span className="text-4xl" aria-hidden="true">🐂</span>
        <h1 className="font-display font-bold text-xl uppercase tracking-tight text-text mt-3">
          That screen fell over
        </h1>
        <p className="font-body text-sm text-text-muted leading-relaxed mt-2">
          Your packing list is safe — nothing was lost. This is usually a dropped
          connection, so trying again often works.
        </p>

        <div className="flex flex-col gap-2 mt-5">
          <button
            onClick={reset}
            className="w-full py-3 rounded-xl bg-accent text-bg font-display font-bold uppercase tracking-tight text-sm flex items-center justify-center gap-2 min-h-[44px]"
          >
            <RotateCw size={15} aria-hidden="true" /> Try again
          </button>
          <Link
            href="/app"
            className="w-full py-3 rounded-xl border border-border text-text-muted font-body text-sm min-h-[44px] flex items-center justify-center"
          >
            Back to Today
          </Link>
        </div>

        {error.digest && (
          <p className="font-mono text-[10px] text-text-dim mt-4">
            Reference {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
