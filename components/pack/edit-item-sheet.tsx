'use client'

import { useEffect, useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { updateItem, deleteItem } from '@/app/actions/items'
import type { Item } from '@/lib/pack'

interface EditItemSheetProps {
  item: Item | null
  role: 'kritish' | 'partner'
  onClose: () => void
  onSaved?: (itemId: string, changes: Partial<Item>) => void
  onDeleted?: (itemId: string) => void
}

const inputClass =
  'bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors w-full'
const labelClass = 'block font-mono text-xs text-text-muted mb-1'

export default function EditItemSheet({ item, role, onClose, onSaved, onDeleted }: EditItemSheetProps) {
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'owned' | 'to_buy' | 'standard'>('standard')
  const [assignedTo, setAssignedTo] = useState<'kritish' | 'partner' | 'shared'>('shared')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (item) {
      setName(item.name)
      setQty(item.qty ?? '')
      setNote(item.note ?? '')
      setStatus(item.status)
      setAssignedTo(item.assigned_to)
    }
  }, [item])

  if (!item) return null

  const scope: 'each' | 'shared' = assignedTo === 'shared' ? 'shared' : 'each'

  async function handleSave() {
    if (!item || !name.trim()) return
    setSaving(true)
    const changes = {
      name: name.trim(),
      qty: qty.trim() || null,
      note: note.trim() || null,
      status,
      assigned_to: assignedTo,
      scope,
    }
    try {
      await updateItem(item.id, changes)
      onSaved?.(item.id, changes)
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!item) return
    const ok = window.confirm(`Delete "${item.name}"? This cannot be undone.`)
    if (!ok) return
    setDeleting(true)
    try {
      await deleteItem(item.id)
      onDeleted?.(item.id)
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setDeleting(false)
    }
  }

  // Detect which role is "individual" — assignedTo is either the user's role or partner's role
  // We simplify: show Individual / Shared only, where Individual = assignedTo stays as-is (non-shared)
  const isShared = assignedTo === 'shared'

  return (
    <div className="fixed inset-0 z-[60] flex items-end">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-t-2xl border-t border-border w-full max-w-lg mx-auto p-4 pb-8">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-sm uppercase tracking-tight text-text">Edit Item</h2>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Item name" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Qty</label>
              <input type="text" value={qty} onChange={e => setQty(e.target.value)} placeholder="e.g. 2" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as 'owned' | 'to_buy' | 'standard')} className={inputClass}>
                <option value="owned">Owned</option>
                <option value="to_buy">To Buy</option>
                <option value="standard">Standard</option>
              </select>
            </div>
          </div>

          {/* Who carries it */}
          <div>
            <label className={labelClass}>Who carries it</label>
            <div className="flex rounded-lg border border-border overflow-hidden text-xs font-mono">
              <button
                type="button"
                onClick={() => setAssignedTo(isShared ? role : assignedTo)}
                className={`flex-1 py-2.5 transition-colors ${!isShared ? 'bg-accent text-bg font-bold' : 'text-text-muted hover:text-text hover:bg-surface-2'}`}
              >
                Individual
              </button>
              <button
                type="button"
                onClick={() => setAssignedTo('shared')}
                className={`flex-1 py-2.5 transition-colors ${isShared ? 'bg-accent text-bg font-bold' : 'text-text-muted hover:text-text hover:bg-surface-2'}`}
              >
                Shared
              </button>
            </div>
          </div>

          <div>
            <label className={labelClass}>Note</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note" className={inputClass} />
          </div>
          <div className="flex gap-2 mt-1">
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1 py-2.5 rounded-lg bg-accent text-bg font-body font-medium text-sm disabled:opacity-50 transition-opacity min-h-[44px]"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2.5 rounded-lg bg-surface-2 border border-border text-accent-3 font-body text-sm disabled:opacity-50 transition-opacity min-h-[44px] flex items-center gap-1.5"
            >
              <Trash2 size={14} />
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
