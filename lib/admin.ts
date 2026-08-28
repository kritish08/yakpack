import 'server-only'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { AppRole, Database } from '@/lib/database.types'

/**
 * The signed-in user's application role.
 *
 * Read through the caller's own session, so it reflects what the database says
 * rather than anything the client asserted. Defaults to 'user' on any failure —
 * an unreadable profile must never grant administration.
 */
export async function getAppRole(): Promise<AppRole> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'user'
    const { data } = await supabase
      .from('profiles')
      .select('app_role')
      .eq('id', user.id)
      .single()
    return (data as { app_role: AppRole } | null)?.app_role === 'admin' ? 'admin' : 'user'
  } catch {
    return 'user'
  }
}

export async function isAdmin(): Promise<boolean> {
  return (await getAppRole()) === 'admin'
}

/** Throws unless the caller is an admin. Every admin action starts here. */
export async function requireAdmin(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  if (!(await isAdmin())) throw new Error('Forbidden — admin only')
  return user.id
}

/**
 * Service-role client. Bypasses RLS and can reach the Auth admin API, so it is
 * only ever constructed after requireAdmin() has passed. `server-only` at the
 * top of this file makes importing it from a client component a build error.
 */
export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return createServiceClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
