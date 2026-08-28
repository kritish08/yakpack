import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AcceptInvite from '@/components/invite/accept-invite'

export const metadata = { title: 'Trip invite — YakPack' }

interface Props {
  // Next.js 16: params is async.
  params: Promise<{ token: string }>
}

/**
 * Landing page for an invite link.
 *
 * The route sits behind the auth proxy, so an invitee without an account is sent
 * to /login?next=/invite/<token> and returns here once they have signed in or
 * registered. The peek RPC shows who invited them without exposing the trip.
 */
export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).rpc('peek_trip_invite', { p_token: token })
  const invite = (Array.isArray(data) ? data[0] : data) as
    | { trip_name: string; invited_by_name: string; status: string; expired: boolean }
    | undefined

  const problem = !invite
    ? 'This invite link is not valid.'
    : invite.expired
      ? 'This invite has expired. Ask for a fresh link.'
      : invite.status === 'revoked'
        ? 'This invite was cancelled.'
        : invite.status === 'accepted'
          ? null // handled below: re-opening your own accepted link is fine
          : null

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl p-8 w-full max-w-sm shadow-xl border border-border text-center">
        <span className="text-5xl" aria-label="Pemba the yak">🐂</span>

        {problem ? (
          <>
            <h1 className="font-display font-bold text-xl uppercase tracking-tight text-text mt-4">
              Can&apos;t open this invite
            </h1>
            <p className="text-text-muted font-mono text-sm mt-2 leading-relaxed">{problem}</p>
            <Link href="/app" className="mt-6 inline-block font-mono text-sm text-accent hover:underline">
              Go to your trip →
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display font-bold text-xl uppercase tracking-tight text-text mt-4">
              Join {invite!.trip_name}
            </h1>
            <p className="text-text-muted font-body text-sm mt-2 leading-relaxed">
              <span className="text-text">{invite!.invited_by_name}</span> invited you to
              share this trip. You&apos;ll get the same pack list and plan, with your own
              packing progress.
            </p>
            <AcceptInvite token={token} />
          </>
        )}
      </div>
    </div>
  )
}
