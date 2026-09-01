'use client'

import { Sparkles, Ruler } from 'lucide-react'
import type { ProposedItem } from '@/lib/import-types'
import { CATEGORY_ORDER } from '@/lib/packing-rules'

/**
 * Review the proposed packing list before any of it is written.
 *
 * Same principle as the day review: a proposal, ticked into existence. What is
 * different here is the `because` line — every item that came from a rule or
 * from Pemba says which fact about *this* trip put it there ("the route crosses
 * 4,000 m"). A reason a traveller can disagree with is a reason they will read;
 * an unexplained oxygen can is just clutter they will ignore.
 */
export default function PackingReview({
  items, curated, restored, dropped, chosen, onToggle, onToggleCategory,
}: {
  items: ProposedItem[]
  curated: boolean
  restored: string[]
  dropped: string[]
  chosen: Record<string, boolean>
  onToggle: (key: string, on: boolean) => void
  onToggleCategory: (category: string, on: boolean) => void
}) {
  const cats = [...new Set(items.map(i => i.category))].sort((a, b) => {
    const ra = CATEGORY_ORDER.indexOf(a), rb = CATEGORY_ORDER.indexOf(b)
    if (ra === -1 && rb === -1) return a.localeCompare(b)
    return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb)
  })

  const keyOf = (i: ProposedItem) => `${i.category}::${i.name}`
  const count = Object.values(chosen).filter(Boolean).length

  return (
    <>
      <div className="mb-4 rounded-xl border border-border bg-surface-2/40 p-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent flex items-center gap-1.5 mb-1">
          {curated
            ? <><Sparkles size={11} aria-hidden="true" /> Pemba built this for your route</>
            : <><Ruler size={11} aria-hidden="true" /> Built from your route</>}
        </p>
        <p className="font-body text-xs text-text-muted leading-relaxed">
          {curated
            ? 'Every item below earned its place from something real about this trip. Untick anything you already have or do not want.'
            : 'Derived from your altitude, length and dates — no AI needed. Add your OpenAI key in Settings and Pemba will tailor it further next time.'}
        </p>
        {restored.length > 0 && (
          <p className="font-mono text-[10px] text-text-dim mt-2 leading-relaxed">
            Added back automatically: {restored.join(', ')} — these are never dropped.
          </p>
        )}
        {dropped.length > 0 && (
          <p className="font-mono text-[10px] text-text-dim mt-1 leading-relaxed">
            Left out as irrelevant here: {dropped.join(', ')}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {cats.map(cat => {
          const inCat = items.filter(i => i.category === cat)
          const allOn = inCat.every(i => chosen[keyOf(i)])
          return (
            <section key={cat}>
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="font-display font-bold text-[11px] uppercase tracking-widest text-text-muted">
                  {cat}
                </h4>
                <button
                  onClick={() => onToggleCategory(cat, !allOn)}
                  className="font-mono text-[10px] text-accent min-h-[32px] px-1"
                >
                  {allOn ? 'none' : 'all'}
                </button>
              </div>
              <ul className="flex flex-col">
                {inCat.map(i => {
                  const k = keyOf(i)
                  return (
                    <li key={k} className="border-b border-border/40 last:border-0">
                      <label className="flex items-start gap-2.5 py-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(chosen[k])}
                          onChange={e => onToggle(k, e.target.checked)}
                          className="mt-1 accent-[var(--accent)] shrink-0"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-body text-sm text-text flex items-center gap-1.5 flex-wrap">
                            {i.name}
                            <span className="font-mono text-[9px] uppercase tracking-wider text-text-dim border border-border rounded px-1 py-px">
                              {i.scope === 'each' ? 'each' : 'shared'}
                            </span>
                            {i.status === 'to_buy' && (
                              <span className="font-mono text-[9px] uppercase tracking-wider text-accent-3">to buy</span>
                            )}
                          </span>
                          {i.note && (
                            <span className="block font-body text-[11px] text-text-muted leading-snug mt-0.5">{i.note}</span>
                          )}
                          {i.because && (
                            <span className="block font-mono text-[10px] text-accent/70 leading-snug mt-0.5">
                              {i.because}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>

      <p className="font-mono text-[11px] text-text-dim mt-4">
        {count} of {items.length} selected
      </p>
    </>
  )
}
