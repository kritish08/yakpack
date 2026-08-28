'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Loader2, Plus, Users } from 'lucide-react'
import { createTrip, switchTrip, type TripSummary } from '@/app/actions/trips'

/**
 * Current trip, and a way to change it.
 *
 * Sits in the header rather than the bottom bar: switching trips is occasional,
 * and the tab bar already carries five destinations. The current name is always
 * visible because every screen below it is scoped to that trip — without it,
 * two trips with similar lists are indistinguishable.
 */
export default function TripSwitcher({ trips, currentName }: { trips: TripSummary[]; currentName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  // Dismiss on outside click and on Escape — a header popover that traps focus
  // on mobile is worse than no popover.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setCreating(false) }
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setCreating(false) } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function choose(id: string) {
    setError(null)
    startTransition(async () => {
      try {
        await switchTrip(id)
        setOpen(false)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not switch trip.')
      }
    })
  }

  function make() {
    setError(null)
    startTransition(async () => {
      try {
        await createTrip(name)
        setName(''); setCreating(false); setOpen(false)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not create the trip.')
      }
    })
  }

  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1 max-w-[46vw] sm:max-w-none group"
      >
        <span className="font-body text-xs text-text-muted truncate group-hover:text-text transition-colors">
          {currentName}
        </span>
        <ChevronDown size={12} className={`shrink-0 text-text-dim transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-2 w-64 max-w-[80vw] bg-surface border border-border rounded-xl shadow-xl overflow-hidden z-[60]"
        >
          <div className="max-h-[50vh] overflow-y-auto divide-y divide-border/40">
            {trips.map(t => (
              <button
                key={t.id}
                role="menuitem"
                disabled={pending}
                onClick={() => t.isCurrent ? setOpen(false) : choose(t.id)}
                className="w-full text-left px-3 py-2.5 hover:bg-surface-2 transition-colors flex items-start gap-2 disabled:opacity-50"
              >
                <span className="w-4 shrink-0 pt-0.5">
                  {t.isCurrent && <Check size={13} className="text-accent" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block font-body text-sm truncate ${t.isCurrent ? 'text-accent' : 'text-text'}`}>
                    {t.name}
                  </span>
                  <span className="block font-mono text-[10px] text-text-dim mt-0.5 flex items-center gap-2">
                    <span className="flex items-center gap-1"><Users size={9} />{t.memberCount}</span>
                    <span>{t.legCount} {t.legCount === 1 ? 'day' : 'days'}</span>
                    {t.memberKey !== 'organiser' && <span className="text-accent-4">invited</span>}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="border-t border-border p-2">
            {creating ? (
              <div className="flex gap-1.5">
                <input
                  value={name}
                  autoFocus
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && name.trim()) make() }}
                  placeholder="Trip name"
                  aria-label="New trip name"
                  className="w-full bg-surface-2 border border-border rounded-lg px-2.5 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
                />
                <button
                  disabled={pending || !name.trim()}
                  onClick={make}
                  className="shrink-0 px-2.5 rounded-lg bg-accent text-bg font-display font-bold text-xs uppercase disabled:opacity-40 min-h-[40px]"
                >
                  {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-1.5 py-2 font-mono text-xs text-text-muted hover:text-accent transition-colors min-h-[40px]"
              >
                <Plus size={13} /> New trip
              </button>
            )}
            {error && <p className="font-mono text-[11px] text-accent-3 px-1.5 pt-1.5">{error}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
