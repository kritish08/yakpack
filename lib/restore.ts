/**
 * lib/restore.ts — YakPack additive restore
 *
 * Re-inserts master packing-list items from docs/01 that are MISSING from the
 * database (e.g. accidentally hard-deleted via the old "Still to buy" bug).
 *
 * SAFE / NON-DESTRUCTIVE:
 *   - Never deletes anything.
 *   - Never touches existing items, custom items, edits, or packed progress.
 *   - Only inserts master items whose (category, name) pair is absent, plus
 *     their packed rows.
 *
 * Usage:
 *   pnpm tsx lib/restore.ts --dry-run    # show what would be restored
 *   pnpm tsx lib/restore.ts              # apply
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { parsePackingList } from './seed'

config({ path: path.resolve(process.cwd(), '.env.local') })

// Normalise a name for comparison (case/space-insensitive)
function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run')

  const packingListPath = path.resolve(process.cwd(), 'docs/01_packing_list_master.md')
  if (!fs.existsSync(packingListPath)) {
    console.error(`ERROR: Cannot find ${packingListPath}`)
    process.exit(1)
  }

  const { categories: masterCategories, items: masterItems } =
    parsePackingList(fs.readFileSync(packingListPath, 'utf-8'))

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
    process.exit(1)
  }
  const supabase = createClient(supabaseUrl, serviceKey)

  // ── Target trip ─────────────────────────────────────────────────────────────
  // Every query below is scoped to one trip. Restoring across all trips would
  // push this repo's master list into strangers' accounts, so the target is
  // explicit: --trip=<uuid>, defaulting to the template that new signups copy.
  const tripArg = process.argv.find(a => a.startsWith('--trip='))?.slice('--trip='.length)
  let tripId = tripArg ?? null
  if (!tripId) {
    const { data: tpl, error } = await supabase
      .from('trips').select('id').eq('is_template', true).order('created_at').limit(1).maybeSingle()
    if (error) { console.error('ERROR reading template trip:', error); process.exit(1) }
    tripId = (tpl as { id: string } | null)?.id ?? null
  }
  if (!tripId) {
    console.error('ERROR: no target trip. Run `pnpm seed` first, or pass --trip=<uuid>.')
    process.exit(1)
  }
  console.log(`Target trip: ${tripId}`)

  // ── Current DB state ────────────────────────────────────────────────────────
  const { data: dbCategories, error: catErr } = await supabase
    .from('categories')
    .select('id, name, sort_order')
    .eq('trip_id', tripId)
  if (catErr) { console.error('ERROR reading categories:', catErr); process.exit(1) }

  const { data: dbItems, error: itemErr } = await supabase
    .from('items')
    .select('id, name, category_id')
    .eq('trip_id', tripId)
  if (itemErr) { console.error('ERROR reading items:', itemErr); process.exit(1) }

  // sort_order → category_id (master uses sort_order as the stable key)
  const catIdBySortOrder = new Map<number, number>()
  const catNameById = new Map<number, string>()
  for (const c of dbCategories ?? []) {
    catIdBySortOrder.set(c.sort_order, c.id)
    catNameById.set(c.id, c.name)
  }

  // Set of existing "categoryId::normname"
  const existing = new Set<string>()
  for (const it of dbItems ?? []) {
    existing.add(`${it.category_id}::${norm(it.name)}`)
  }

  // ── Ensure any missing master categories exist first ────────────────────────
  const missingCategories = masterCategories.filter(
    mc => !catIdBySortOrder.has(mc.sort_order),
  )
  if (missingCategories.length > 0 && !isDryRun) {
    const { data: insertedCats, error } = await supabase
      .from('categories')
      .insert(missingCategories.map(c => ({ trip_id: tripId, name: c.name, sort_order: c.sort_order, icon: c.icon })))
      .select('id, name, sort_order')
    if (error) { console.error('ERROR inserting categories:', error); process.exit(1) }
    for (const c of insertedCats ?? []) {
      catIdBySortOrder.set(c.sort_order, c.id)
      catNameById.set(c.id, c.name)
    }
  }

  // ── Compute missing items ───────────────────────────────────────────────────
  const toRestore: Array<{
    category_id: number
    name: string
    status: string
    assigned_to: string
    scope: string
    carry_tags: string[]
    sort_order: number
    note: string | null
    qty: string | null
    is_custom: boolean
    _catName: string
  }> = []

  for (const mi of masterItems) {
    const categoryId = catIdBySortOrder.get(mi.category_sort_order)
    if (categoryId == null) {
      // category still missing (dry-run case) — we can't resolve id yet
      toRestore.push({
        category_id: -1,
        name: mi.name, status: mi.status, assigned_to: mi.assigned_to, scope: mi.scope,
        carry_tags: mi.carry_tags, sort_order: mi.sort_order, note: mi.note, qty: mi.qty,
        is_custom: false,
        _catName: `(new) sort ${mi.category_sort_order}`,
      })
      continue
    }
    const key = `${categoryId}::${norm(mi.name)}`
    if (existing.has(key)) continue
    toRestore.push({
      category_id: categoryId,
      name: mi.name, status: mi.status, assigned_to: mi.assigned_to, scope: mi.scope,
      carry_tags: mi.carry_tags, sort_order: mi.sort_order, note: mi.note, qty: mi.qty,
      is_custom: false,
      _catName: catNameById.get(categoryId) ?? String(categoryId),
    })
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  console.log('\n=== YakPack Restore ===\n')
  console.log(`Master items in docs/01:  ${masterItems.length}`)
  console.log(`Items currently in DB:    ${dbItems?.length ?? 0}`)
  console.log(`Missing master items:     ${toRestore.length}`)
  if (missingCategories.length > 0) {
    console.log(`Missing categories:       ${missingCategories.length} (${missingCategories.map(c => c.name).join(', ')})`)
  }
  console.log()

  if (toRestore.length === 0) {
    console.log('Nothing to restore — master list is fully present. ✓')
    return
  }

  const byCat = new Map<string, string[]>()
  for (const r of toRestore) {
    const arr = byCat.get(r._catName) ?? []
    arr.push(r.name + (r.status !== 'standard' ? ` [${r.status}]` : ''))
    byCat.set(r._catName, arr)
  }
  console.log('--- Will restore ---')
  for (const [cat, names] of byCat) {
    console.log(`  ${cat} (${names.length}): ${names.join(', ')}`)
  }
  console.log()

  if (isDryRun) {
    console.log('Dry run — no changes written. Re-run without --dry-run to apply.')
    return
  }

  // ── Insert missing items ────────────────────────────────────────────────────
  const rows = toRestore.map(r => ({
    category_id: r.category_id,
    name: r.name,
    status: r.status,
    assigned_to: r.assigned_to,
    scope: r.scope,
    carry_tags: r.carry_tags,
    sort_order: r.sort_order,
    note: r.note,
    qty: r.qty,
    is_custom: r.is_custom,
  }))

  const { data: inserted, error: insErr } = await supabase
    .from('items')
    .insert(rows.map(r => ({ ...r, trip_id: tripId })))
    .select('id, scope')
  if (insErr) { console.error('ERROR inserting items:', insErr); process.exit(1) }

  // ── Insert packed rows for the restored items ───────────────────────────────
  const packedRows: Array<{ item_id: string; user_key: string; packed: boolean }> = []
  for (const it of inserted ?? []) {
    if (it.scope === 'each') {
      packedRows.push({ item_id: it.id, user_key: 'organiser', packed: false })
      packedRows.push({ item_id: it.id, user_key: 'partner', packed: false })
    } else {
      packedRows.push({ item_id: it.id, user_key: 'shared', packed: false })
    }
  }
  if (packedRows.length > 0) {
    const { error: pErr } = await supabase.from('packed').insert(packedRows)
    if (pErr) { console.error('ERROR inserting packed rows:', pErr); process.exit(1) }
  }

  console.log(`Restored ${inserted?.length ?? 0} items + ${packedRows.length} packed rows. ✓`)
}

main().catch((err) => {
  console.error('Restore failed:', err)
  process.exit(1)
})
