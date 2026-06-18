'use client'

import { useState } from 'react'
import { X, Trash2, ShoppingBag, Pencil } from 'lucide-react'

export type ActionType = 'updateItem' | 'deleteItem' | 'markAsBought'

export interface UpdateItemInput {
  id: string
  changes: {
    name?: string
    qty?: string | null
    status?: 'owned' | 'to_buy' | 'standard'
    assigned_to?: 'kritish' | 'partner' | 'shared'
    category_id?: number
  }
  reason: string
}

export interface DeleteItemInput {
  id: string
  name: string
  reason: string
}

export interface MarkAsBoughtInput {
  id: string
  name: string
}

interface ConfirmActionSheetProps {
  type: ActionType
  input: UpdateItemInput | DeleteItemInput | MarkAsBoughtInput
  onConfirm: () => Promise<void>
  onDismiss: () => void
}

const statusLabel: Record<string, string> = {
  owned: 'Owned',
  to_buy: 'To buy',
  standard: 'Standard',
}

const assignedLabel: Record<string, string> = {
  kritish: 'Kritish',
  partner: 'Partner',
  shared: 'Both',
}

export default function ConfirmActionSheet({ type, input, onConfirm, onDismiss }: ConfirmActionSheetProps) {
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try { await onConfirm() } finally { setLoading(false) }
  }

  const btnCls =
    type === 'deleteItem'
      ? 'bg-accent-3 text-bg'
      : type === 'markAsBought'
      ? 'bg-accent-2 text-bg'
      : 'bg-accent text-bg'

  return (
    <div className="fixed inset-0 z-[60] flex items-end">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onDismiss} />
      <div className="relative bg-surface rounded-t-2xl border-t border-border w-full max-w-lg mx-auto p-4 pb-8">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {type === 'deleteItem'    && <Trash2      size={16} className="text-accent-3" />}
            {type === 'updateItem'    && <Pencil      size={16} className="text-accent"   />}
            {type === 'markAsBought'  && <ShoppingBag size={16} className="text-accent-2" />}
            <h2 className="font-display font-bold text-sm uppercase tracking-tight text-text">
              {type === 'deleteItem' ? 'Delete everywhere?' : type === 'markAsBought' ? 'Mark as bought?' : 'Update item?'}
            </h2>
          </div>
          <button onClick={onDismiss} className="p-1.5 text-text-muted hover:text-text transition-colors">
            <X size={18} />
          </button>
        </div>

        {type === 'updateItem' && (() => {
          const u = input as UpdateItemInput
          return (
            <div className="mb-4 space-y-2">
              <p className="font-mono text-xs text-text-muted leading-relaxed">{u.reason}</p>
              <div className="bg-surface-2 rounded-xl p-3 space-y-2">
                {u.changes.name && (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-text-dim uppercase w-14 shrink-0">Name</span>
                    <span className="font-body text-sm text-text">{u.changes.name}</span>
                  </div>
                )}
                {u.changes.qty !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-text-dim uppercase w-14 shrink-0">Qty</span>
                    <span className="font-body text-sm text-text">{u.changes.qty || '—'}</span>
                  </div>
                )}
                {u.changes.status && (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-text-dim uppercase w-14 shrink-0">Status</span>
                    <span className="font-body text-sm text-text">{statusLabel[u.changes.status]}</span>
                  </div>
                )}
                {u.changes.assigned_to && (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-text-dim uppercase w-14 shrink-0">For</span>
                    <span className="font-body text-sm text-text">{assignedLabel[u.changes.assigned_to]}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {type === 'deleteItem' && (() => {
          const d = input as DeleteItemInput
          return (
            <div className="mb-4 space-y-2">
              <div className="bg-accent-3/8 rounded-xl px-4 py-3 border border-accent-3/20">
                <p className="font-body text-sm text-text font-medium">{d.name}</p>
                <p className="font-mono text-xs text-text-muted mt-1">{d.reason}</p>
              </div>
              <p className="font-mono text-[11px] text-accent-3 leading-relaxed">
                This permanently removes the item from your whole pack — Pack, Summary and shopping — for everyone. This can&apos;t be undone. To just stop buying it, cancel and ask Pemba to move it off the shopping list instead.
              </p>
            </div>
          )
        })()}

        {type === 'markAsBought' && (() => {
          const m = input as MarkAsBoughtInput
          return (
            <div className="mb-4">
              <div className="bg-accent-2/8 rounded-xl px-4 py-3 border border-accent-2/20">
                <p className="font-body text-sm text-text font-medium">{m.name}</p>
                <p className="font-mono text-xs text-text-muted mt-1">Moves from &quot;still to buy&quot; to owned items.</p>
              </div>
            </div>
          )
        })()}

        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl font-display font-bold uppercase tracking-tight text-sm disabled:opacity-50 min-h-[44px] transition-opacity ${btnCls}`}
          >
            {loading ? 'Working…' : type === 'deleteItem' ? 'Delete' : type === 'markAsBought' ? 'Mark Bought' : 'Apply Update'}
          </button>
          <button
            onClick={onDismiss}
            className="px-5 py-2.5 rounded-xl bg-surface-2 border border-border text-text-muted font-body text-sm min-h-[44px]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
