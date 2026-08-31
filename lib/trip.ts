import { createClient } from '@/lib/supabase/server'
import type { Database, MemberKey, TripContact, TripMemberView, TripSummary } from '@/lib/database.types'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Trip = Database['public']['Tables']['trips']['Row']
export type TripMember = Database['public']['Tables']['trip_members']['Row']

/** Slot order for display; also the order invites are handed out in. */
const SLOT_ORDER: MemberKey[] = ['organiser', 'partner_1', 'partner_2']

export interface TripContext {
  userId: string
  tripId: string
  /** Which slot the signed-in user holds *in this trip* — not a global identity. */
  memberKey: MemberKey
  profile: Profile
  trip: Trip
  /** Raw membership rows, for anything that needs user ids. */
  rows: TripMember[]
  /** Everyone in the trip, ordered organiser → partner_1 → partner_2. */
  members: TripMemberView[]
  myName: string
  isOrganiser: boolean
}

/**
 * Resolves the signed-in user and the trip they are currently working in.
 *
 * A user can belong to more than one trip — they own theirs and may be the
 * partner on someone else's — so the trip they own wins, falling back to the
 * oldest membership. Every reader in lib/ goes through here so no query is ever
 * written without a trip filter; RLS enforces the same boundary underneath, but
 * scoping in the query keeps the result correct rather than merely safe.
 *
 * Throws when there is no session or no membership. Callers are behind the auth
 * proxy, and a signed-in user with no trip means registration did not finish —
 * the app layout catches that and sends them back through onboarding.
 */
export async function getTripContext(): Promise<TripContext> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const [profileRes, membershipsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('trip_members').select('*').eq('user_id', user.id).order('created_at'),
  ])

  const profile = profileRes.data as Profile | null
  const memberships = (membershipsRes.data ?? []) as TripMember[]

  // Their explicit selection wins. Falling back to a trip they organise, then to
  // the oldest they were invited to, keeps a stale or cleared selection — a
  // deleted trip sets the column to NULL — from dead-ending the app.
  const mine =
    memberships.find(m => m.trip_id === profile?.current_trip_id) ??
    memberships.find(m => m.member_key === 'organiser') ??
    memberships[0]
  if (!mine) throw new Error('NO_TRIP')

  const [tripRes, membersRes] = await Promise.all([
    supabase.from('trips').select('*').eq('id', mine.trip_id).single(),
    supabase.from('trip_members').select('*').eq('trip_id', mine.trip_id),
  ])
  const trip = tripRes.data as Trip | null
  const members = (membersRes.data ?? []) as TripMember[]
  if (!trip) throw new Error('NO_TRIP')

  const myName = mine.display_name ?? profile?.display_name ?? 'You'

  const view: TripMemberView[] = members
    .slice()
    .sort((a, b) => SLOT_ORDER.indexOf(a.member_key) - SLOT_ORDER.indexOf(b.member_key))
    .map(m => ({
      memberKey: m.member_key,
      displayName: m.user_id === user.id
        ? myName
        : (m.display_name ?? slotLabel(m.member_key)),
      isMe: m.user_id === user.id,
    }))

  return {
    userId: user.id,
    tripId: mine.trip_id,
    memberKey: mine.member_key,
    profile: profile ?? { id: user.id, display_name: 'You', color: 'accent', app_role: 'user', current_trip_id: null, created_at: '' },
    trip,
    rows: members,
    members: view,
    myName,
    isOrganiser: mine.member_key === 'organiser',
  }
}

/** Fallback label for a slot whose holder has not set a display name. */
export function slotLabel(key: MemberKey): string {
  if (key === 'organiser') return 'Organiser'
  return key === 'partner_1' ? 'Partner 1' : 'Partner 2'
}

/**
 * The trip the caller is writing into, for server actions.
 *
 * Actions must never take a trip_id from the client — that would let a crafted
 * request name someone else's trip. RLS would still refuse it, but resolving it
 * server-side means the request fails as a bug rather than as an attack.
 */
