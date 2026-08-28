'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, serviceClient } from '@/lib/admin'
import { sanitizeText } from '@/lib/sanitize'
import type { AppRole } from '@/lib/database.types'

export interface ManagedUser {
  id: string
  email: string
  displayName: string
  appRole: AppRole
  createdAt: string
  tripCount: number
  isSelf: boolean
}

/**
 * Every action in this file starts with requireAdmin(). The service-role client
 * bypasses RLS and can reach the Auth admin API, so the gate is the only thing
 * standing between a normal session and full account control — it is never
 * assumed from the client.
 */

export async function listUsers(): Promise<ManagedUser[]> {
  const me = await requireAdmin()
  const svc = serviceClient()

  const { data: authList, error: authErr } = await svc.auth.admin.listUsers({ perPage: 200 })
  if (authErr) throw new Error(authErr.message)

  // The generated Database type collapses to `never` through the service client,
  // so these reads are cast the same way the rest of the codebase does.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data: rawProfiles } = await (svc.from('profiles') as any).select('*')
  const { data: memberships } = await (svc.from('trip_members') as any).select('user_id')
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const profiles = (rawProfiles ?? []) as { id: string; display_name: string; app_role: AppRole }[]

  const byId = new Map(profiles.map(p => [p.id, p]))
  const trips = new Map<string, number>()
  for (const m of (memberships ?? []) as { user_id: string }[]) {
    trips.set(m.user_id, (trips.get(m.user_id) ?? 0) + 1)
  }

  return authList.users.map(u => {
    const p = byId.get(u.id)
    return {
      id: u.id,
      email: u.email ?? '—',
      displayName: p?.display_name ?? u.email?.split('@')[0] ?? 'Unknown',
      appRole: (p?.app_role as AppRole) ?? 'user',
      createdAt: u.created_at ?? '',
      tripCount: trips.get(u.id) ?? 0,
      isSelf: u.id === me,
    }
  }).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function updateUserName(userId: string, displayName: string): Promise<void> {
  await requireAdmin()
  const name = sanitizeText(displayName, 60)
  if (!name) throw new Error('Name cannot be empty.')

  const svc = serviceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('profiles') as any).update({ display_name: name }).eq('id', userId)
  if (error) throw new Error(error.message)
  revalidatePath('/app/settings')
}

export async function setUserPassword(userId: string, password: string): Promise<void> {
  await requireAdmin()
  if (password.length < 8) throw new Error('Password must be at least 8 characters.')

  const svc = serviceClient()
  const { error } = await svc.auth.admin.updateUserById(userId, { password })
  if (error) throw new Error(error.message)
}

export async function setUserRole(userId: string, appRole: AppRole): Promise<void> {
  const me = await requireAdmin()
  // Demoting yourself could leave the deployment with no administrator at all.
  if (userId === me && appRole !== 'admin') {
    throw new Error('You cannot remove your own admin access.')
  }

  const svc = serviceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('profiles') as any).update({ app_role: appRole }).eq('id', userId)
  if (error) throw new Error(error.message)
  revalidatePath('/app/settings')
}

/**
 * Removes an account and everything it owns.
 *
 * Trips they created go first: `created_by` is ON DELETE SET NULL, so deleting
 * the account alone would strand the trip and its items with no members and no
 * owner — invisible to everyone and impossible to clean up through the UI.
 */
export async function deleteUser(userId: string): Promise<void> {
  const me = await requireAdmin()
  if (userId === me) throw new Error('You cannot delete your own account here.')

  const svc = serviceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: tripErr } = await (svc.from('trips') as any)
    .delete()
    .eq('created_by', userId)
    .eq('is_template', false)
  if (tripErr) throw new Error(tripErr.message)

  const { error } = await svc.auth.admin.deleteUser(userId)
  if (error) throw new Error(error.message)
  revalidatePath('/app/settings')
}
