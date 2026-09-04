'use client'

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Check, Pencil, Trash2, Ban, X, Sparkles, Search } from 'lucide-react'
import type { CategoryWithToBuy, Item, Packed, Category, Trip } from '@/lib/tobuy'
import type { AssignedTo as MemberAssigned, MemberKey as MemberKeyT, MemberView } from '@/lib/database.types'
import { overallProgress, personProgress, categoryProgress } from '@/lib/progress'
import { addItem, updateItem, removeFromShopping } from '@/app/actions/items'
import { applyStatusOps, enqueueOp, readQueue } from '@/lib/offline-queue'
import { addCategory, updateCategory, deleteCategory } from '@/app/actions/categories'
import { byokHeaders } from '@/lib/byok'

// One colour per slot, matching the person dots on the Pack screen.
const SLOT_BAR: Record<MemberKeyT, string> = {
  organiser: 'bg-accent',
  partner_1: 'bg-accent-4',
  partner_2: 'bg-accent-2',
  partner_3: 'bg-accent-5',
}
const SLOT_STYLE: Record<MemberKeyT, { bar: string; border: string; text: string }> = {
  organiser: { bar: 'bg-accent',   border: 'border-accent/20',   text: 'text-accent'   },
  partner_1: { bar: 'bg-accent-4', border: 'border-accent-4/20', text: 'text-accent-4' },
  partner_2: { bar: 'bg-accent-2', border: 'border-accent-2/20', text: 'text-accent-2' },
  partner_3: { bar: 'bg-accent-5', border: 'border-accent-5/20', text: 'text-accent-5' },
}

