'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getTripContext, listTrips, type TripSummary } from '@/lib/trip'
import { sanitizeText } from '@/lib/sanitize'

export type { TripSummary }

export async function getTrips(): Promise<TripSummary[]> {
  return listTrips()
}

/**
 * Creates a trip and makes it the current one.
 *
 * `copyTemplate` brings the seeded packing list across. The itinerary never
 * copies — another trip's days are not yours — so a new trip starts with an
 * empty plan waiting to be written or imported.
 */
export async function createTrip(name: string, copyTemplate = true): Promise<string> {
  const supabase = await createClient()
  const clean = sanitizeText(name, 80)
  if (!clean) throw new Error('Give the trip a name.')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('create_trip', {
    p_name: clean,
    p_copy_template: copyTemplate,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/app', 'layout')
  return data as string
}

export async function switchTrip(tripId: string): Promise<void> {
  const supabase = await createClient()
  // Membership is validated in SQL, so a crafted id is refused rather than
  // silently selecting a trip whose contents RLS would then hide.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('set_current_trip', { p_trip: tripId })
  if (error) throw new Error(error.message)
  revalidatePath('/app', 'layout')
}

export async function renameTrip(tripId: string, name: string): Promise<void> {
  const ctx = await getTripContext()
  if (!ctx.isOrganiser) throw new Error('Only the organiser can rename a trip.')

  const clean = sanitizeText(name, 80)
  if (!clean) throw new Error('Give the trip a name.')

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('trips') as any)
    .update({ name: clean })
    .eq('id', tripId)
  if (error) throw new Error(error.message)
  revalidatePath('/app', 'layout')
}

/**
 * Deletes a trip and everything in it.
 *
 * Only its creator can, and only if it is not their last one — an account with
 * no trips has nothing to render, and the layout would immediately bootstrap a
 * replacement, which makes "delete" look broken.
 */
export async function deleteTrip(tripId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const trips = await listTrips()
  if (trips.length <= 1) throw new Error('This is your only trip — create another before deleting it.')

  const target = trips.find(t => t.id === tripId)
  if (!target) throw new Error('Trip not found.')
  if (target.memberKey !== 'organiser') throw new Error('Only the organiser can delete a trip.')

  const { error } = await supabase.from('trips').delete().eq('id', tripId).eq('created_by', user.id)
  if (error) throw new Error(error.message)

  // profiles.current_trip_id is ON DELETE SET NULL, so the context falls back on
  // its own; point it somewhere deliberate instead of leaving that to chance.
  const next = trips.find(t => t.id !== tripId)
  if (next) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc('set_current_trip', { p_trip: next.id })
  }
  revalidatePath('/app', 'layout')
}
