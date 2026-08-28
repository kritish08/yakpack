'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { byokHeaders, getKey } from '@/lib/byok'

interface Gap {
  title: string
  detail: string
  severity: 'high' | 'medium' | 'low'
  suggested_items?: string[]
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; gaps: Gap[] }
  | { kind: 'no-key' }
  | { kind: 'hidden' }

const sevStyle: Record<string, { dot: string; label: string; cls: string }> = {
  high:   { dot: 'bg-accent-3', label: 'High',   cls: 'text-accent-3 border-accent-3/30 bg-accent-3/10' },
  medium: { dot: 'bg-accent',   label: 'Medium', cls: 'text-accent   border-accent/30   bg-accent/10'   },
  low:    { dot: 'bg-accent-4', label: 'Low',    cls: 'text-accent-4 border-accent-4/30 bg-accent-4/10' },
}

/** Pemba's risk check. Client-fetched for the same BYOK reason as the briefing. */
export default function AiGapsCard() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    if (!getKey()) { setState({ kind: 'no-key' }); return }

    fetch('/api/ai/gaps', { headers: byokHeaders() })
      .then(async res => {
        if (cancelled) return
        if (res.status === 402) { setState({ kind: 'no-key' }); return }
        if (!res.ok) { setState({ kind: 'hidden' }); return }
        const json = await res.json()
        setState({ kind: 'ready', gaps: json?.gaps ?? [] })
      })
      .catch(() => { if (!cancelled) setState({ kind: 'hidden' }) })

    return () => { cancelled = true }
  }, [])

  if (state.kind === 'hidden') return null
  if (state.kind === 'loading') return <AiGapsCardSkeleton />

  if (state.kind === 'no-key') {
    return (
      <section className="bg-surface border border-border rounded-2xl p-4 flex items-start gap-3">
        <span className="text-base shrink-0">🐂</span>
        <p className="font-body text-sm text-text-muted leading-relaxed">
          Add your OpenAI key in{' '}
          <Link href="/app/settings" className="text-accent hover:underline">settings</Link>{' '}
          and Pemba will check this list for gaps.
        </p>
      </section>
    )
  }

  if (state.gaps.length === 0) {
    return (
      <section className="bg-surface border border-accent-2/20 rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <span className="text-base">🐂</span>
          <p className="font-body text-sm text-text">No critical gaps — your kit looks trek-ready.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-surface border border-accent/20 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <span className="text-base">🐂</span>
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent">Pemba&apos;s risk check</p>
      </div>
      <div className="divide-y divide-border/40">
        {state.gaps.map((g, i) => {
          const s = sevStyle[g.severity] ?? sevStyle.medium
          return (
            <div key={i} className="px-4 py-3 flex gap-3 items-start">
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-body text-sm text-text font-medium">{g.title}</p>
                  <span className={`font-mono text-[9px] uppercase tracking-wider border rounded px-1.5 py-0.5 shrink-0 ${s.cls}`}>
                    {s.label}
                  </span>
                </div>
                <p className="font-body text-xs text-text-muted leading-relaxed">{g.detail}</p>
                {g.suggested_items && g.suggested_items.length > 0 && (
                  <p className="font-mono text-[10px] text-text-dim mt-1.5">
                    Suggests: {g.suggested_items.join(', ')}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="px-4 py-2.5 border-t border-border/40 bg-surface-2/30">
        <Link href="/app/ask" className="font-mono text-xs text-accent hover:underline">
          Ask Pemba to add these →
        </Link>
      </div>
    </section>
  )
}

export function AiGapsCardSkeleton() {
  return (
    <section className="bg-surface border border-border rounded-2xl p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base opacity-40">🐂</span>
        <div className="h-3 w-28 bg-border rounded" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-2 h-2 rounded-full bg-border mt-1.5 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-border rounded w-2/3" />
              <div className="h-3 bg-border rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
