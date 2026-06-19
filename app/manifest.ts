import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'YakPack — Spiti 2026',
    short_name: 'YakPack',
    description: 'Two-person Spiti trip companion. Haul it like a yak.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f0e0c',
    theme_color: '#d4943a',
    orientation: 'portrait-primary',
    categories: ['travel', 'utilities'],
    icons: [
      { src: '/icons/icon-192.png',          sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png',          sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon.svg',              sizes: 'any',     type: 'image/svg+xml' },
    ],
  }
}
