'use server'

import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/admin'
import { listTrips } from '@/lib/trip'

// Only async exports — a 'use server' module turns every export into a runtime
// binding, and a re-exported type takes the whole file down with it.

/**
 * Everything this account holds, as JSON.
 *
 * Read through the caller's own cookie-bound client, so RLS decides what is
 * theirs. That is the point: an export built with the service role would have to
 * re-implement the ownership rules it is meant to respect, and would leak
 * someone else's trip the first time that re-implementation drifted.
 */
export async function exportMyData(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const trips = await listTrips()
  const ids = trips.map(t => t.id)

  const [profile, categories, items, itinerary, contacts, members] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    ids.length ? supabase.from('categories').select('*').in('trip_id', ids) : null,
    ids.length ? supabase.from('items').select('*').in('trip_id', ids) : null,
    ids.length ? supabase.from('itinerary').select('*').in('trip_id', ids) : null,
    ids.length ? supabase.from('trip_contacts').select('*').in('trip_id', ids) : null,
    ids.length ? supabase.from('trip_members').select('*').in('trip_id', ids) : null,
  ])

  return JSON.stringify({
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email },
    profile: profile?.data ?? null,
    trips,
    categories: categories?.data ?? [],
    items: items?.data ?? [],
    itinerary: itinerary?.data ?? [],
    contacts: contacts?.data ?? [],
    members: members?.data ?? [],
  }, null, 2)
}

/**
 * Deletes the caller's own account.
 *
 * Uses the service role, because removing an auth user needs it — but the id
 * comes from the session and never from an argument, so this cannot be pointed
 * at anybody else. That is the whole safety argument, and it is why there is no
 * userId parameter to be tempted by.
 *
 * Trips the caller organises go with them: `trips.created_by` is ON DELETE SET
 * NULL, so the rows would otherwise survive as ownerless data nobody can reach
 * or remove. Trips they were merely invited to are left alone — those belong to
 * whoever organised them — and only the caller's membership and packing progress
 * are withdrawn.
 */
export async function deleteMyAccount(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = serviceClient()

  const { data: organised } = await admin
    .from('trips').select('id').eq('created_by', user.id)
  const mine = ((organised ?? []) as { id: string }[]).map(t => t.id)

  if (mine.length > 0) {
    // Cascades through categories, items, packed, itinerary, contacts, invites
    // and membership.
    const { error } = await admin.from('trips').delete().in('id', mine)
    if (error) throw new Error(error.message)
  }

  // Packing progress on other people's trips. user_key holds a slot rather than
  // a user id, so leaving these would silently hand this person's check-offs to
  // whoever fills that slot next.
  const { data: others } = await admin
    .from('trip_members').select('trip_id, member_key').eq('user_id', user.id)
  for (const m of (others ?? []) as { trip_id: string; member_key: string }[]) {
    const { data: itemIds } = await admin.from('items').select('id').eq('trip_id', m.trip_id)
    const ids = ((itemIds ?? []) as { id: string }[]).map(i => i.id)
    if (ids.length > 0) {
      await admin.from('packed').delete().in('item_id', ids).eq('user_key', m.member_key)
    }
  }

  const { error: authErr } = await admin.auth.admin.deleteUser(user.id)
  if (authErr) throw new Error(authErr.message)

  await supabase.auth.signOut()
}
