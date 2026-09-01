// YakPack service worker — offline-first for a no-signal trip.
//
// Strategy:
//   - RSC navigation payloads: NEVER cached (see isRscRequest below).
//   - App pages (document navigations): network-first, fall back to the last
//     cached copy of that page, then the /offline shell.
//   - Next static assets: cache-first (immutable, hashed names).
//   - Supabase REST reads (GET /rest/v1/*): network-first with cache fallback,
//     so the last-known packing list / itinerary / progress are readable offline.
//   - Supabase auth + realtime, and all writes: network-only (never cached).
//   - Weather: network-first with stale fallback.
//   - Other /api/* (AI etc.): network-only.

const CACHE_VERSION = 'yakpack-v5'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const PAGE_CACHE = `${CACHE_VERSION}-pages`
const DATA_CACHE = `${CACHE_VERSION}-data`
const WEATHER_CACHE = `${CACHE_VERSION}-weather`

// Only the offline fallback is precached. Authenticated pages are cached at
// runtime as the user visits them (precaching them at install risks storing a
// login redirect).
const PRECACHE = ['/offline']

const KEEP = new Set([STATIC_CACHE, PAGE_CACHE, DATA_CACHE, WEATHER_CACHE])

// ── Never run in development ────────────────────────────────────────────────
//
// In production /_next/static/* is content-hashed, so cache-first is safe and
// correct. Under `next dev` those same paths are REUSED across rebuilds: the
// chunk at /_next/static/chunks/app_page.js is different code after every edit,
// at the same URL. Cache-first therefore pins the first build forever while
// navigations keep fetching fresh HTML from the network.
//
// Fresh HTML plus stale chunks means hydration throws and React never mounts —
// a black screen, on an app whose background is #0f0e0c. It gets worse with
// every edit, and no amount of reloading fixes it, because the stale copy is
// exactly what is being served.
//
// A registered worker outlives the mistake, so this cannot be fixed only by
// declining to register: the fix has to come from the worker itself. The browser
// re-checks /sw.js on navigation, so a byte-different file installs, activates,
// wipes every cache and unregisters — after which the page loads normally again.
const DEV_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0'])
const IS_DEV = DEV_HOSTS.has(self.location.hostname) || self.location.hostname.endsWith('.local')

async function selfDestruct() {
  const keys = await caches.keys()
  await Promise.all(keys.map((k) => caches.delete(k)))
  await self.registration.unregister()
  const clients = await self.clients.matchAll({ type: 'window' })
  for (const client of clients) client.navigate(client.url)
}

self.addEventListener('install', (event) => {
  if (IS_DEV) { self.skipWaiting(); return }
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  if (IS_DEV) { event.waitUntil(selfDestruct()); return }
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

// Next.js App Router client-side navigation is NOT a document navigation — it is
// a plain fetch carrying an `RSC: 1` header and a `?_rsc=<hash>` cache-busting
// param, so `request.mode === 'navigate'` is false for it.
//
// These must never be cached:
//   1. `_rsc` is a deterministic hash of the router state (not a nonce), so a
//      cached entry is replayed forever and the screen goes permanently stale
//      even while online — silently defeating revalidatePath().
//   2. When an RSC fetch fails, Next reverts to a full-page (MPA) navigation,
//      which the document-navigation handler below serves from PAGE_CACHE.
//      Letting it fail is exactly what makes offline navigation work.
function isRscRequest(request, url) {
  return request.headers.get('RSC') === '1' || url.searchParams.has('_rsc')
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle GET over http(s). Websockets (realtime) and writes pass through.
  if (request.method !== 'GET') return
  if (!url.protocol.startsWith('http')) return

  // ── RSC navigation payloads: network-only, always ───────────────────────────
  if (IS_DEV) return
  if (isRscRequest(request, url)) return

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

  // ── Next static assets: cache-first (immutable, content-hashed) ──────────────
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // ── Document navigations: network-first → cached page → offline shell ────────
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone()
            putCapped(PAGE_CACHE, request, clone)
          }
          return res
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ||
            (await caches.match(request, { ignoreSearch: true })) ||
            (await caches.match('/offline')) ||
            Response.error()
          )
        })
    )
    return
  }

  // ── Everything else same-origin: network-first, cache only as a fallback ─────
  // Deliberately NOT cache-first: this branch catches dynamic same-origin GETs,
  // and serving those from cache ahead of the network is how stale data creeps in.
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, STATIC_CACHE))
  }
})

// Cap a cache to its most-recent N entries (FIFO) so DATA_CACHE / PAGE_CACHE
// can't grow unbounded over a multi-week trip and get the whole origin evicted.
const CACHE_LIMITS = { [DATA_CACHE]: 80, [PAGE_CACHE]: 30 }
async function putCapped(cacheName, request, response) {
  try {
    const cache = await caches.open(cacheName)
    await cache.put(request, response)
    const limit = CACHE_LIMITS[cacheName]
    if (!limit) return
    const keys = await cache.keys()
    if (keys.length > limit) {
      for (const k of keys.slice(0, keys.length - limit)) await cache.delete(k)
    }
  } catch {
    // Quota exceeded or cache unavailable — never let this reject into the
    // fetch handler and turn a served response into a network error.
  }
}

// network-first: fresh when online, last-known when offline.
async function networkFirst(request, cacheName) {
  try {
    const res = await fetch(request)
    if (res.ok) {
      const clone = res.clone()
      putCapped(cacheName, request, clone)
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
      putCapped(cacheName, request, clone)
    }
    return res
  } catch {
    return Response.error()
  }
}
