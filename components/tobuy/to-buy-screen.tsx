'use client'

import type { CategoryWithToBuy, Item, Packed, Profile, Category } from '@/lib/tobuy'
import {
  overallProgress,
  personProgress,
  categoryProgress,
} from '@/lib/progress'
import ProgressBar from './progress-bar'

const assignedColors: Record<string, string> = {
  kritish: 'bg-accent/15 text-accent border-accent/30',
  partner: 'bg-accent-4/15 text-accent-4 border-accent-4/30',
  shared:  'bg-accent-2/15 text-accent-2 border-accent-2/30',
}

interface ToBuyScreenProps {
  profile: Profile
  categories: Category[]
  allItems: Item[]
  categoriesWithToBuy: CategoryWithToBuy[]
  packed: Packed[]
}

export default function ToBuyScreen({
  profile,
  categories,
  allItems,
  categoriesWithToBuy,
  packed,
}: ToBuyScreenProps) {
  const overall = overallProgress(allItems, packed, profile.role)
  const me = personProgress(allItems, packed, profile.role, profile.display_name, 'bg-accent')
  const partnerRole = profile.role === 'kritish' ? 'partner' : 'kritish'
  const partnerLabel = profile.role === 'kritish' ? 'Gitansh' : 'Kritish'
  const partner = personProgress(allItems, packed, partnerRole, partnerLabel, 'bg-accent-4')

  const totalToBuy = categoriesWithToBuy.reduce((s, c) => s + c.items.length, 0)

  return (
    <div className="px-4 pt-4 pb-6 flex flex-col gap-4">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-2xl uppercase tracking-tight text-text">To-Buy</h1>
        <p className="font-mono text-xs text-text-muted mt-0.5">
          {totalToBuy} item{totalToBuy !== 1 ? 's' : ''} to purchase
        </p>
      </div>

      {/* Progress section */}
      <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-4">
        <p className="font-mono text-xs text-text-muted uppercase tracking-wider">Pack progress</p>

        {/* Overall */}
        <ProgressBar stat={overall} />

        {/* Per-person */}
        <div className="grid grid-cols-2 gap-4 pt-1 border-t border-border/50">
          <ProgressBar stat={me} size="sm" />
          <ProgressBar stat={partner} size="sm" />
        </div>

        {/* Per-category */}
        <div className="flex flex-col gap-3 pt-1 border-t border-border/50">
          <p className="font-mono text-[11px] text-text-muted uppercase tracking-wider">By category</p>
          {categories.map(cat => {
            const stat = categoryProgress(allItems, packed, profile.role, cat.id, cat.name)
            if (stat.total === 0) return null
            return <ProgressBar key={cat.id} stat={stat} size="sm" />
          })}
        </div>
      </div>

      {/* To-buy list */}
      {totalToBuy > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs text-text-muted uppercase tracking-wider">Shopping list</p>
          {categoriesWithToBuy.map(cat => (
            <div key={cat.id} className="bg-surface border border-border rounded-2xl overflow-hidden">
              {/* Category header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
                {cat.icon && <span>{cat.icon}</span>}
                <span className="font-display font-bold text-sm uppercase tracking-tight text-text">
                  {cat.name}
                </span>
                <span className="font-mono text-xs text-text-muted ml-auto">{cat.items.length}</span>
              </div>

              {/* Items */}
              <div className="divide-y divide-border/50">
                {cat.items.map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3 min-h-[52px]">
                    {/* Shopping cart indicator */}
                    <span className="text-accent-3 text-lg">🛒</span>

                    <div className="flex-1 min-w-0">
                      <span className="font-body text-sm text-text block truncate">
                        {item.name}
                        {item.qty && <span className="text-text-muted ml-1">× {item.qty}</span>}
                      </span>
                      {item.note && (
                        <span className="font-mono text-xs text-text-dim block truncate">{item.note}</span>
                      )}
                    </div>

                    <span className={`shrink-0 font-mono text-[10px] uppercase tracking-wider border rounded px-1.5 py-0.5 ${assignedColors[item.assigned_to]}`}>
                      {item.assigned_to === 'shared' ? 'shared' : item.assigned_to === profile.role ? 'me' : item.assigned_to}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface border border-accent-2/30 rounded-2xl p-6 text-center">
          <div className="text-3xl mb-2">✅</div>
          <p className="font-display font-bold text-sm uppercase tracking-tight text-accent-2">All bought!</p>
          <p className="font-mono text-xs text-text-muted mt-1">Nothing left to purchase</p>
        </div>
      )}
    </div>
  )
}
