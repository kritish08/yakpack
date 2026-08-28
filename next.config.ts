import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV === 'development'

/**
 * Origins the browser is allowed to reach Supabase on.
 *
 * Derived from NEXT_PUBLIC_SUPABASE_URL rather than hardcoded to *.supabase.co,
 * because that pattern silently excludes two real deployments: a local stack on
 * http://127.0.0.1:54321, and a self-hosted Supabase on someone's own domain. In
 * both cases the browser blocks the request and the app reports "Failed to
 * fetch" with no indication that a policy caused it.
 *
 * Realtime needs the websocket scheme for the same host.
 */
function supabaseOrigins(): string[] {
  const fallback = ['https://*.supabase.co', 'wss://*.supabase.co']
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!raw) return fallback
  try {
    const u = new URL(raw)
    const ws = u.protocol === 'https:' ? 'wss:' : 'ws:'
    // Keep the hosted wildcard too: harmless, and covers a build whose env
    // differs from the runtime it is deployed into.
    return [u.origin, `${ws}//${u.host}`, ...fallback]
  } catch {
    return fallback
  }
}

// Content-Security-Policy.
// The browser talks to: our own origin, Supabase (REST + realtime websockets),
// and Vercel analytics. OpenAI, Open-Meteo and the geocoder are called
// server-side only, so they are NOT in connect-src.
//
// One deliberate exception: the BYOK key check calls api.openai.com straight
// from the browser with the user's own key, so that a key is validated without
// ever transiting this server.
// Next.js App Router injects inline scripts/styles for hydration & streaming, so
// 'unsafe-inline' is required without a nonce pipeline. 'unsafe-eval' is only
// needed by the dev HMR runtime.
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://va.vercel-scripts.com`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob:`,
  `font-src 'self' data:`,
  // 'self' does not reliably cover same-origin websockets in every browser, so
  // the dev server's HMR socket is listed explicitly.
  [
    `connect-src 'self'`,
    ...supabaseOrigins(),
    'https://api.openai.com',
    'https://va.vercel-scripts.com',
    'https://vitals.vercel-insights.com',
    ...(isDev ? ['ws://localhost:*', 'ws://127.0.0.1:*', 'http://localhost:*', 'http://127.0.0.1:*'] : []),
  ].join(' '),
  `manifest-src 'self'`,
  `worker-src 'self'`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
  `upgrade-insecure-requests`,
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable powerful features the app doesn't use. The M9 voice layer was
  // never built, so the microphone stays closed too.
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), browsing-topics=(), microphone=()' },
]

const nextConfig: NextConfig = {
  // enable standalone output for Docker self-host
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,

  async headers() {
    return [
      {
        // Apply security headers to every route.
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // The service worker must never be cached so updates ship immediately.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}

export default nextConfig
