'use client'

import { useEffect } from 'react'

/**
 * Reveals every [data-reveal] element once it scrolls into view.
 *
 * One observer for the whole page rather than a wrapper component per section,
 * so sections stay server-rendered and the markup stays readable. Elements are
 * revealed permanently — this is a page-load flourish, not a scroll toy.
 */
export default function Reveal() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (nodes.length === 0) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || !('IntersectionObserver' in window)) {
      nodes.forEach(n => { n.dataset.reveal = 'shown' })
      return
    }

    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          ;(e.target as HTMLElement).dataset.reveal = 'shown'
          io.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.1 },
    )
    nodes.forEach(n => io.observe(n))
    return () => io.disconnect()
  }, [])

  return null
}
