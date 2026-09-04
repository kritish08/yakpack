'use client'

/**
 * The root layout itself threw.
 *
 * This is the only boundary that replaces <html> and <body>, so it cannot use
 * the app's providers, fonts or Tailwind tokens — by the time it renders, the
 * layout that would have supplied them is the thing that failed. Everything here
 * is therefore inline and self-contained, which is also why it is deliberately
 * plain: a fallback that depends on the code it is catching is not a fallback.
 */
export default function GlobalError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{
        margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0f0e0c', color: '#f5f0e8',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif', padding: '1rem',
      }}>
        <div style={{ maxWidth: '22rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem' }} aria-hidden="true">🐂</div>
          <h1 style={{ fontSize: '1.25rem', textTransform: 'uppercase', letterSpacing: '-0.02em', margin: '0.75rem 0 0' }}>
            YakPack could not start
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#a8a29a', lineHeight: 1.6, margin: '0.5rem 0 1.25rem' }}>
            Nothing was lost. Reloading usually clears this.
          </p>
          <button
            onClick={reset}
            style={{
              width: '100%', minHeight: 44, borderRadius: 12, border: 'none',
              background: '#d4943a', color: '#0f0e0c', fontWeight: 700,
              textTransform: 'uppercase', fontSize: '0.875rem', cursor: 'pointer',
            }}
          >
            Reload
          </button>
          {error.digest && (
            <p style={{ fontSize: '0.625rem', color: '#6b6862', marginTop: '1rem', fontFamily: 'ui-monospace, monospace' }}>
              Reference {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  )
}
