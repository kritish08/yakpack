'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getTripContext } from '@/lib/trip'
import { PARTNER_KEYS } from '@/lib/database.types'
import type { MemberKey } from '@/lib/database.types'

export interface PendingInvite {
  id: string
  memberKey: 'partner_1' | 'partner_2' | 'partner_3'
  email: string | null
  token: string
  expiresAt: string
}

export interface PartnerRow {
  memberKey: MemberKey
  displayName: string
  isMe: boolean
}

export interface PartnersState {
  members: PartnerRow[]
  invites: PendingInvite[]
  canInvite: boolean
  isOrganiser: boolean
}

/**
 * Everything the Partners panel needs.
 *
 * A slot counts as taken by a member *or* by a live invite, which is what stops
 * an organiser from issuing three links and overfilling the trip.
 */
export async function getPartnersState(): Promise<PartnersState> {
  const ctx = await getTripContext()
  const supabase = await createClient()

  const { data } = await supabase
    .from('trip_invites')
    .select('id, member_key, email, token, expires_at, status')
    .eq('trip_id', ctx.tripId)
    .eq('status', 'pending')

  const invites: PendingInvite[] = ((data ?? []) as {
    id: string; member_key: 'partner_1' | 'partner_2' | 'partner_3'; email: string | null; token: string; expires_at: string
  }[]).map(i => ({
    id: i.id, memberKey: i.member_key, email: i.email, token: i.token, expiresAt: i.expires_at,
  }))

  const partnersPresent = ctx.members.filter(m => m.memberKey !== 'organiser').length
  return {
    members: ctx.members,
    invites,
    // Against the number of partner slots that exist, not a number typed here.
    // This read 2 while the database allowed 3, so the last slot was unreachable:
    // the UI said the trip was full while create_trip_invite would happily have
    // filled it.
    canInvite: ctx.isOrganiser && partnersPresent + invites.length < PARTNER_KEYS.length,
    isOrganiser: ctx.isOrganiser,
  }
}

/**
 * Creates an invite and returns its token; the caller shares the link.
 *
 * The trip comes from the session, never from an argument. It used to come from
 * neither: the function picked the caller's first organiser membership, which
 * was the active trip only by coincidence once an account could organise more
 * than one — so the panel could show one trip's free slots while the link went
 * into another, and revokeInvite (trip-scoped) could not cancel it.
 */
export async function createInvite(email?: string): Promise<{ token: string }> {
  const ctx = await getTripContext()
  if (!ctx.isOrganiser) throw new Error('Only the trip organiser can invite partners.')

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('create_trip_invite', {
    p_trip_id: ctx.tripId,
    p_email: email?.trim() || null,
  })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.token) throw new Error('Could not create the invite.')
  revalidatePath('/app/settings')
  return { token: row.token as string }
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const ctx = await getTripContext()
  if (!ctx.isOrganiser) throw new Error('Only the trip organiser can cancel invites.')

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('trip_invites') as any)
    .update({ status: 'revoked' })
    .eq('id', inviteId)
    .eq('trip_id', ctx.tripId)
  if (error) throw new Error(error.message)
  revalidatePath('/app/settings')
}

/**
 * Removes a partner from the trip.
 *
 * Their packed rows are deleted too: `packed.user_key` holds a slot, not a user
 * id, so leaving them behind would silently transfer their progress to whoever
 * fills that slot next.
 */
export async function removePartner(memberKey: MemberKey): Promise<void> {
  const ctx = await getTripContext()
  if (!ctx.isOrganiser) throw new Error('Only the trip organiser can remove a partner.')
  if (memberKey === 'organiser') throw new Error('The organiser cannot be removed from their own trip.')

  const supabase = await createClient()

  const { data: itemRows } = await supabase.from('items').select('id').eq('trip_id', ctx.tripId)
  const itemIds = ((itemRows ?? []) as { id: string }[]).map(i => i.id)
  if (itemIds.length > 0) {
    await supabase.from('packed').delete().eq('user_key', memberKey).in('item_id', itemIds)
  }

  const { error } = await supabase
    .from('trip_members')
    .delete()
    .eq('trip_id', ctx.tripId)
    .eq('member_key', memberKey)
  if (error) throw new Error(error.message)

  revalidatePath('/app/settings')
  revalidatePath('/app/pack')
}

/** Accepts an invite on behalf of the signed-in user. */
export async function acceptInvite(token: string): Promise<void> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('accept_trip_invite', { p_token: token })
  if (error) throw new Error(error.message)
}
