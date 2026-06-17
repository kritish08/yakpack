'use client'

import type { CategoryWithToBuy, Item, Packed, Profile, Category, Trip } from '@/lib/tobuy'
import { overallProgress, personProgress, categoryProgress } from '@/lib/progress'

const assignedChip: Record<string, { label: string; cls: string }> = {
  kritish: { label: 'K', cls: 'bg-accent/15 text-accent border-accent/30' },
  partner: { label: 'G', cls: 'bg-accent-4/15 text-accent-4 border-accent-4/30' },
  shared:  { label: '2', cls: 'bg-accent-2/15 text-accent-2 border-accent-2/30' },
}

interface SummaryScreenProps {
  profile: Profile
  categories: Category[]
  allItems: Item[]
  categoriesWithToBuy: CategoryWithToBuy[]
  packed: Packed[]
  trip: Trip | null
  today: string
}

function TripChip({ trip, today }: { trip: Trip | null; today: string }) {
  if (!trip?.depart_date) return null
  const diff = Math.ceil(
    (new Date(trip.depart_date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000
  )
  if (diff > 0)  return <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/30">{diff}d to go</span>
  if (diff === 0) return <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-accent-2/10 text-accent-2 border border-accent-2/30">Departs today!</span>
  return <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-accent-2/10 text-accent-2 border border-accent-2/30">Day {Math.abs(diff) + 1} of 9</span>
}

export default function SummaryScreen({
  profile, categories, allItems, categoriesWithToBuy, packed, trip, today,
}: SummaryScreenProps) {
  const partnerRole = profile.role === 'kritish' ? 'partner' : 'kritish'
  const myLabel     = profile.display_name || (profile.role === 'kritish' ? 'Kritish' : 'Gitansh')
  const partLabel   = profile.role === 'kritish' ? 'Gitansh' : 'Kritish'

  const overall    = overallProgress(allItems, packed, profile.role)
  const me         = personProgress(allItems, packed, profile.role, myLabel, 'bg-accent')
  const partner    = personProgress(allItems, packed, partnerRole, partLabel, 'bg-accent-4')

  const pct    = overall.total > 0 ? Math.round((overall.done / overall.total) * 100) : 0
  const mePct  = me.total      > 0 ? Math.round((me.done      / me.total)      * 100) : 0
  const ptPct  = partner.total > 0 ? Math.round((partner.done / partner.total) * 100) : 0

  const toBuyFlat = categoriesWithToBuy.flatMap(c => c.items)

  return (
    <div className="px-4 pt-5 pb-20 flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl uppercase tracking-tight text-text leading-none">Summary</h1>
          <p className="font-mono text-xs text-text-muted mt-1">{trip?.name ?? 'Spiti Valley'}</p>
        </div>
        <TripChip trip={trip} today={today} />
      </div>

      {/* Overall */}
      <section className="bg-surface border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="font-mono text-[11px] uppercase tracking-wider text-text-muted">Overall pack</p>
          <span className="font-mono text-xs text-text-muted">{overall.done}/{overall.total} items</span>
        </div>
        <div className="h-2.5 bg-border rounded-full overflow-hidden mb-2">
          <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="font-display font-bold text-4xl text-text leading-none">
          {pct}<span className="text-lg text-text-muted font-mono ml-0.5">%</span>
        </p>
      </section>

      {/* Per-person */}
      <div className="grid grid-cols-2 gap-3">
        {([
          { label: 'Me',      stat: me,      pct: mePct, bar: 'bg-accent',   border: 'border-accent/20',   text: 'text-accent' },
          { label: 'Partner', stat: partner,  pct: ptPct, bar: 'bg-accent-4', border: 'border-accent-4/20', text: 'text-accent-4' },
        ] as const).map(({ label, stat, pct: p, bar, border, text }) => (
          <div key={label} className={`bg-surface border rounded-xl p-3 ${border}`}>
            <div className="flex items-center justify-between mb-1.5">
              <p className={`font-mono text-[10px] uppercase tracking-wider ${text}`}>{label}</p>
              <span className={`font-mono text-[10px] font-bold ${text}`}>{p}%</span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden mb-2">
              <div className={`h-full ${bar} rounded-full transition-all duration-500`} style={{ width: `${p}%` }} />
            </div>
            <p className="font-body text-xs text-text truncate font-medium">{stat.label}</p>
            <p className="font-mono text-[10px] text-text-muted">{stat.done}/{stat.total}</p>
          </div>
        ))}
      </div>

      {/* To-buy */}
      <section className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-wider text-text-muted">Still to buy</p>
          <span className={`font-mono text-xs font-bold ${toBuyFlat.length > 0 ? 'text-accent-3' : 'text-accent-2'}`}>
            {toBuyFlat.length === 0 ? 'All done ✓' : `${toBuyFlat.length} items`}
          </span>
        </div>
        {toBuyFlat.length === 0 ? (
          <p className="px-4 py-5 font-mono text-xs text-text-muted text-center">Nothing left to buy — you&apos;re set.</p>
        ) : (
          <div className="divide-y divide-border/40">
            {toBuyFlat.map(item => {
              const chip = assignedChip[item.assigned_to] ?? assignedChip.shared
              return (
                <div key={item.id} className="px-4 py-2.5 flex items-center gap-3">
                  <span className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center font-mono text-[9px] font-bold ${chip.cls}`}>
                    {chip.label}
                  </span>
                  <span className="font-body text-sm text-text flex-1 min-w-0 truncate">{item.name}</span>
                  {item.qty && <span className="font-mono text-xs text-text-muted shrink-0">×{item.qty}</span>}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Category breakdown */}
      <section className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="font-mono text-[11px] uppercase tracking-wider text-text-muted">By category</p>
        </div>
        <div className="divide-y divide-border/40">
          {categories.map(cat => {
            const s = categoryProgress(allItems, packed, profile.role, cat.id as number, cat.name)
            if (s.total === 0) return null
            const cp = Math.round((s.done / s.total) * 100)
            return (
              <div key={cat.id} className="px-4 py-2.5 flex items-center gap-3">
                {cat.icon && <span className="text-base shrink-0">{cat.icon}</span>}
                <span className="font-body text-sm text-text flex-1 min-w-0 truncate">{cat.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${cp === 100 ? 'bg-accent-2' : 'bg-accent'}`} style={{ width: `${cp}%` }} />
                  </div>
                  <span className={`font-mono text-[10px] w-8 text-right tabular-nums ${cp === 100 ? 'text-accent-2' : 'text-text-muted'}`}>{cp}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

    </div>
  )
}
