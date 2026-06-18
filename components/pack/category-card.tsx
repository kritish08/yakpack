'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, Plus, X, Check } from 'lucide-react'
import type { CategoryWithItems, Item, Packed, Profile } from '@/lib/pack'
import ItemRow from './item-row'
import { addItem } from '@/app/actions/items'

interface CategoryCardProps {
  category: CategoryWithItems
  packed: Packed[]
  profile: Profile
  onToggle: (itemId: string, userKey: string, isPacked: boolean) => void
  onEdit?: (item: Item) => void
  onDelete?: (itemId: string) => void
  forceOpen?: boolean       // override collapse while searching
  hideAddForm?: boolean     // hide the per-category add control while searching
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

const inputClass =
  'bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors'

export default function CategoryCard({ category, packed, profile, onToggle, onEdit, onDelete, forceOpen, hideAddForm }: CategoryCardProps) {
  const [open, setOpen] = useState(true)
  const isOpen = forceOpen || open
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('')
  const [newAssignedTo, setNewAssignedTo] = useState<'kritish' | 'partner' | 'shared'>('shared')
  const [newStatus, setNewStatus] = useState<'owned' | 'to_buy' | 'standard'>('standard')
  const [isPending, startTransition] = useTransition()

  const { total, done } = countPacked(category.items, packed, profile.role)
  const allDone = total > 0 && done === total
  const progress = total > 0 ? (done / total) * 100 : 0

  function resetForm() {
    setNewName(''); setNewQty(''); setNewAssignedTo('shared'); setNewStatus('standard'); setShowAddForm(false)
  }

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    const scope: 'each' | 'shared' = newAssignedTo === 'shared' ? 'shared' : 'each'
    startTransition(async () => {
      await addItem({
        category_id: category.id as number,
        name: newName.trim(),
        qty: newQty.trim() || undefined,
        status: newStatus,
        assigned_to: newAssignedTo,
        scope,
      })
      resetForm()
    })
  }

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-surface">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={forceOpen}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2/50 transition-colors disabled:hover:bg-transparent"
      >
        {category.icon && <span className="text-xl">{category.icon}</span>}
        <span className="flex-1 text-left font-display font-bold text-sm uppercase tracking-tight text-text">
          {category.name}
        </span>
        <span className={`font-mono text-xs tabular-nums ${allDone ? 'text-accent-2' : 'text-text-muted'}`}>
          {done}/{total}
        </span>
        <ChevronDown size={16} className={`text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'} ${forceOpen ? 'opacity-30' : ''}`} />
      </button>

      <div className="h-0.5 bg-border mx-4">
        <div className="h-full bg-accent-2 transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
      </div>

      {isOpen && (
        <>
          {category.items.length > 0 ? (
            <div className="divide-y divide-border/50">
              {category.items.map(item => (
                <ItemRow key={item.id} item={item} packed={packed} profile={profile} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          ) : (
            <p className="px-4 py-3 font-mono text-xs text-text-dim">No items</p>
          )}

          {hideAddForm ? null : showAddForm ? (
            <form onSubmit={handleAddSubmit} className="border-t border-border/50 px-4 py-3 flex flex-col gap-2">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Item name"
                autoFocus
                required
                className={`${inputClass} w-full`}
              />
              <div className="flex gap-2">
                <input type="text" value={newQty} onChange={e => setNewQty(e.target.value)} placeholder="Qty" className={`${inputClass} w-20 shrink-0`} />
                <select value={newStatus} onChange={e => setNewStatus(e.target.value as 'owned' | 'to_buy' | 'standard')} className={`${inputClass} flex-1`}>
                  <option value="owned">Owned</option>
                  <option value="to_buy">To Buy</option>
                  <option value="standard">Standard</option>
                </select>
              </div>
              {/* Who carries it — pill toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden text-xs font-mono">
                {([
                  { v: profile.role, label: 'Individual' },
                  { v: 'shared', label: 'Shared' },
                ] as { v: 'kritish' | 'partner' | 'shared'; label: string }[]).map(({ v, label }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setNewAssignedTo(v)}
                    className={`flex-1 py-2 transition-colors ${newAssignedTo === v ? 'bg-accent text-bg font-bold' : 'text-text-muted hover:text-text hover:bg-surface-2'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={isPending || !newName.trim()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-bg font-body text-xs font-medium disabled:opacity-50 min-h-[36px]">
                  <Check size={12} />{isPending ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={resetForm} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-2 border border-border text-text-muted font-body text-xs min-h-[36px]">
                  <X size={12} />Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-2 text-xs text-text-dim hover:text-accent transition-colors flex items-center justify-center gap-1 border-t border-border/30 min-h-[40px]"
            >
              <Plus size={12} /> Add item
            </button>
          )}
        </>
      )}
    </div>
  )
}
