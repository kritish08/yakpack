const CACHE_VERSION = 'yakpack-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`

const PRECACHE = ['/', '/pack', '/to-buy', '/plan', '/offline']

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
      .then((keys) => Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Non-GET and non-http: pass through
  if (request.method !== 'GET') return
  if (!url.protocol.startsWith('http')) return

  // Supabase (auth + realtime + DB): always network — never cache credentials
  if (url.hostname.includes('supabase.co')) return

  // Weather proxy: network-first, stale fallback is acceptable
  if (url.pathname.startsWith('/api/weather')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(DYNAMIC_CACHE).then((c) => c.put(request, clone))
          }
          return res
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Other API routes: network-only
  if (url.pathname.startsWith('/api/')) return

  // _next/static assets: cache-first (immutable, hashed filenames)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone()
              caches.open(STATIC_CACHE).then((c) => c.put(request, clone))
            }
            return res
          })
      )
    )
    return
  }

  // Pages: network-first, cache fallback, then offline page
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(DYNAMIC_CACHE).then((c) => c.put(request, clone))
        }
        return res
      })
      .catch(async () => {
        const cached = await caches.match(request)
        return cached ?? (await caches.match('/offline')) ?? Response.error()
      })
  )
})
