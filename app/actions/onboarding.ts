'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getTripContext } from '@/lib/trip'
import { sanitizeText } from '@/lib/sanitize'
import { CATEGORY_ORDER } from '@/lib/packing-rules'
import type { ItemScope, ItemStatus, NetworkQuality } from '@/lib/database.types'

// Only async exports here — a 'use server' module turns every export into a
// runtime binding, so a re-exported interface takes the whole file down.

export interface OnboardingDay {
  day: number
  date: string | null
  leg: string
  lat: number | null
  lon: number | null
  altitude_m: number | null
  highlights: string | null
  warnings: string | null
  network: NetworkQuality | null
}

export interface OnboardingItem {
  category: string
  name: string
  note?: string | null
  scope: ItemScope
  status: ItemStatus
}

export interface OnboardingContact {
  role: string
  name?: string | null
  phone?: string | null
  note?: string | null
}

export interface NewTripInput {
  name: string
  days?: OnboardingDay[]
  items?: OnboardingItem[]
  contacts?: OnboardingContact[]
}

const MAX_DAYS = 60
const MAX_ITEMS = 200
const MAX_CONTACTS = 20

/**
 * Creates a trip and fills it from whatever the onboarding flow gathered.
 *
 * Every part is optional. Someone importing a PDF arrives with days, items and
 * contacts; someone choosing the manual path may arrive with nothing but a name,
 * and that is a complete, valid trip they can build out later from the app. The
 * flow's job is to get them to a usable screen, not to extract a full plan
 * before letting them in.
 *
 * The trip is created with `p_copy_template = false`. A trip built from a real
 * itinerary must not also inherit someone else's packing list — the list here
 * was derived from *this* route, and merging the two would bury it.
 */
export async function createTripFromOnboarding(input: NewTripInput): Promise<string> {
  const supabase = await createClient()

  const name = sanitizeText(input.name ?? '', 80)
  if (!name) throw new Error('Give the trip a name.')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tripId, error: createErr } = await (supabase as any).rpc('create_trip', {
    p_name: name,
    p_copy_template: false,
  })
  if (createErr) throw new Error(createErr.message)
  const trip = tripId as string

  // create_trip made this the caller's current trip, so context now resolves to
  // it and every write below is scoped by RLS to a trip they organise.
  const ctx = await getTripContext()
  if (ctx.tripId !== trip) throw new Error('Trip was created but could not be opened.')

  // Filling happens in four statements against three tables, and Postgres has
  // no transaction across separate PostgREST calls. If any of them fails, the
  // trip is deleted rather than left half-built: create_trip has already made it
  // the current one, so the alternative is dropping the user into a trip with an
  // itinerary and no packing list and no way to tell that anything went wrong.
  try {
    await writeDays(supabase, trip, input.days ?? [])
    await writeItems(supabase, trip, input.items ?? [], ctx.memberKey)
    await writeContacts(supabase, trip, input.contacts ?? [])
  } catch (e) {
    await supabase.from('trips').delete().eq('id', trip)
    // Point them back at a trip that exists; current_trip_id is ON DELETE SET
    // NULL, so leaving it would resolve to an arbitrary membership.
    const { data: back } = await supabase
      .from('trip_members').select('trip_id').eq('user_id', ctx.userId).limit(1).maybeSingle()
    if (back) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc('set_current_trip', { p_trip: (back as { trip_id: string }).trip_id })
    }
    throw e
  }

  revalidatePath('/app', 'layout')
  return trip
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function writeDays(supabase: any, tripId: string, days: OnboardingDay[]) {
  const rows = days
    .filter(d => Number.isInteger(d.day) && d.day > 0)
    .slice(0, MAX_DAYS)
    .map(d => ({
      trip_id: tripId,
      day: d.day,
      date: d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : null,
      leg: sanitizeText(d.leg, 300) || `Day ${d.day}`,
      lat: typeof d.lat === 'number' ? d.lat : null,
      lon: typeof d.lon === 'number' ? d.lon : null,
      altitude_m: typeof d.altitude_m === 'number' ? Math.round(d.altitude_m) : null,
      highlights: d.highlights ? sanitizeText(d.highlights, 500) : null,
      warnings: d.warnings ? sanitizeText(d.warnings, 500) : null,
      network: d.network,
      carry_today: [],
    }))
  if (rows.length === 0) return

  const { error } = await supabase.from('itinerary').insert(rows)
  if (error) throw new Error(error.message)
}

