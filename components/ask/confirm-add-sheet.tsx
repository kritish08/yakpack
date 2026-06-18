'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'

interface SuggestedItem {
  name: string
  qty?: string
  status?: 'owned' | 'to_buy' | 'standard'
  assigned_to?: 'kritish' | 'partner' | 'shared'
}

interface ConfirmAddSheetProps {
  items: SuggestedItem[]
  reason: string
  onConfirm: (items: SuggestedItem[]) => Promise<void>
  onDismiss: () => void
}

const assignedLabel: Record<string, string> = {
  kritish: 'Kritish',
  partner: 'Partner',
  shared: 'Both',
}

const statusLabel: Record<string, { label: string; cls: string }> = {
  owned:    { label: 'Owned',    cls: 'text-accent-2 bg-accent-2/10 border-accent-2/30' },
  to_buy:   { label: 'To buy',   cls: 'text-accent-3 bg-accent-3/10 border-accent-3/30' },
  standard: { label: 'Standard', cls: 'text-text-muted bg-border/20 border-border'       },
}

export default function ConfirmAddSheet({ items, reason, onConfirm, onDismiss }: ConfirmAddSheetProps) {
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    await onConfirm(items)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onDismiss} />
      <div className="relative bg-surface rounded-t-2xl border-t border-border w-full max-w-lg mx-auto p-4 pb-8">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-bold text-sm uppercase tracking-tight text-text">
            Add {items.length} item{items.length !== 1 ? 's' : ''} to Pack?
          </h2>
          <button onClick={onDismiss} className="p-1.5 text-text-muted hover:text-text transition-colors">
            <X size={18} />
          </button>
        </div>

        <p className="font-mono text-xs text-text-muted mb-4 leading-relaxed">{reason}</p>

        <div className="flex flex-col gap-2 mb-4 max-h-52 overflow-y-auto">
          {items.map((item, i) => {
            const s = statusLabel[item.status ?? 'standard']
            return (
              <div key={i} className="flex items-center gap-3 bg-surface-2 rounded-xl px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <span className="font-body text-sm text-text">
                    {item.name}
                    {item.qty && <span className="text-text-muted ml-1.5">×{item.qty}</span>}
                  </span>
                </div>
                <span className={`font-mono text-[10px] border rounded px-1.5 py-0.5 shrink-0 ${s.cls}`}>
                  {s.label}
                </span>
                <span className="font-mono text-[10px] text-text-muted shrink-0">
                  {assignedLabel[item.assigned_to ?? 'shared']}
                </span>
              </div>
            )
          })}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-accent text-bg font-display font-bold uppercase tracking-tight text-sm disabled:opacity-50 transition-opacity flex items-center justify-center gap-1.5 min-h-[44px]"
          >
            <Plus size={14} />
            {loading ? 'Adding…' : 'Add to Pack'}
          </button>
          <button
            onClick={onDismiss}
            className="px-5 py-2.5 rounded-xl bg-surface-2 border border-border text-text-muted font-body text-sm min-h-[44px]"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
