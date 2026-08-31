'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getTripContacts, getTripContext } from '@/lib/trip'
import { sanitizeText } from '@/lib/sanitize'
import type { TripContact } from '@/lib/database.types'

// No `export type` in this file. A 'use server' module may export only async
// functions — the loader turns every export into a runtime binding, so a
// re-exported type becomes a ReferenceError that takes the whole module down.

/** A trip's contacts have to fit on a phone screen, and this is already generous. */
const MAX_CONTACTS = 20

/**
 * Phone numbers are stored as typed, not normalised.
 *
 * They end up in a `tel:` href, and the set of things that legitimately belong
 * in one is wider than it looks: `+`, spaces, hyphens, parentheses, and `,`/`;`
 * for extension pauses. Stripping to digits breaks international dialling for
 * no security gain — the sanitiser has already removed control characters, which
 * is the part that could smuggle something into an AI prompt.
 */
function cleanPhone(raw: string): string {
  return sanitizeText(raw, 40)
}

async function organiserTrip(): Promise<string> {
  const ctx = await getTripContext()
  if (!ctx.isOrganiser) throw new Error('Only the organiser can edit trip contacts.')
  return ctx.tripId
}

export async function listContacts(): Promise<TripContact[]> {
  const { tripId } = await getTripContext()
  return getTripContacts(tripId)
}

export async function addContact(input: {
  role: string
  name?: string
  phone?: string
  note?: string
}): Promise<void> {
  const tripId = await organiserTrip()

  const role = sanitizeText(input.role, 60)
  if (!role) throw new Error('Give the contact a role — “Driver”, “Homestay”, “Insurance”.')

  const name  = sanitizeText(input.name  ?? '', 80)
  const phone = cleanPhone(input.phone ?? '')
  const note  = sanitizeText(input.note  ?? '', 160)
  if (!name && !phone) throw new Error('A contact needs a name or a number.')

  const supabase = await createClient()

  const existing = await getTripContacts(tripId)
  if (existing.length >= MAX_CONTACTS) {
    throw new Error(`A trip can hold ${MAX_CONTACTS} contacts.`)
  }
  // Append: one past the current tail, so a new contact lands at the bottom
  // rather than colliding with whatever already sits at position 0.
  const sortOrder = existing.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('trip_contacts') as any).insert({
    trip_id: tripId,
    role,
    name:  name  || null,
    phone: phone || null,
    note:  note  || null,
    sort_order: sortOrder,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/app/plan')
  revalidatePath('/app/settings')
}

export async function updateContact(id: string, input: {
  role: string
  name?: string
  phone?: string
  note?: string
}): Promise<void> {
  const tripId = await organiserTrip()

  const role = sanitizeText(input.role, 60)
  if (!role) throw new Error('Give the contact a role.')

  const name  = sanitizeText(input.name  ?? '', 80)
  const phone = cleanPhone(input.phone ?? '')
  const note  = sanitizeText(input.note  ?? '', 160)
  if (!name && !phone) throw new Error('A contact needs a name or a number.')

  const supabase = await createClient()
  // Scoped to the resolved trip as well as the id: RLS already refuses another
  // trip's row, but matching on both means a wrong id fails as a no-op rather
  // than reaching a policy check at all.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('trip_contacts') as any)
    .update({ role, name: name || null, phone: phone || null, note: note || null })
    .eq('id', id)
    .eq('trip_id', tripId)
  if (error) throw new Error(error.message)

  revalidatePath('/app/plan')
  revalidatePath('/app/settings')
}

export async function deleteContact(id: string): Promise<void> {
  const tripId = await organiserTrip()

  const supabase = await createClient()
  const { error } = await supabase
    .from('trip_contacts')
    .delete()
    .eq('id', id)
    .eq('trip_id', tripId)
  if (error) throw new Error(error.message)

  revalidatePath('/app/plan')
  revalidatePath('/app/settings')
}