async function writeItems(supabase: any, tripId: string, items: OnboardingItem[], memberKey: string) {
  const clean = items
    .slice(0, MAX_ITEMS)
    .map(i => ({
      category: sanitizeText(i.category ?? '', 40) || 'Other',
      name: sanitizeText(i.name ?? '', 80),
      note: i.note ? sanitizeText(i.note, 160) : null,
      scope: i.scope === 'each' ? 'each' as const : 'shared' as const,
      status: (['owned', 'to_buy', 'standard'] as const).includes(i.status) ? i.status : 'standard' as const,
    }))
    .filter(i => i.name.length > 0)
  if (clean.length === 0) return

  // Categories, in the order the list itself implies: the known ordering first,
  // anything the model invented after it, each in first-seen order.
  const names = [...new Set(clean.map(i => i.category))]
  names.sort((a, b) => {
    const ra = CATEGORY_ORDER.indexOf(a), rb = CATEGORY_ORDER.indexOf(b)
    if (ra === -1 && rb === -1) return names.indexOf(a) - names.indexOf(b)
    if (ra === -1) return 1
    if (rb === -1) return -1
    return ra - rb
  })

  const { data: cats, error: catErr } = await supabase
    .from('categories')
    .insert(names.map((n, i) => ({ trip_id: tripId, name: n, sort_order: i, icon: null })))
    .select('id, name')
  if (catErr) throw new Error(catErr.message)

  // Keyed by name, never by sort_order — sort_order is not unique within a trip
  // and joining on it fans out into a cartesian product.
  const byName = new Map<string, number>(
    (cats as { id: number; name: string }[]).map(c => [c.name, c.id]),
  )

  const perCategory = new Map<string, number>()
  const itemRows = clean.map(i => {
    const n = perCategory.get(i.category) ?? 0
    perCategory.set(i.category, n + 1)
    return {
      trip_id: tripId,
      category_id: byName.get(i.category)!,
      name: i.name,
      note: i.note,
      qty: null,
      status: i.status,
      assigned_to: 'shared',
      scope: i.scope,
      carry_tags: [],
      sort_order: n,
      is_custom: false,
    }
  })

  const { data: inserted, error: itemErr } = await supabase
    .from('items').insert(itemRows).select('id, scope')
  if (itemErr) throw new Error(itemErr.message)

  // Pre-create packed rows so the first tap is an update. Only the creator's
  // slot exists yet; a partner's rows appear the first time they tap something,
  // because "no row" already means "not packed".
  const packed = (inserted as { id: string; scope: ItemScope }[]).map(i => ({
    item_id: i.id,
    user_key: i.scope === 'each' ? memberKey : 'shared',
    packed: false,
  }))
  if (packed.length > 0) {
    const { error } = await supabase.from('packed').insert(packed)
    if (error) throw new Error(error.message)
  }
}

async function writeContacts(supabase: any, tripId: string, contacts: OnboardingContact[]) {
  const rows = contacts
    .slice(0, MAX_CONTACTS)
    .map((c, i) => ({
      trip_id: tripId,
      role: sanitizeText(c.role ?? '', 60),
      name: c.name ? sanitizeText(c.name, 80) || null : null,
      phone: c.phone ? sanitizeText(c.phone, 40) || null : null,
      note: c.note ? sanitizeText(c.note, 160) || null : null,
      sort_order: i,
    }))
    .filter(c => c.role && (c.name || c.phone))
  if (rows.length === 0) return

  const { error } = await supabase.from('trip_contacts').insert(rows)
  if (error) throw new Error(error.message)
}
