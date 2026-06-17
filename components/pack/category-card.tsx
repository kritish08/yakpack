'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { CategoryWithItems, Packed, Profile } from '@/lib/pack'
import ItemRow from './item-row'

interface CategoryCardProps {
  category: CategoryWithItems
  packed: Packed[]
  profile: Profile
  onToggle: (itemId: string, userKey: string, isPacked: boolean) => void
}

function countPacked(items: CategoryWithItems['items'], packed: Packed[], profileRole: string) {
  let total = 0, done = 0
  for (const item of items) {
    const userKey = item.scope === 'each' ? profileRole : 'shared'
    total++
    if (packed.some(p => p.item_id === item.id && p.user_key === userKey)) done++
  }
  return { total, done }
}

export default function CategoryCard({ category, packed, profile, onToggle }: CategoryCardProps) {
  const [open, setOpen] = useState(true)
  const { total, done } = countPacked(category.items, packed, profile.role)
  const allDone = total > 0 && done === total
  const progress = total > 0 ? (done / total) * 100 : 0

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-surface">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2/50 transition-colors"
      >
        {category.icon && <span className="text-xl">{category.icon}</span>}
        <span className="flex-1 text-left font-display font-bold text-sm uppercase tracking-tight text-text">
          {category.name}
        </span>
        <span className={`font-mono text-xs tabular-nums ${allDone ? 'text-accent-2' : 'text-text-muted'}`}>
          {done}/{total}
        </span>
        <ChevronDown
          size={16}
          className={`text-text-muted transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
        />
      </button>

      {/* Progress bar */}
      <div className="h-0.5 bg-border mx-4">
        <div
          className="h-full bg-accent-2 transition-all duration-300 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Items */}
      {open && category.items.length > 0 && (
        <div className="divide-y divide-border/50">
          {category.items.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              packed={packed}
              profile={profile}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}

      {open && category.items.length === 0 && (
        <p className="px-4 py-3 font-mono text-xs text-text-dim">No items</p>
      )}
    </div>
  )
}
