'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { CategoryWithToBuy, Item, Packed, Profile, Category } from '@/lib/tobuy'
import {
  overallProgress,
  personProgress,
  categoryProgress,
} from '@/lib/progress'
import ProgressBar from './progress-bar'
import { markAsBought, addToBuyItem } from '@/app/actions/tobuy'

const assignedColors: Record<string, string> = {
  kritish: 'bg-accent/15 text-accent border-accent/30',
  partner: 'bg-accent-4/15 text-accent-4 border-accent-4/30',
  shared:  'bg-accent-2/15 text-accent-2 border-accent-2/30',
}

const inputClass =
  'bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors'

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
  const flatInitial = categoriesWithToBuy.flatMap(c => c.items)
  const [localItems, setLocalItems] = useState<Item[]>(flatInitial)

  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('')
  const [newAssigned, setNewAssigned] = useState<'kritish' | 'partner' | 'shared'>('shared')
  const [newCategoryId, setNewCategoryId] = useState<string>(
    categories.length > 0 ? String(categories[0].id) : ''
  )
  const [addPending, setAddPending] = useState(false)

  const localCategoriesWithToBuy: CategoryWithToBuy[] = categories
    .map(cat => ({
      ...cat,
      items: localItems.filter(i => i.category_id === cat.id),
    }))
    .filter(cat => cat.items.length > 0)

  const totalToBuy = localItems.length

  const overall = overallProgress(allItems, packed, profile.role)
  const me = personProgress(allItems, packed, profile.role, profile.display_name, 'bg-accent')
  const partnerRole = profile.role === 'kritish' ? 'partner' : 'kritish'
  const partnerLabel = profile.role === 'kritish' ? 'Gitansh' : 'Kritish'
  const partner = personProgress(allItems, packed, partnerRole, partnerLabel, 'bg-accent-4')

  async function handleMarkBought(itemId: string) {
    const prev = localItems
    setLocalItems(items => items.filter(i => i.id !== itemId))
    try {
      await markAsBought(itemId)
    } catch (err) {
      console.error('Failed to mark as bought:', err)
      setLocalItems(prev)
    }
  }

  async function handleAdd() {
    if (!newName.trim() || !newCategoryId) return
    setAddPending(true)
    try {
      await addToBuyItem({
        category_id: Number(newCategoryId),
        name: newName.trim(),
        qty: newQty.trim() || undefined,
        assigned_to: newAssigned,
      })
      setNewName('')
      setNewQty('')
      setNewAssigned('shared')
      setShowAddForm(false)
    } catch (err) {
      console.error('Failed to add item:', err)
    } finally {
      setAddPending(false)
    }
  }

  return (
    <div className="px-4 pt-4 pb-6 flex flex-col gap-4">
      <div>
        <h1 className="font-display font-bold text-2xl uppercase tracking-tight text-text">To-Buy</h1>
        <p className="font-mono text-xs text-text-muted mt-0.5">
          {totalToBuy} item{totalToBuy !== 1 ? 's' : ''} to purchase
        </p>
      </div>

      {/* Progress */}
      <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-4">
        <p className="font-mono text-xs text-text-muted uppercase tracking-wider">Pack progress</p>
        <ProgressBar stat={overall} />
        <div className="grid grid-cols-2 gap-4 pt-1 border-t border-border/50">
          <ProgressBar stat={me} size="sm" />
          <ProgressBar stat={partner} size="sm" />
        </div>
        <div className="flex flex-col gap-3 pt-1 border-t border-border/50">
          <p className="font-mono text-[11px] text-text-muted uppercase tracking-wider">By category</p>
          {categories.map(cat => {
            const stat = categoryProgress(allItems, packed, profile.role, cat.id, cat.name)
            if (stat.total === 0) return null
            return <ProgressBar key={cat.id} stat={stat} size="sm" />
          })}
        </div>
      </div>

      {/* Shopping list */}
      <div className="flex flex-col gap-3">
        <p className="font-mono text-xs text-text-muted uppercase tracking-wider">Shopping list</p>

        {/* Add item */}
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 text-sm text-accent font-body"
            >
              <Plus size={16} />
              Add to shopping list
            </button>
          </div>
          {showAddForm && (
            <div className="px-4 py-3 space-y-3 bg-surface-2/50">
              <input
                placeholder="Item name"
                className={`w-full ${inputClass}`}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                autoFocus
              />
              <div className="flex gap-2">
                <input
                  placeholder="Qty"
                  type="text"
                  inputMode="numeric"
                  className={`w-20 ${inputClass}`}
                  value={newQty}
                  onChange={e => setNewQty(e.target.value)}
                />
                <select
                  className={`flex-1 ${inputClass}`}
                  value={newAssigned}
                  onChange={e => setNewAssigned(e.target.value as 'kritish' | 'partner' | 'shared')}
                >
                  <option value="kritish">Kritish</option>
                  <option value="partner">Gitansh</option>
                  <option value="shared">Both</option>
                </select>
                <select
                  className={`flex-1 ${inputClass}`}
                  value={newCategoryId}
                  onChange={e => setNewCategoryId(e.target.value)}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={addPending || !newName.trim()}
                  className="flex-1 py-2 bg-accent text-bg rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity"
                >
                  {addPending ? 'Adding…' : 'Add'}
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setNewName(''); setNewQty('') }}
                  className="px-4 py-2 border border-border rounded-lg text-sm text-text-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Items grouped by category */}
        {localCategoriesWithToBuy.length > 0 ? (
          localCategoriesWithToBuy.map(cat => (
            <div key={cat.id} className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
                {cat.icon && <span>{cat.icon}</span>}
                <span className="font-display font-bold text-sm uppercase tracking-tight text-text">
                  {cat.name}
                </span>
                <span className="font-mono text-xs text-text-muted ml-auto">{cat.items.length}</span>
              </div>
              <div className="divide-y divide-border/50">
                {cat.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleMarkBought(item.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2/50 active:bg-surface-2 transition-colors text-left min-h-[48px]"
                  >
                    <span className="shrink-0 w-5 h-5 rounded-full border-2 border-accent/40 flex items-center justify-center" />
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
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-surface border border-accent-2/30 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="font-display font-bold text-sm uppercase tracking-tight text-accent-2">All bought!</p>
            <p className="font-mono text-xs text-text-muted mt-1">Nothing left to purchase</p>
          </div>
        )}
      </div>
    </div>
  )
}
