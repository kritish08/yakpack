import Link from 'next/link'

export const metadata = { title: 'Not found — YakPack' }

/** A mistyped or stale URL. Cheap to provide, and the alternative is a blank page. */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <span className="text-4xl" aria-hidden="true">🐂</span>
        <h1 className="font-display font-bold text-xl uppercase tracking-tight text-text mt-3">
          Nothing here
        </h1>
        <p className="font-body text-sm text-text-muted leading-relaxed mt-2">
          That page does not exist. It may have moved, or the link may be old.
        </p>
        <div className="flex flex-col gap-2 mt-5">
          <Link
            href="/app"
            className="w-full py-3 rounded-xl bg-accent text-bg font-display font-bold uppercase tracking-tight text-sm min-h-[44px] flex items-center justify-center"
          >
            Go to your trip
          </Link>
          <Link
            href="/"
            className="w-full py-3 rounded-xl border border-border text-text-muted font-body text-sm min-h-[44px] flex items-center justify-center"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
