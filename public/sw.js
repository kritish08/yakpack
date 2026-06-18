// YakPack service worker — offline-first for a no-signal trip.
//
// Strategy:
//   - App pages (navigations): network-first, fall back to the last cached copy
//     of that page, then any cached page, then the /offline shell.
//   - Next static assets: cache-first (immutable, hashed names).
//   - Supabase REST reads (GET /rest/v1/*): network-first with cache fallback,
//     so the last-known packing list / itinerary / progress are readable offline.
//   - Supabase auth + realtime, and all writes: network-only (never cached).
//   - Weather: network-first with stale fallback.
//   - Other /api/* (AI etc.): network-only.

const CACHE_VERSION = 'yakpack-v2'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const PAGE_CACHE = `${CACHE_VERSION}-pages`
const DATA_CACHE = `${CACHE_VERSION}-data`
const WEATHER_CACHE = `${CACHE_VERSION}-weather`

// Only the offline fallback is precached. Authenticated pages are cached at
// runtime as the user visits them (precaching them at install risks storing a
// login redirect).
const PRECACHE = ['/offline']

const KEEP = new Set([STATIC_CACHE, PAGE_CACHE, DATA_CACHE, WEATHER_CACHE])

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// Allow the page to trigger an immediate activation of a waiting worker.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

function isSupabase(url) {
  return url.hostname.endsWith('.supabase.co')
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle GET over http(s). Websockets (realtime) and writes pass through.
  if (request.method !== 'GET') return
  if (!url.protocol.startsWith('http')) return

  // ── Supabase ────────────────────────────────────────────────────────────────
  if (isSupabase(url)) {
    // Only cache data reads. Never touch auth/token/realtime endpoints.
    if (url.pathname.startsWith('/rest/v1/')) {
      event.respondWith(networkFirst(request, DATA_CACHE))
    }
    // auth/realtime/storage: network-only (default passthrough)
    return
  }

  // ── Weather proxy: network-first, stale acceptable ───────────────────────────
  if (url.pathname.startsWith('/api/weather')) {
    event.respondWith(networkFirst(request, WEATHER_CACHE))
    return
  }

  // ── Other API routes (AI, auth callback): network-only ───────────────────────
  if (url.pathname.startsWith('/api/')) return

  // ── Next static assets: cache-first ──────────────────────────────────────────
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // ── Page navigations: network-first with cached-page → offline fallback ──────
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(PAGE_CACHE).then((c) => c.put(request, clone))
          }
          return res
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ||
            (await caches.match('/offline')) ||
            Response.error()
          )
        })
    )
    return
  }

  // ── Everything else same-origin: try cache, then network ─────────────────────
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
  }
})

// network-first: fresh when online, last-known when offline.
async function networkFirst(request, cacheName) {
  try {
    const res = await fetch(request)
    if (res.ok) {
      const clone = res.clone()
      caches.open(cacheName).then((c) => c.put(request, clone))
    }
    return res
  } catch {
    const cached = await caches.match(request)
    return cached || Response.error()
  }
}

// cache-first: serve cache, populate on miss.
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const res = await fetch(request)
    if (res.ok) {
      const clone = res.clone()
      caches.open(cacheName).then((c) => c.put(request, clone))
    }
    return res
  } catch {
    return Response.error()
  }
}
