'use client'

import { useEffect, useState, useTransition } from 'react'
import { UserPlus, Copy, Check, X, Loader2, Users } from 'lucide-react'
import {
  getPartnersState, createInvite, revokeInvite, removePartner,
  type PartnersState,
} from '@/app/actions/invites'
import type { MemberKey } from '@/lib/database.types'

const SLOT_TEXT: Record<MemberKey, string> = {
  organiser: 'text-accent',
  partner_1: 'text-accent-4',
  partner_2: 'text-accent-2',
}

function slotName(key: MemberKey) {
  return key === 'organiser' ? 'Organiser' : key === 'partner_1' ? 'Partner 1' : 'Partner 2'
}

/**
 * Invite up to two partners into this trip.
 *
 * There is no mail provider wired in, so an invite produces a link the organiser
 * shares themselves. Saying so plainly beats a "sent!" toast for an email that
 * was never sent.
 */
export default function PartnersSection() {
  const [state, setState] = useState<PartnersState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    getPartnersState().then(setState).catch(e => setError(e.message))
  }, [])

  function run(fn: () => Promise<unknown>) {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
        setState(await getPartnersState())
        setEmail('')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.')
      }
    })
  }

  async function copy(token: string) {
    const link = `${window.location.origin}/invite/${token}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(token)
      setTimeout(() => setCopied(null), 2500)
    } catch {
      // Clipboard can be blocked; show the link so it can be copied by hand.
      setError(link)
    }
  }

  const partners = state?.members.filter(m => m.memberKey !== 'organiser') ?? []

  return (
    <section>
      <h2 className="font-display font-bold text-sm uppercase tracking-tight text-text mb-1">
        Partners
      </h2>
      <p className="font-body text-xs text-text-muted leading-relaxed mb-3">
        Up to two people can share this trip. Shared items are carried once between
        you; personal items are tracked separately for each person.
      </p>

      <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3">
        {!state && !error && <p className="font-mono text-xs text-text-dim">Loading…</p>}

        {state?.members.map(m => (
          <div key={m.memberKey} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-body text-sm text-text truncate">
                {m.displayName}
                {m.isMe && <span className="ml-1.5 font-mono text-[10px] text-accent">you</span>}
              </p>
              <p className={`font-mono text-[10px] ${SLOT_TEXT[m.memberKey]}`}>{slotName(m.memberKey)}</p>
            </div>
            {state.isOrganiser && m.memberKey !== 'organiser' && (
              <button
                disabled={pending}
                onClick={() => {
                  if (window.confirm(`Remove ${m.displayName} from this trip? Their packing progress is deleted.`)) {
                    run(() => removePartner(m.memberKey))
                  }
                }}
                className="shrink-0 font-mono text-[11px] text-text-muted hover:text-accent-3 transition-colors min-h-[44px] px-2"
              >Remove</button>
            )}
          </div>
        ))}

        {state?.invites.map(inv => (
          <div key={inv.id} className="flex items-center justify-between gap-3 border-t border-border/50 pt-3">
            <div className="min-w-0">
              <p className="font-body text-sm text-text-muted truncate">
                {inv.email || 'Invite link'}
              </p>
              <p className="font-mono text-[10px] text-text-dim">
                {slotName(inv.memberKey)} · awaiting acceptance
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => copy(inv.token)}
                aria-label="Copy invite link"
                className="p-2 text-text-dim hover:text-accent transition-colors min-h-[44px] min-w-[36px] flex items-center justify-center"
              >{copied === inv.token ? <Check size={14} className="text-accent-2" /> : <Copy size={14} />}</button>
              {state.isOrganiser && (
                <button
                  disabled={pending}
                  onClick={() => run(() => revokeInvite(inv.id))}
                  aria-label="Cancel invite"
                  className="p-2 text-text-dim hover:text-accent-3 transition-colors min-h-[44px] min-w-[36px] flex items-center justify-center"
                ><X size={14} /></button>
              )}
            </div>
          </div>
        ))}

        {state?.isOrganiser && state.canInvite && (
          <div className="border-t border-border/50 pt-3 flex flex-col gap-2">
            <p className="font-mono text-[10px] text-text-dim leading-relaxed">
              Creates a link you send them yourself — no email is sent from here.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Their email (optional, for your reference)"
                aria-label="Partner email"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
              />
              <button
                disabled={pending}
                onClick={() => run(() => createInvite(email))}
                className="shrink-0 flex items-center gap-1.5 px-3 rounded-lg bg-accent text-bg font-display font-bold text-xs uppercase disabled:opacity-40 min-h-[44px]"
              >
                {pending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                Invite
              </button>
            </div>
          </div>
        )}

        {state && !state.canInvite && state.isOrganiser && (
          <p className="font-mono text-[11px] text-text-dim border-t border-border/50 pt-3 flex items-center gap-1.5">
            <Users size={12} /> This trip is full — two partners is the limit.
          </p>
        )}

        {state && !state.isOrganiser && (
          <p className="font-mono text-[11px] text-text-dim border-t border-border/50 pt-3">
            Only the organiser can invite or remove partners.
          </p>
        )}

        {error && <p className="font-mono text-xs text-accent-3 break-all">{error}</p>}
      </div>
    </section>
  )
}
