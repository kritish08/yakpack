'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * Sits transparent over the hero photograph and picks up a blurred backing once
 * the page scrolls, so the header never competes with the image at rest but
 * stays legible over content.
 */
export default function SiteNav() {
  const [solid, setSolid] = useState(false)

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${
        solid ? 'bg-bg/85 backdrop-blur-md border-b border-border' : 'bg-transparent border-b border-transparent'
      }`}
    >
      <nav
        aria-label="Site"
        className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between gap-4"
      >
        <Link href="/" className="flex items-baseline gap-2 group">
          <span className="font-display font-extrabold text-lg uppercase tracking-[-0.03em] text-text">
            YakPack
          </span>
          <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim group-hover:text-accent transition-colors">
            Spiti
          </span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <Link
            href="/login"
            className="font-mono text-xs text-text-muted hover:text-text transition-colors px-3 py-2 min-h-[44px] flex items-center"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="font-display font-bold text-xs uppercase tracking-tight bg-accent text-bg px-4 py-2.5 rounded-xl hover:brightness-110 active:scale-95 transition-all min-h-[44px] flex items-center"
          >
            Create account
          </Link>
        </div>
      </nav>
    </header>
  )
}
