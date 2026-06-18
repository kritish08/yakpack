'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Check, Pencil, Trash2, X, Sparkles } from 'lucide-react'
import type { CategoryWithToBuy, Item, Packed, Profile, Category, Trip } from '@/lib/tobuy'
import { overallProgress, personProgress, categoryProgress } from '@/lib/progress'
import { addItem, updateItem, deleteItem } from '@/app/actions/items'
import { addCategory, updateCategory, deleteCategory } from '@/app/actions/categories'

// ── Chips ──────────────────────────────────────────────────────────────────────
const assignedChip: Record<string, { label: string; cls: string }> = {
  kritish: { label: 'K', cls: 'bg-accent/15 text-accent border-accent/30'    },
  partner: { label: 'G', cls: 'bg-accent-4/15 text-accent-4 border-accent-4/30' },
  shared:  { label: '2', cls: 'bg-accent-2/15 text-accent-2 border-accent-2/30' },
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface SummaryScreenProps {
  profile:              Profile
  categories:           Category[]
  allItems:             Item[]
  categoriesWithToBuy:  CategoryWithToBuy[]
  packed:               Packed[]
  trip:                 Trip | null
  today:                string
  aiEnabled?:           boolean
  gapsNode?:            ReactNode
}

type AssignedTo = 'kritish' | 'partner' | 'shared'
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
  profile, categories, allItems, categoriesWithToBuy, packed, trip, today, aiEnabled, gapsNode,
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
  useEffect(() => {
    setToBuyItems(categoriesWithToBuy.flatMap(c => c.items))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesWithToBuy])

  useEffect(() => {
    setLocalCategories(categories)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories])

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

  // ── Category sheet state ─────────────────────────────────────────────────────
  const [catSheet,   setCatSheet]   = useState<CatSheetState | null>(null)
  const [catForm,    setCatForm]    = useState<CatFormState>({ name: '', icon: '' })
  const [isCatSaving, setIsCatSaving] = useState(false)
  const [catError,    setCatError]   = useState<string | null>(null)

  // Grouped view
  const localCatsWithToBuy: CategoryWithToBuy[] = localCategories
    .map(cat => ({ ...cat, items: toBuyItems.filter(i => i.category_id === cat.id) }))
    .filter(cat => cat.items.length > 0)

  const partnerRole = profile.role === 'kritish' ? 'partner' : 'kritish'
  const myLabel     = profile.display_name || (profile.role === 'kritish' ? 'Kritish' : 'Gitansh')
  const partLabel   = profile.role === 'kritish' ? 'Gitansh' : 'Kritish'

  const overall = overallProgress(allItems, packed, profile.role)
  const me      = personProgress(allItems, packed, profile.role,  myLabel,  'bg-accent')
  const partner = personProgress(allItems, packed, partnerRole, partLabel, 'bg-accent-4')

  const pct   = overall.total > 0 ? Math.round((overall.done / overall.total) * 100) : 0
  const mePct = me.total      > 0 ? Math.round((me.done      / me.total)      * 100) : 0
  const ptPct = partner.total > 0 ? Math.round((partner.done / partner.total) * 100) : 0

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
        headers: { 'Content-Type': 'application/json' },
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

  function handleMarkBought(item: Item) {
    setToBuyItems(prev => prev.filter(i => i.id !== item.id))
    updateItem(item.id, { status: 'owned' }).catch(() => {
      setToBuyItems(prev => [...prev, item])
    })
  }

  function handleDelete(item: Item) {
    setToBuyItems(prev => prev.filter(i => i.id !== item.id))
    deleteItem(item.id).catch(() => {
      setToBuyItems(prev => [...prev, item])
    })
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
          <p className="font-mono text-xs text-text-muted mt-1">{trip?.name ?? 'Spiti Valley'}</p>
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
      <div className="grid grid-cols-2 gap-3">
        {([
          { label: 'Me',      stat: me,      pct: mePct, bar: 'bg-accent',   border: 'border-accent/20',   text: 'text-accent'   },
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

      {/* ── Pemba's AI risk check (Suspense-streamed from server) ── */}
      {gapsNode}

      {/* ── Still to buy — with full CRUD ── */}
      <section className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-wider text-text-muted">Still to buy</p>
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
                      <span className="font-body text-sm text-text flex-1 min-w-0 truncate">{item.name}</span>
                      {item.qty && <span className="font-mono text-xs text-text-muted shrink-0">×{item.qty}</span>}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleMarkBought(item)}
                          className="w-7 h-7 rounded-full bg-accent-2/10 border border-accent-2/20 flex items-center justify-center text-accent-2 hover:bg-accent-2/20 active:scale-90 transition-all"
                          title="Mark as bought"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={() => openEdit(item)}
                          className="w-7 h-7 rounded-full bg-surface-2 border border-border flex items-center justify-center text-text-muted hover:text-text hover:border-accent/30 active:scale-90 transition-all"
                          title="Edit"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="w-7 h-7 rounded-full bg-accent-3/10 border border-accent-3/20 flex items-center justify-center text-accent-3 hover:bg-accent-3/20 active:scale-90 transition-all"
                          title="Delete"
                        >
                          <Trash2 size={11} />
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
                  className="w-7 h-7 rounded-full bg-surface-2 border border-border flex items-center justify-center text-text-muted hover:text-text hover:border-accent/30 active:scale-90 transition-all"
                  title="Edit category"
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={() => handleCatDelete(cat)}
                  disabled={isCatSaving}
                  className="w-7 h-7 rounded-full bg-accent-3/10 border border-accent-3/20 flex items-center justify-center text-accent-3 hover:bg-accent-3/20 active:scale-90 transition-all disabled:opacity-40"
                  title="Delete category"
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
                {(['kritish', 'partner', 'shared'] as const).map(role => (
                  <button
                    key={role}
                    onClick={() => setForm(f => ({ ...f, assigned_to: role }))}
                    className={`flex-1 py-2 rounded-xl font-body text-xs border transition-colors ${
                      form.assigned_to === role
                        ? 'bg-accent text-bg border-accent'
                        : 'bg-surface-2 text-text-muted border-border hover:border-accent/30'
                    }`}
                  >
                    {role === 'kritish' ? 'Kritish' : role === 'partner' ? 'Partner' : 'Both'}
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
