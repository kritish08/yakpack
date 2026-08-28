'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import CategoryCard from './category-card'
import EditItemSheet from './edit-item-sheet'
import type { CategoryWithItems, Item, Packed } from '@/lib/pack'
import type { AssignedTo } from '@/lib/database.types'
import type { MemberView } from '@/lib/database.types'
import type { Database } from '@/lib/database.types'
import { deleteItem } from '@/app/actions/items'
import { applyOps, enqueueOp, readQueue } from '@/lib/offline-queue'

type PackedInsert = Database['public']['Tables']['packed']['Insert']

interface PackScreenProps {
  ctx: MemberView
  categoriesWithItems: CategoryWithItems[]
  initialPacked: Packed[]
}

export default function PackScreen({ ctx, categoriesWithItems, initialPacked }: PackScreenProps) {
  const [packed, setPacked] = useState<Packed[]>(initialPacked)
  const [categories, setCategories] = useState<CategoryWithItems[]>(categoriesWithItems)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [query, setQuery] = useState('')
  const supabase = useMemo(() => createClient(), [])

  // Sync when server pushes new RSC payload after revalidatePath
  useEffect(() => { setCategories(categoriesWithItems) }, [categoriesWithItems])

  useEffect(() => {
    const channel = supabase
      .channel('packed-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packed' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as Packed
          setPacked(prev => prev.some(p => p.item_id === row.item_id && p.user_key === row.user_key)
            ? prev : [...prev, row])
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new as Packed
          setPacked(prev => {
            const idx = prev.findIndex(p => p.item_id === row.item_id && p.user_key === row.user_key)
            if (idx === -1) return [...prev, row]
            const next = prev.slice()
            next[idx] = row
            return next
          })
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old as Partial<Packed>
          setPacked(prev => prev.filter(p => !(p.item_id === old.item_id && p.user_key === old.user_key)))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  // Replay the offline outbox over the server-rendered rows.
  //
  // When this page is served from the SW's page cache (offline reload),
  // `initialPacked` is the snapshot from when the page was last cached — it does
  // NOT include toggles made offline since. Projecting the queue over it keeps
  // those check-offs visible instead of appearing to vanish on reload.
  //
  // Flushing the queue is handled app-wide by <OfflineSync>; this effect only
  // reconciles what the queue still holds into the view.
  useEffect(() => {
    setPacked(applyOps(initialPacked, readQueue()))
  }, [initialPacked])

  const handleToggle = useCallback(async (itemId: string, userKey: AssignedTo, isPacked: boolean) => {
    if (isPacked) {
      setPacked(prev => prev.filter(p => !(p.item_id === itemId && p.user_key === userKey)))
      try {
        const { error } = await supabase.from('packed').delete().eq('item_id', itemId).eq('user_key', userKey)
        if (error) throw error
      } catch {
        // Offline / network failure — queue the op so it isn't lost. Keep the
        // optimistic local state; the queue replays on reconnect.
        enqueueOp({ op: 'delete', item_id: itemId, user_key: userKey })
      }
    } else {
      setPacked(prev => [...prev, { item_id: itemId, user_key: userKey, packed: true, packed_at: new Date().toISOString() }])
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('packed') as any).insert({ item_id: itemId, user_key: userKey, packed: true } as PackedInsert)
        if (error) throw error
      } catch {
        enqueueOp({ op: 'insert', item_id: itemId, user_key: userKey })
      }
    }
  }, [supabase])

  const handleDelete = useCallback(async (itemId: string) => {
    const ok = window.confirm('Delete from your whole pack list? This removes it everywhere (Pack, Summary, and shopping list). This cannot be undone.')
    if (!ok) return
    setCategories(prev => prev.map(c => ({ ...c, items: c.items.filter(i => i.id !== itemId) })))
    setPacked(prev => prev.filter(p => p.item_id !== itemId))
    await deleteItem(itemId)
  }, [])

  const handleItemSaved = useCallback((itemId: string, changes: Partial<Item>) => {
    setCategories(prev => prev.map(c => ({
      ...c,
      items: c.items.map(i => i.id === itemId ? { ...i, ...changes } : i),
    })))
  }, [])

  const handleItemDeleted = useCallback((itemId: string) => {
    setCategories(prev => prev.map(c => ({ ...c, items: c.items.filter(i => i.id !== itemId) })))
    setPacked(prev => prev.filter(p => p.item_id !== itemId))
  }, [])

  const totalItems = categories.reduce((s, c) => s + c.items.length, 0)
  const totalPacked = categories.reduce((s, c) =>
    s + c.items.filter(item => {
      const key = item.scope === 'each' ? ctx.memberKey : 'shared'
      return packed.some(p => p.item_id === item.id && p.user_key === key)
    }).length, 0)
  const pct = totalItems > 0 ? Math.round((totalPacked / totalItems) * 100) : 0

  // ── Search filter ──────────────────────────────────────────────────────────
  const q = query.trim().toLowerCase()
  const filteredCategories = useMemo(() => {
    if (!q) return categories
    return categories
      .map(c => ({
        ...c,
        items: c.items.filter(i =>
          i.name.toLowerCase().includes(q) ||
          (i.note?.toLowerCase().includes(q) ?? false)
        ),
      }))
      .filter(c => c.items.length > 0)
  }, [categories, q])

  const matchCount = q ? filteredCategories.reduce((s, c) => s + c.items.length, 0) : 0

  return (
    <>
      <div className="px-4 pt-4 pb-6 flex flex-col gap-3">
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <h1 className="font-display font-bold text-2xl uppercase tracking-tight text-text">Pack</h1>
            <span className="font-mono text-sm text-text-muted">{totalPacked}/{totalItems}</span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-accent transition-all duration-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <p className="font-mono text-xs text-text-muted mt-1">{pct}% packed</p>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search items…"
            aria-label="Search packing items"
            className="w-full h-10 bg-surface border border-border rounded-xl pl-9 pr-9 text-sm text-text font-body outline-none focus:border-accent/60 transition-colors placeholder:text-text-dim"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-text-dim hover:text-text transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </div>
        {q && (
          <p className="font-mono text-[11px] text-text-muted -mt-1">
            {matchCount} {matchCount === 1 ? 'match' : 'matches'} for &ldquo;{query.trim()}&rdquo;
          </p>
        )}

        {filteredCategories.map(cat => (
          <CategoryCard
            key={cat.id}
            category={cat}
            packed={packed}
            ctx={ctx}
            onToggle={handleToggle}
            onEdit={item => setEditingItem(item)}
            onDelete={handleDelete}
            forceOpen={!!q}
            hideAddForm={!!q}
          />
        ))}

        {q && filteredCategories.length === 0 && (
          <div className="text-center py-10 flex flex-col items-center gap-2">
            <Search size={22} className="text-text-dim" />
            <p className="font-mono text-xs text-text-muted">No items match &ldquo;{query.trim()}&rdquo;</p>
            <button
              onClick={() => setQuery('')}
              className="font-mono text-[11px] text-accent hover:underline"
            >
              Clear search
            </button>
          </div>
        )}
      </div>
      <EditItemSheet
        item={editingItem}
        role={ctx.memberKey}
        onClose={() => setEditingItem(null)}
        onSaved={handleItemSaved}
        onDeleted={handleItemDeleted}
      />
    </>
  )
}
