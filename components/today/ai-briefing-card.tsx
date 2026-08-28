'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { byokHeaders, getKey } from '@/lib/byok'

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; text: string }
  | { kind: 'no-key' }
  | { kind: 'hidden' }

/**
 * Pemba's morning briefing.
 *
 * Client-side because the OpenAI key is held in the browser and only travels as a
 * per-request header — a server component could never see it. Failures hide the
 * card rather than breaking Today, which stays fully useful without any AI.
 */
export default function AiBriefingCard() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false

    // Storage is browser-only, so the check happens after mount.
    if (!getKey()) { setState({ kind: 'no-key' }); return }

    fetch('/api/ai/briefing', { headers: byokHeaders() })
      .then(async res => {
        if (cancelled) return
        if (res.status === 402) { setState({ kind: 'no-key' }); return }
        if (!res.ok) { setState({ kind: 'hidden' }); return }
        const json = await res.json()
        setState(json?.text ? { kind: 'ready', text: json.text } : { kind: 'hidden' })
      })
      .catch(() => { if (!cancelled) setState({ kind: 'hidden' }) })

    return () => { cancelled = true }
  }, [])

  if (state.kind === 'hidden') return null
  if (state.kind === 'loading') return <AiBriefingCardSkeleton />

  if (state.kind === 'no-key') {
    return (
      <div className="bg-surface border border-border rounded-2xl p-4 flex items-start gap-3">
        <span className="text-base shrink-0">🐂</span>
        <p className="font-body text-sm text-text-muted leading-relaxed">
          Pemba needs your OpenAI key before he can brief you.{' '}
          <Link href="/app/settings" className="text-accent hover:underline">Add one in settings</Link>.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-accent/20 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-base">🐂</span>
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent">Pemba&apos;s take</p>
      </div>
      <p className="font-body text-sm text-text leading-relaxed">{state.text}</p>
      <Link
        href="/app/ask"
        className="mt-3 inline-flex items-center gap-1 font-mono text-xs text-accent hover:underline"
      >
        Ask Pemba more →
      </Link>
    </div>
  )
}

export function AiBriefingCardSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-2xl p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-base opacity-40">🐂</span>
        <div className="h-3 w-24 bg-border rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-border rounded w-full" />
        <div className="h-3 bg-border rounded w-5/6" />
        <div className="h-3 bg-border rounded w-3/4" />
      </div>
    </div>
  )
}