// ── Chips ──────────────────────────────────────────────────────────────────────
const assignedChip: Record<string, { label: string; cls: string }> = {
  kritish: { label: 'K', cls: 'bg-accent/15 text-accent border-accent/30'    },
  partner: { label: 'G', cls: 'bg-accent-4/15 text-accent-4 border-accent-4/30' },
  shared:  { label: '2', cls: 'bg-accent-2/15 text-accent-2 border-accent-2/30' },
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface SummaryScreenProps {
  ctx:                  MemberView
  categories:           Category[]
  allItems:             Item[]
  categoriesWithToBuy:  CategoryWithToBuy[]
  packed:               Packed[]
  trip:                 Trip | null
  today:                string
  aiEnabled?:           boolean
  gapsNode?:            ReactNode
}

type AssignedTo = MemberAssigned
type SheetState = { mode: 'add' } | { mode: 'edit'; item: Item }
type CatSheetState = { mode: 'add' } | { mode: 'edit'; cat: Category }

interface FormState {
  name:        string
  qty:         string
  category_id: number
  assigned_to: AssignedTo
}

interface CatFormState {
  name: string
  icon: string
}

// ── Trip countdown chip ────────────────────────────────────────────────────────
function TripChip({ trip, today }: { trip: Trip | null; today: string }) {
  if (!trip?.depart_date) return null
  const diff = Math.ceil(
    (new Date(trip.depart_date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000
  )
  if (diff > 0)   return <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/30">{diff}d to go</span>
  if (diff === 0) return <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-accent-2/10 text-accent-2 border border-accent-2/30">Departs today!</span>
  return <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-accent-2/10 text-accent-2 border border-accent-2/30">Day {Math.abs(diff) + 1} of 9</span>
}

// ── Bottom sheet wrapper ────────────────────────────────────────────────────────
function BottomSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-surface rounded-t-2xl border-t border-border w-full flex flex-col overflow-hidden"
        style={{ maxHeight: 'calc(100dvh - 20px)' }}
      >
        {children}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SummaryScreen({
  ctx, categories, allItems, categoriesWithToBuy, packed, trip, today, aiEnabled, gapsNode,
}: SummaryScreenProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Local mutable copy of to-buy items (optimistic)
  const [toBuyItems, setToBuyItems] = useState<Item[]>(
    () => categoriesWithToBuy.flatMap(c => c.items)
  )

  // Local copy of categories for CRUD
  const [localCategories, setLocalCategories] = useState<Category[]>(categories)

  // Sync when server re-fetches (router.refresh)
  // Project the outbox over the server-rendered list.
  //
  // Offline, this page comes from the service worker's cache and carries the
  // statuses from when it was last cached — before anything was marked bought.
  // Replaying the queue keeps those purchases off the list until the flush
  // lands; without it a reload puts everything you just bought back.
  useEffect(() => {
    const all = applyStatusOps(categoriesWithToBuy.flatMap(c => c.items), readQueue())
    setToBuyItems(all.filter(i => i.status === 'to_buy'))
  }, [categoriesWithToBuy])

  useEffect(() => {
    setLocalCategories(categories)
  }, [categories])

  // Realtime — the other phone's edits land here too.
  //
  // Summary renders from server props and has no optimistic channel for REMOTE
  // writes, so rather than hand-patching local state from each payload we just
  // re-fetch: router.refresh() re-runs getToBuyData() and the two sync effects
  // above pick the new props up. Debounced because one action can emit a burst
  // of row events (deleting a category, or Pemba adding ten items at once).
  const supabase = useMemo(() => createClient(), [])
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => startTransition(() => router.refresh()), 250)
    }
    const channel = supabase
      .channel('summary-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' },      scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packed' },     scheduleRefresh)
      .subscribe()
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      supabase.removeChannel(channel)
    }
  }, [supabase, router])

  // ── Item sheet state ─────────────────────────────────────────────────────────
  const [sheet,    setSheet]    = useState<SheetState | null>(null)
  const [form,     setForm]     = useState<FormState>({
    name:        '',
    qty:         '',
    category_id: (categories[0]?.id as number) ?? 1,
    assigned_to: 'shared',
  })
  const [isSaving,     setIsSaving]     = useState(false)
  const [isSuggesting, setIsSuggesting] = useState(false)

  // ── Shopping-list search ──────────────────────────────────────────────────────
  const [shopQuery, setShopQuery] = useState('')

  // ── Category sheet state ─────────────────────────────────────────────────────
  const [catSheet,   setCatSheet]   = useState<CatSheetState | null>(null)
  const [catForm,    setCatForm]    = useState<CatFormState>({ name: '', icon: '' })
  const [isCatSaving, setIsCatSaving] = useState(false)
  const [catError,    setCatError]   = useState<string | null>(null)

  // Map category id → name for the "in Pack · {category}" row caption
  const catNameById = new Map<number, string>(
    localCategories.map(c => [c.id as number, c.name])
  )

  // Grouped view — filtered by the shopping-list search query
  const sq = shopQuery.trim().toLowerCase()
  const visibleToBuy = sq
    ? toBuyItems.filter(i =>
        i.name.toLowerCase().includes(sq) ||
        (catNameById.get(i.category_id ?? -1)?.toLowerCase().includes(sq) ?? false)
      )
    : toBuyItems
  const localCatsWithToBuy: CategoryWithToBuy[] = localCategories
    .map(cat => ({ ...cat, items: visibleToBuy.filter(i => i.category_id === cat.id) }))
    .filter(cat => cat.items.length > 0)

  const overall = overallProgress(allItems, packed, ctx.memberKey)
  const pct = overall.total > 0 ? Math.round((overall.done / overall.total) * 100) : 0

  // One card per person actually in the trip, mine first. A solo trip shows one
  // card rather than a second empty one for a partner who does not exist.
  const perPerson = [...ctx.members]
    .sort((a, b) => Number(b.isMe) - Number(a.isMe))
    .map(m => {
      const stat = personProgress(allItems, packed, m.memberKey, m.displayName, SLOT_BAR[m.memberKey])
      return {
        key: m.memberKey,
        label: m.isMe ? 'Me' : m.displayName,
        stat,
        pct: stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0,
        ...SLOT_STYLE[m.memberKey],
      }
    })

  // ── Item sheet handlers ──────────────────────────────────────────────────────
  function openAdd() {
    setForm({ name: '', qty: '', category_id: (localCategories[0]?.id as number) ?? 1, assigned_to: 'shared' })
    setSheet({ mode: 'add' })
  }

  function openEdit(item: Item) {
    setForm({
      name:        item.name,
      qty:         item.qty ?? '',
      category_id: item.category_id ?? ((localCategories[0]?.id as number) ?? 1),
      assigned_to: (item.assigned_to as AssignedTo) ?? 'shared',
    })
    setSheet({ mode: 'edit', item })
  }

  async function handlePembaSuggest() {
    if (!form.name.trim()) return
    setIsSuggesting(true)
    try {
      const res = await fetch('/api/ai/parse-item', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...byokHeaders() },
        body:    JSON.stringify({ text: form.name, categories: localCategories.map(c => ({ id: c.id, name: c.name })) }),
      })
      if (!res.ok) return
      const { items } = await res.json()
      if (items?.[0]) {
        const suggestion = items[0]
        const matchedCat = suggestion.suggested_category
          ? localCategories.find(c => c.name.toLowerCase() === suggestion.suggested_category.toLowerCase())
          : null
        setForm(f => ({
          ...f,
          qty:         suggestion.qty        ?? f.qty,
          assigned_to: suggestion.assigned_to ?? f.assigned_to,
          category_id: matchedCat?.id         ?? f.category_id,
        }))
      }
    } catch { /* silently ignore */ }
    finally { setIsSuggesting(false) }
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setIsSaving(true)
    try {
      if (sheet?.mode === 'add') {
        await addItem({
          name:        form.name.trim(),
          qty:         form.qty || undefined,
          category_id: form.category_id,
          assigned_to: form.assigned_to,
          status:      'to_buy',
          scope:       form.assigned_to === 'shared' ? 'shared' : 'each',
        })
        startTransition(() => router.refresh())
      } else if (sheet?.mode === 'edit') {
        const { item } = sheet
        setToBuyItems(prev => prev.map(i =>
          i.id === item.id
            ? { ...i, name: form.name.trim(), qty: form.qty || null, category_id: form.category_id, assigned_to: form.assigned_to }
            : i
        ))
        await updateItem(item.id, {
          name:        form.name.trim(),
          qty:         form.qty || null,
          category_id: form.category_id,
          assigned_to: form.assigned_to,
        })
      }
    } finally {
      setIsSaving(false)
      setSheet(null)
    }
  }

  /**
   * Marking something bought.
   *
   * On failure the tick is KEPT and the write is queued, rather than rolled
   * back. This screen is used standing in a shop, which is where signal is
   * worst, and the old behaviour made the item you had just bought reappear on
   * the list — the app disagreeing with the bag in your hand. The queue replays
   * on reconnect; <OfflineSync> handles that app-wide.
   */
  function handleMarkBought(item: Item) {
    setToBuyItems(prev => prev.filter(i => i.id !== item.id))
    updateItem(item.id, { status: 'owned' })
      .then(() => startTransition(() => router.refresh()))
      .catch(() => enqueueOp({ kind: 'status', item_id: item.id, status: 'owned' }))
  }

  // "Not buying / already have" — leaves the shopping list but stays in Pack.
  function handleRemoveFromShopping(item: Item) {
    setToBuyItems(prev => prev.filter(i => i.id !== item.id))
    removeFromShopping(item.id)
      .then(() => startTransition(() => router.refresh()))
      .catch(() => enqueueOp({ kind: 'status', item_id: item.id, status: 'standard' }))
  }

  // ── Category sheet handlers ──────────────────────────────────────────────────
  function openCatAdd() {
    setCatForm({ name: '', icon: '' })
    setCatError(null)
    setCatSheet({ mode: 'add' })
  }

  function openCatEdit(cat: Category) {
    setCatForm({ name: cat.name, icon: cat.icon ?? '' })
    setCatError(null)
    setCatSheet({ mode: 'edit', cat })
  }

  async function handleCatSave() {
    if (!catForm.name.trim()) return
    setIsCatSaving(true)
    setCatError(null)
    try {
      if (catSheet?.mode === 'add') {
        await addCategory({ name: catForm.name.trim(), icon: catForm.icon.trim() || undefined })
        startTransition(() => router.refresh())
      } else if (catSheet?.mode === 'edit') {
        const { cat } = catSheet
        setLocalCategories(prev => prev.map(c =>
          c.id === cat.id ? { ...c, name: catForm.name.trim(), icon: catForm.icon.trim() || null } : c
        ))
        await updateCategory(cat.id as number, {
          name: catForm.name.trim(),
          icon: catForm.icon.trim() || null,
        })
      }
      setCatSheet(null)
    } catch (e) {
      setCatError(String(e))
    } finally {
      setIsCatSaving(false)
    }
  }

  async function handleCatDelete(cat: Category) {
    setCatError(null)
    setIsCatSaving(true)
    try {
      setLocalCategories(prev => prev.filter(c => c.id !== cat.id))
      await deleteCategory(cat.id as number)
      startTransition(() => router.refresh())
    } catch (e) {
      setLocalCategories(prev => [...prev, cat])
      setCatError(String(e))
    } finally {
      setIsCatSaving(false)
      setCatSheet(null)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 pt-5 pb-20 flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl uppercase tracking-tight text-text leading-none">Summary</h1>
          <p className="font-mono text-xs text-text-muted mt-1">{trip?.name ?? 'Your trip'}</p>
        </div>
        <TripChip trip={trip} today={today} />
      </div>

      {/* Overall progress */}
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
      <div className={`grid gap-3 ${perPerson.length >= 3 ? 'grid-cols-3' : perPerson.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {perPerson.map(({ key, label, stat, pct: p, bar, border, text }) => (
          <div key={key} className={`bg-surface border rounded-xl p-3 ${border}`}>
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

      {/* ── Pemba's AI risk check (Suspense-streamed from server) ── */}
      {gapsNode}

      {/* ── Shopping list — non-destructive ── */}
      <section className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] uppercase tracking-wider text-text-muted">To buy before we leave</p>
            <div className="flex items-center gap-2.5">
              <span className={`font-mono text-xs font-bold ${toBuyItems.length > 0 ? 'text-accent-3' : 'text-accent-2'}`}>
                {toBuyItems.length === 0 ? 'All done ✓' : `${toBuyItems.length} items`}
              </span>
              <button
                onClick={openAdd}
                className="w-7 h-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent hover:bg-accent/20 active:scale-90 transition-all"
                aria-label="Add to-buy item"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>
          <p className="font-mono text-[10px] text-text-dim mt-1.5 leading-snug">
            Removing here won&apos;t delete from your pack — it just clears the shopping flag.
          </p>

          {/* Search */}
          {toBuyItems.length > 0 && (
            <div className="relative mt-2.5">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none" />
              <input
                type="text"
                value={shopQuery}
                onChange={e => setShopQuery(e.target.value)}
                placeholder="Search to-buy items…"
                aria-label="Search to-buy items"
                className="w-full h-9 bg-surface-2 border border-border rounded-xl pl-8 pr-8 text-sm text-text font-body outline-none focus:border-accent/60 transition-colors placeholder:text-text-dim"
              />
              {shopQuery && (
                <button
                  onClick={() => setShopQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-dim hover:text-text transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        {toBuyItems.length === 0 ? (
          <div className="px-4 py-5 flex flex-col items-center gap-2">
            <p className="font-mono text-xs text-text-muted text-center">Nothing left to buy — you&apos;re set.</p>
            <button
              onClick={openAdd}
              className="mt-1 px-4 py-1.5 rounded-full border border-dashed border-border text-text-muted font-body text-xs hover:border-accent/40 hover:text-accent transition-colors flex items-center gap-1.5"
            >
              <Plus size={11} /> Add item
            </button>
          </div>
        ) : localCatsWithToBuy.length === 0 ? (
          <div className="px-4 py-6 flex flex-col items-center gap-2">
            <Search size={20} className="text-text-dim" />
            <p className="font-mono text-xs text-text-muted text-center">No to-buy items match &ldquo;{shopQuery.trim()}&rdquo;</p>
            <button onClick={() => setShopQuery('')} className="font-mono text-[11px] text-accent hover:underline">
              Clear search
            </button>
          </div>
        ) : (
          <div>
            {localCatsWithToBuy.map(cat => (
              <div key={cat.id}>
                <div className="px-4 pt-2.5 pb-1 flex items-center gap-2">
                  {cat.icon && <span className="text-sm">{cat.icon}</span>}
                  <span className="font-mono text-[10px] uppercase tracking-wider text-text-dim">{cat.name}</span>
                </div>
                {cat.items.map(item => {
                  const chip = assignedChip[item.assigned_to] ?? assignedChip.shared
                  return (
                    <div key={item.id} className="px-4 py-2.5 flex items-center gap-3 border-t border-border/30">
                      <span className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center font-mono text-[9px] font-bold ${chip.cls}`}>
                        {chip.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm text-text truncate">{item.name}</p>
                        {item.category_id != null && catNameById.has(item.category_id) && (
                          <p className="font-mono text-[10px] text-text-dim truncate">
                            in Pack · {catNameById.get(item.category_id)}
                          </p>
                        )}
                      </div>
                      {item.qty && <span className="font-mono text-xs text-text-muted shrink-0">×{item.qty}</span>}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleMarkBought(item)}
                          className="w-7 h-7 min-w-[44px] min-h-[44px] rounded-full bg-accent-2/10 border border-accent-2/20 flex items-center justify-center text-accent-2 hover:bg-accent-2/20 active:scale-90 transition-all"
                          title="Mark as bought"
                          aria-label="Mark as bought"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={() => openEdit(item)}
                          className="w-7 h-7 min-w-[44px] min-h-[44px] rounded-full bg-surface-2 border border-border flex items-center justify-center text-text-muted hover:text-text hover:border-accent/30 active:scale-90 transition-all"
                          title="Edit"
                          aria-label="Edit item"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => handleRemoveFromShopping(item)}
                          className="w-7 h-7 min-w-[44px] min-h-[44px] rounded-full bg-surface-2 border border-border flex items-center justify-center text-text-muted hover:text-text hover:border-border active:scale-90 transition-all"
                          title="Not buying / already have — keeps it in Pack"
                          aria-label="Not buying — keep in Pack"
                        >
                          <Ban size={11} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Category breakdown */}
      <section className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="font-mono text-[11px] uppercase tracking-wider text-text-muted">By category</p>
        </div>
        <div className="divide-y divide-border/40">
          {localCategories.map(cat => {
            const s = categoryProgress(allItems, packed, ctx.memberKey, cat.id as number, cat.name)
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

      {/* ── Categories CRUD ── */}
      <section className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-wider text-text-muted">Manage categories</p>
          <button
            onClick={openCatAdd}
            className="w-7 h-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent hover:bg-accent/20 active:scale-90 transition-all"
            aria-label="Add category"
          >
            <Plus size={13} />
          </button>
        </div>
        {catError && (
          <div className="px-4 py-2 bg-accent-3/5 border-b border-accent-3/20">
            <p className="font-mono text-[10px] text-accent-3">{catError}</p>
          </div>
        )}
        <div className="divide-y divide-border/40">
          {localCategories.map(cat => (
            <div key={cat.id} className="px-4 py-2.5 flex items-center gap-3">
              {cat.icon
                ? <span className="text-base shrink-0 w-6 text-center">{cat.icon}</span>
                : <span className="shrink-0 w-6 text-center font-mono text-xs text-text-dim">—</span>
              }
              <span className="font-body text-sm text-text flex-1 min-w-0 truncate">{cat.name}</span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openCatEdit(cat)}
                  className="w-7 h-7 min-w-[44px] min-h-[44px] rounded-full bg-surface-2 border border-border flex items-center justify-center text-text-muted hover:text-text hover:border-accent/30 active:scale-90 transition-all"
                  title="Edit category"
                  aria-label="Edit category"
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={() => handleCatDelete(cat)}
                  disabled={isCatSaving}
                  className="w-7 h-7 min-w-[44px] min-h-[44px] rounded-full bg-accent-3/10 border border-accent-3/20 flex items-center justify-center text-accent-3 hover:bg-accent-3/20 active:scale-90 transition-all disabled:opacity-40"
                  title="Delete category"
                  aria-label="Delete category"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Add / Edit item sheet ── */}
      {sheet && (
        <BottomSheet onClose={() => !isSaving && setSheet(null)}>
          {/* Drag handle */}
          <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-0 shrink-0" />

          {/* Sheet header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <h2 className="font-display font-bold text-sm uppercase tracking-tight text-text">
              {sheet.mode === 'add' ? 'Add to Buy' : 'Edit Item'}
            </h2>
            <div className="flex items-center gap-2">
              {aiEnabled && (
                <button
                  onClick={handlePembaSuggest}
                  disabled={!form.name.trim() || isSuggesting}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-accent/10 border border-accent/20 text-accent font-mono text-[10px] disabled:opacity-40 active:scale-95 transition-all"
                  title="Let Pemba suggest category, qty & assignee"
                >
                  <Sparkles size={11} className={isSuggesting ? 'animate-pulse' : ''} />
                  {isSuggesting ? 'Thinking…' : 'Pemba suggest'}
                </button>
              )}
              <button onClick={() => setSheet(null)} disabled={isSaving} className="p-1.5 text-text-muted hover:text-text transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Scrollable form */}
          <div className="overflow-y-auto flex-1 px-4 pb-2">
            {/* Name */}
            <div className="mb-3">
              <label className="font-mono text-[10px] uppercase tracking-wider text-text-muted mb-1.5 block">Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Hand sanitiser"
                className="w-full h-10 bg-surface-2 border border-border rounded-xl px-3.5 text-sm text-text font-body outline-none focus:border-accent/60 transition-colors placeholder:text-text-dim"
                autoFocus
              />
            </div>

            {/* Qty */}
            <div className="mb-3">
              <label className="font-mono text-[10px] uppercase tracking-wider text-text-muted mb-1.5 block">Qty (optional)</label>
              <input
                value={form.qty}
                onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                placeholder="e.g. 2"
                className="w-full h-10 bg-surface-2 border border-border rounded-xl px-3.5 text-sm text-text font-body outline-none focus:border-accent/60 transition-colors placeholder:text-text-dim"
              />
            </div>

            {/* Category */}
            <div className="mb-3">
              <label className="font-mono text-[10px] uppercase tracking-wider text-text-muted mb-1.5 block">Category</label>
              <div className="flex flex-wrap gap-1.5">
                {localCategories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setForm(f => ({ ...f, category_id: cat.id as number }))}
                    className={`px-3 py-1.5 rounded-xl font-body text-xs border transition-colors ${
                      form.category_id === cat.id
                        ? 'bg-accent text-bg border-accent'
                        : 'bg-surface-2 text-text-muted border-border hover:border-accent/30 hover:text-text'
                    }`}
                  >
                    {cat.icon && <span className="mr-1">{cat.icon}</span>}{cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Assigned to */}
            <div className="mb-3">
              <label className="font-mono text-[10px] uppercase tracking-wider text-text-muted mb-1.5 block">For</label>
              <div className="flex gap-2">
                {([...ctx.members.map(m => m.memberKey), 'shared' as const]).map(role => (
                  <button
                    key={role}
                    onClick={() => setForm(f => ({ ...f, assigned_to: role }))}
                    className={`flex-1 py-2 rounded-xl font-body text-xs border transition-colors ${
                      form.assigned_to === role
                        ? 'bg-accent text-bg border-accent'
                        : 'bg-surface-2 text-text-muted border-border hover:border-accent/30'
                    }`}
                  >
                    {role === 'shared'
                      ? 'Everyone'
                      : ctx.members.find(m => m.memberKey === role)?.displayName ?? role}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions — pinned to bottom of sheet */}
          <div className="px-4 pb-4 pt-2 border-t border-border/40 shrink-0">
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || isSaving || isPending}
                className="flex-1 py-2.5 rounded-xl bg-accent text-bg font-display font-bold uppercase tracking-tight text-sm disabled:opacity-40 min-h-[44px] transition-opacity"
              >
                {isSaving || isPending ? 'Saving…' : sheet.mode === 'add' ? 'Add Item' : 'Save Changes'}
              </button>
              <button
                onClick={() => setSheet(null)}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-surface-2 border border-border text-text-muted font-body text-sm min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* ── Add / Edit category sheet ── */}
      {catSheet && (
        <BottomSheet onClose={() => !isCatSaving && setCatSheet(null)}>
          <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-0 shrink-0" />

          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <h2 className="font-display font-bold text-sm uppercase tracking-tight text-text">
              {catSheet.mode === 'add' ? 'New Category' : 'Edit Category'}
            </h2>
            <button onClick={() => setCatSheet(null)} disabled={isCatSaving} className="p-1.5 text-text-muted hover:text-text transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-4 pb-2">
            {catError && (
              <p className="font-mono text-[10px] text-accent-3 mb-3 bg-accent-3/5 border border-accent-3/20 rounded-xl px-3 py-2">{catError}</p>
            )}

            <div className="mb-3">
              <label className="font-mono text-[10px] uppercase tracking-wider text-text-muted mb-1.5 block">Name *</label>
              <input
                value={catForm.name}
                onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. First Aid"
                className="w-full h-10 bg-surface-2 border border-border rounded-xl px-3.5 text-sm text-text font-body outline-none focus:border-accent/60 transition-colors placeholder:text-text-dim"
                autoFocus
              />
            </div>

            <div className="mb-3">
              <label className="font-mono text-[10px] uppercase tracking-wider text-text-muted mb-1.5 block">Icon emoji (optional)</label>
              <input
                value={catForm.icon}
                onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))}
                placeholder="e.g. 🩺"
                className="w-full h-10 bg-surface-2 border border-border rounded-xl px-3.5 text-sm text-text font-body outline-none focus:border-accent/60 transition-colors placeholder:text-text-dim"
              />
            </div>
          </div>

          <div className="px-4 pb-4 pt-2 border-t border-border/40 shrink-0">
            <div className="flex gap-2">
              <button
                onClick={handleCatSave}
                disabled={!catForm.name.trim() || isCatSaving}
                className="flex-1 py-2.5 rounded-xl bg-accent text-bg font-display font-bold uppercase tracking-tight text-sm disabled:opacity-40 min-h-[44px] transition-opacity"
              >
                {isCatSaving ? 'Saving…' : catSheet.mode === 'add' ? 'Add Category' : 'Save Changes'}
              </button>
              <button
                onClick={() => setCatSheet(null)}
                disabled={isCatSaving}
                className="px-5 py-2.5 rounded-xl bg-surface-2 border border-border text-text-muted font-body text-sm min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  )
}
