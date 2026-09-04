'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Creates the signed-in user's trip from the template.
 *
 * Idempotent by design in SQL — a retried registration returns the existing trip
 * rather than minting a second one.
 */
export async function bootstrapTrip(tripName?: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('create_trip_from_template', {
    p_trip_name: tripName?.trim() || null,
  })
  if (error) throw new Error(error.message)

  // Required, not tidiness. Before this trip existed, /app answered with a
  // redirect to /onboarding, and the client router cached that answer. Pushing
  // to /app afterwards replays the cached redirect and lands the user straight
  // back on onboarding — for ever, because every attempt re-reads the same cache
  // entry. Revalidating the layout is what discards it.
  revalidatePath('/app', 'layout')
}