export async function getWritableTripId(): Promise<{ tripId: string; memberKey: MemberKey; userId: string }> {
  const { tripId, memberKey, userId } = await getTripContext()
  return { tripId, memberKey, userId }
}

/** Label for a member key, using the trip's own display names. */
export function memberLabel(
  key: MemberKey | 'shared',
  ctx: Pick<TripContext, 'members'>,
): string {
  if (key === 'shared') return 'Everyone'
  return ctx.members.find(m => m.memberKey === key)?.displayName ?? slotLabel(key)
}

/**
 * Returns the caller's trip context, creating their trip first if registration
 * never got that far.
 *
 * Signup and trip creation are two steps, and they can be separated by an email
 * confirmation — so a user can legitimately arrive authenticated with no trip.
 * Rather than dead-ending them, the app layout calls this and the RPC fills the
 * gap. It is idempotent: a user who already owns a trip gets it back unchanged.
 */
export async function ensureTripContext(): Promise<TripContext> {
  try {
    return await getTripContext()
  } catch (err) {
    if ((err as Error).message !== 'NO_TRIP') throw err
  }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('create_trip_from_template', { p_trip_name: null })
  if (error) throw new Error(error.message)

  return getTripContext()
}

/**
 * Every trip the signed-in user belongs to, for the switcher.
 *
 * Counts come from two grouped reads rather than a per-trip query, so adding a
 * twentieth trip does not mean twenty round-trips.
 */
export async function listTrips(): Promise<TripSummary[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const [profileRes, mineRes] = await Promise.all([
    supabase.from('profiles').select('current_trip_id').eq('id', user.id).single(),
    supabase.from('trip_members').select('trip_id, member_key').eq('user_id', user.id).order('created_at'),
  ])

  const currentId = (profileRes.data as { current_trip_id: string | null } | null)?.current_trip_id
  const mine = (mineRes.data ?? []) as { trip_id: string; member_key: MemberKey }[]
  if (mine.length === 0) return []

  const ids = mine.map(m => m.trip_id)
  const [tripsRes, membersRes, legsRes] = await Promise.all([
    supabase.from('trips').select('id, name').in('id', ids),
    supabase.from('trip_members').select('trip_id').in('trip_id', ids),
    supabase.from('itinerary').select('trip_id').in('trip_id', ids),
  ])

  const names = new Map(((tripsRes.data ?? []) as { id: string; name: string }[]).map(t => [t.id, t.name]))
  const tally = (rows: unknown) => {
    const m = new Map<string, number>()
    for (const r of (rows ?? []) as { trip_id: string }[]) m.set(r.trip_id, (m.get(r.trip_id) ?? 0) + 1)
    return m
  }
  const memberCounts = tally(membersRes.data)
  const legCounts = tally(legsRes.data)

  return mine
    .filter(m => names.has(m.trip_id))
    .map(m => ({
      id: m.trip_id,
      name: names.get(m.trip_id)!,
      memberKey: m.member_key,
      isCurrent: m.trip_id === currentId,
      memberCount: memberCounts.get(m.trip_id) ?? 1,
      legCount: legCounts.get(m.trip_id) ?? 0,
    }))
}

/**
 * The trip's contact list — whoever is worth being able to ring from a pass with
 * one bar of signal.
 *
 * Ordered by `sort_order` then creation, so the organiser's arrangement holds
 * and two contacts added at the same position still come back stably.
 */
export async function getTripContacts(tripId: string): Promise<TripContact[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('trip_contacts')
    .select('id, role, name, phone, note, sort_order')
    .eq('trip_id', tripId)
    .order('sort_order')
    .order('created_at')

  type Row = Database['public']['Tables']['trip_contacts']['Row']
  return ((data ?? []) as Row[]).map(c => ({
    id: c.id,
    role: c.role,
    name: c.name,
    phone: c.phone,
    note: c.note,
    sortOrder: c.sort_order,
  }))
}
