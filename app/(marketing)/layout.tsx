import Link from 'next/link'
import type { Metadata } from 'next'
import SiteNav from '@/components/landing/site-nav'
import Reveal from '@/components/landing/reveal'

export const metadata: Metadata = {
  title: 'YakPack — a packing companion for the Spiti Valley',
  description:
    'An offline-first trip companion for two people crossing the Spiti Valley: weather-aware packing, a nine-day plan, and an AI guide you bring your own key for.',
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <SiteNav />
      <main className="flex-1">{children}</main>

      <footer className="border-t border-border mt-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 flex flex-col sm:flex-row gap-6 sm:items-center sm:justify-between">
          <div>
            <p className="font-display font-extrabold text-sm uppercase tracking-[-0.03em] text-text">
              YakPack
            </p>
            <p className="font-mono text-[11px] text-text-dim mt-1">
              Built for one trip. Open sourced for the next one.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs">
            <Link href="/terms" className="text-text-muted hover:text-accent transition-colors">Terms</Link>
            <Link href="/privacy" className="text-text-muted hover:text-accent transition-colors">Privacy</Link>
            <a
              href="https://github.com/kritish08/yakpack"
              className="text-text-muted hover:text-accent transition-colors"
              target="_blank"
              rel="noreferrer noopener"
            >
              Source
            </a>
            <Link href="/login" className="text-text-muted hover:text-accent transition-colors">Log in</Link>
          </nav>
        </div>
      </footer>

      <Reveal />
    </div>
  )
}
