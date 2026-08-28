import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Fully public marketing/legal surface. These skip the Supabase session lookup
// entirely — a landing-page view should not cost an auth round-trip.
const PUBLIC_PATHS = new Set(['/', '/terms', '/privacy'])

// Auth screens: reachable signed-out, but bounce to the app when already signed in.
const AUTH_PAGES = ['/login', '/register', '/reset-password']

// Everything that requires a session. Anything not listed here and not public
// falls through untouched (static assets, the auth callback, the manifest).
const PROTECTED_PREFIXES = ['/app', '/invite', '/api/ai', '/api/weather']

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next({ request })

  const isAuthPage = matches(pathname, AUTH_PAGES)
  const isProtected = matches(pathname, PROTECTED_PREFIXES)
  if (!isAuthPage && !isProtected) return NextResponse.next({ request })

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (isAuthPage) {
    // /reset-password is reachable while signed in (that is the point of it).
    if (user && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/app', request.url))
    }
    return supabaseResponse
  }

  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|manifest.webmanifest|sw.js|offline|icons/|landing/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
