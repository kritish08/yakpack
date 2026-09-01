import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/lib/database.types'

/**
 * `fresh` opts this client out of React's per-render fetch memoization.
 *
 * Within one render pass React dedupes identical fetches, which is normally
 * exactly what you want — every screen reader resolves the same trip context
 * without repeating the query. It is wrong in one place: after the signup
 * bootstrap writes a trip, re-reading membership through the memoized query
 * returns the *pre-bootstrap* empty result that triggered the write in the first
 * place, and the caller concludes the user still has no trip.
 *
 * A unique header per request changes the memo key, so the retry actually hits
 * Postgres. Used only on that retry; everywhere else the deduplication stands.
 */
export async function createClient(opts?: { fresh?: boolean }) {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(opts?.fresh
        ? {
            global: {
              fetch: (input: RequestInfo | URL, init?: RequestInit) => {
                // Headers must be copied through a Headers instance. Spreading
                // init.headers with `...` yields {} when it is already a Headers
                // object, which silently drops apikey and Authorization — the
                // request then runs anonymously and RLS returns nothing, which
                // reads exactly like "this user has no trip".
                const headers = new Headers(init?.headers)
                headers.set('x-yak-fresh', crypto.randomUUID())
                return fetch(input, { ...init, cache: 'no-store', headers })
              },
            },
          }
        : {}),
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {} // server component — ignore
        },
      },
    },
  )
}
