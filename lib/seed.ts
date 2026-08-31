/**
 * lib/seed.ts — YakPack seed script
 *
 * Parses docs/01_packing_list_master.md → categories, items, packed, trip
 * Parses docs/02_itinerary.md → itinerary
 * Upserts into Supabase using the service role key (bypasses RLS).
 *
 * Usage:
 *   pnpm seed                # run against DB
 *   pnpm seed --dry-run      # print counts without touching DB
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load .env.local (Next.js convention) — works regardless of how the script is invoked
config({ path: path.resolve(process.cwd(), '.env.local') })

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryInsert {
  name: string
  sort_order: number
  icon: string | null
}

export interface ItemInsert {
  // category_id filled in after category upsert
  category_sort_order: number
  name: string
  status: 'owned' | 'to_buy' | 'standard'
  assigned_to: 'organiser' | 'partner_1' | 'partner_2' | 'shared'
  scope: 'each' | 'shared'
  carry_tags: string[]
  sort_order: number
  note: string | null
  qty: string | null
  is_custom: boolean
}

interface ItineraryInsert {
  day: number
  date: string | null
  leg: string
  lat: number
  lon: number
  altitude_m: number | null
  highlights: string | null
  carry_today: string[]
  prep_tonight: string | null
  warnings: string | null
  network: 'good' | 'weak' | 'none' | 'patchy' | null
  fun: string | null
  tip: string | null
}

interface TripInsert {
  name: string
  depart_date: string | null
}

interface ContactInsert {
  role: string
  name: string | null
  phone: string | null
  note: string | null
  sort_order: number
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

/** Sections to skip when parsing category blocks from docs/01 */
const SKIP_SECTIONS = new Set([
  'Trip Meta',
  'Trip Contacts',
  'Item Status Legend',
  'Seeding Notes',
  'Quick Tips',
])

/**
 * Rows of a pipe table under a given `## Heading`, as trimmed cell arrays.
 *
 * The header row and its `|---|---|` separator are dropped, so the caller gets
 * data only. Returns [] when the heading is absent — a trip file is allowed to
 * omit a section it has nothing to say about.
 */
function tableUnder(content: string, heading: string): string[][] {
  const section = content.split(/^## /m).find(s => s.trimStart().startsWith(heading))
  if (!section) return []

  return section
    .split('\n')
    .filter(l => l.trimStart().startsWith('|'))
    .map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()))
    .filter(cells => !cells.every(c => /^:?-{2,}:?$/.test(c)))
    .slice(1)
}

/** A table cell that is blank, or a placeholder standing in for a blank. */
function cellOrNull(raw: string | undefined): string | null {
  const v = (raw ?? '').replace(/^_+|_+$/g, '').trim()
  if (!v || v === '—' || v === '-' || /^\(.*\)$/.test(v)) return null
  return v
}

/**
 * Parse docs/01_packing_list_master.md
 * Returns { categories, items, trip, contacts }
 */
export function parsePackingList(content: string): {
  categories: CategoryInsert[]
  items: ItemInsert[]
  trip: TripInsert
  contacts: ContactInsert[]
} {
  const lines = content.split('\n')
  const categories: CategoryInsert[] = []
  const items: ItemInsert[] = []

  let currentCategorySortOrder: number | null = null
  let itemSortOrder = 0

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    // ── Category heading ──────────────────────────────────────────────────────
    if (line.startsWith('## ')) {
      const heading = line.slice(3).trim()

      // Check if it is a numbered category: "NN · Name"
      const numberedMatch = heading.match(/^(\d+)\s*·\s*(.+)$/)
      if (numberedMatch) {
        const sortOrder = parseInt(numberedMatch[1], 10)
        const name = numberedMatch[2].trim()
        categories.push({ name, sort_order: sortOrder, icon: null })
        currentCategorySortOrder = sortOrder
        itemSortOrder = 0
      } else {
        // Non-numbered heading — skip items under it
        const headingName = heading.split('·')[0].trim()
        if (SKIP_SECTIONS.has(headingName) || !numberedMatch) {
          currentCategorySortOrder = null
        }
      }
      continue
    }

    // ── Item bullet ───────────────────────────────────────────────────────────
    if (line.startsWith('- ') && currentCategorySortOrder !== null) {
      const bullet = line.slice(2).trim()

      // Extract name from **...**
      const nameMatch = bullet.match(/\*\*(.+?)\*\*/)
      if (!nameMatch) continue
      const name = nameMatch[1].trim()

      // Extract status from backtick: `owned` | `to_buy` | `standard`
      const statusMatch = bullet.match(/`(owned|to_buy|standard)`/)
      const status: ItemInsert['status'] = statusMatch
        ? (statusMatch[1] as ItemInsert['status'])
        : 'standard'

      // Determine scope from trailing word on the line
      // Common patterns: "· each", "· shared", " each", " shared"
      // The trailing word (after the last whitespace) is the scope indicator.
      const trailingWord = bullet.split(/\s+/).pop()?.toLowerCase()
      const scope: ItemInsert['scope'] =
        trailingWord === 'each' ? 'each' : 'shared'

      // assigned_to is always 'shared' per spec
      // (the 'each'/'shared' trailing word indicates scope, not a named person)
      const assigned_to: ItemInsert['assigned_to'] = 'shared'

      // Extract note/qty from _..._  (italics) — optional
      const noteMatch = bullet.match(/_([^_]+)_/)
      const note = noteMatch ? noteMatch[1].trim() : null

      items.push({
        category_sort_order: currentCategorySortOrder,
        name,
        status,
        assigned_to,
        scope,
        carry_tags: [],
        sort_order: itemSortOrder++,
        note,
        qty: null,
        is_custom: false,
      })
    }
  }

  // ── Trip row ──────────────────────────────────────────────────────────────
  //
  // Read from the document's own Trip Meta table rather than from env: the file
  // is the trip, so a second trip is a second file, not a second set of
  // variables. TRIP_NAME / TRIP_DEPART_DATE still win when set, which is how a
  // private deployment keeps its details out of a public repo.
  const meta = new Map(tableUnder(content, 'Trip Meta').map(r => [r[0].toLowerCase(), r[1] ?? '']))
  const trip: TripInsert = {
    name: process.env.TRIP_NAME || cellOrNull(meta.get('trip')) || 'Untitled trip',
    depart_date: process.env.TRIP_DEPART_DATE || cellOrNull(meta.get('depart date')),
  }

  // ── Contacts ──────────────────────────────────────────────────────────────
  //
  // Rows with a role but no name and no number are the format showing its shape
  // — that is what the committed file holds, because these details belong to
  // third parties and are not ours to publish. They are skipped rather than
  // seeded as blanks, so a fresh clone starts with an empty contact list the
  // organiser fills in from the app.
  const contacts: ContactInsert[] = []
  for (const cells of tableUnder(content, 'Trip Contacts')) {
    const role  = cellOrNull(cells[0])
    const name  = cellOrNull(cells[1])
    const phone = cellOrNull(cells[2])
    const note  = cellOrNull(cells[3])
    if (!role || (!name && !phone)) continue
    contacts.push({ role, name, phone, note, sort_order: contacts.length })
  }

  return { categories, items, trip, contacts }
}

/**
 * Parse docs/02_itinerary.md
 * Returns array of 9 ItineraryInsert rows.
 */
function parseItinerary(content: string): ItineraryInsert[] {
  const rows: ItineraryInsert[] = []

  // Split into Day sections (each starts with "## Day N — Title")
  const sections = content.split(/^(?=## Day \d+\s*—)/m)

  for (const section of sections) {
    const headerMatch = section.match(/^## Day (\d+)\s*—\s*(.+)/)
    if (!headerMatch) continue

    const day = parseInt(headerMatch[1], 10)
    const dayTitle = headerMatch[2].trim()

    // Helper: extract field value from "- **field:** value"
    const getField = (fieldName: string): string | null => {
      const regex = new RegExp(
        `^\\s*-?\\s*\\*\\*${fieldName}:\\*\\*\\s*(.+)$`,
        'm',
      )
      const m = section.match(regex)
      return m ? m[1].trim() : null
    }

    // date
    const dateStr = getField('date')

    // leg
    const legRaw = getField('leg')
    // Strip markdown formatting from leg text
    const leg = legRaw ? legRaw.replace(/\*\*/g, '').replace(/_/g, '').trim() : dayTitle

    // coords — parse the LAST coordinate pair (destination / overnight location)
    // Pattern: "CityA 28.61, 77.21 → CityB 31.10, 77.17" — last pair = destination
    const coordsRaw = getField('coords')
    let lat = 0
    let lon = 0
    if (coordsRaw) {
      const allCoords = [...coordsRaw.matchAll(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/g)]
      if (allCoords.length > 0) {
        const last = allCoords[allCoords.length - 1]
        lat = parseFloat(last[1])
        lon = parseFloat(last[2])
      }
    }

    // altitude — extract the LAST number (destination altitude in a range like "216 m → 2,200 m")
    const altRaw = getField('altitude')
    let altitude_m: number | null = null
    if (altRaw) {
      // Find all numbers in the altitude string, take the last one
      const allNums = [...altRaw.matchAll(/(\d[\d,]*)/g)]
      if (allNums.length > 0) {
        const last = allNums[allNums.length - 1]
        altitude_m = parseInt(last[1].replace(/,/g, ''), 10)
      }
    }

    // carry_today — split on comma or " + "
    const carryRaw = getField('carry_today')
    let carry_today: string[] = []
    if (carryRaw) {
      carry_today = carryRaw
        .replace(/\*\*/g, '')
        .split(/,\s*/)
        .map((s) => s.trim())
        .filter(Boolean)
    }

    // prep_tonight
    const prepRaw = getField('prep_tonight')
    const prep_tonight = prepRaw
      ? prepRaw.replace(/\*\*/g, '').trim()
      : null

    // warnings
    const warningsRaw = getField('warnings')
    const warnings = warningsRaw
      ? warningsRaw.replace(/\*\*/g, '').trim()
      : null

    // network — map to enum
    const networkRaw = getField('network')
    let network: ItineraryInsert['network'] = null
    if (networkRaw) {
      const nLower = networkRaw.toLowerCase()
      if (nLower.includes('none') || nLower.includes('fully offline') || nLower.includes('near-zero') || nLower.includes('near zero') || nLower.includes('zero')) {
        network = 'none'
      } else if (nLower.includes('very weak')) {
        network = 'weak'
      } else if (nLower.includes('patchy')) {
        network = 'patchy'
      } else if (nLower.includes('weak')) {
        network = 'weak'
      } else if (nLower.includes('good') || nLower.includes('best signal') || nLower.includes('returns')) {
        network = 'good'
      }
    }

    // fun
    const funRaw = getField('fun')
    const fun = funRaw ? funRaw.replace(/\*\*/g, '').trim() : null

    // highlights — use dayTitle (the text after "Day N — ")
    const highlights = dayTitle

    rows.push({
      day,
      date: dateStr,
      leg,
      lat,
      lon,
      altitude_m,
      highlights,
      carry_today,
      prep_tonight,
      warnings,
      network,
      fun,
      tip: null,
    })
  }

  // Sort by day number
  rows.sort((a, b) => a.day - b.day)
  return rows
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const isDryRun = process.argv.includes('--dry-run')

  // Read source files (relative to project root, not this file's location)
  const rootDir = process.cwd()
  const packingListPath = path.resolve(
    rootDir,
    'docs/01_packing_list_master.md',
  )
  const itineraryPath = path.resolve(rootDir, 'docs/02_itinerary.md')

  if (!fs.existsSync(packingListPath)) {
    console.error(`ERROR: Cannot find ${packingListPath}`)
    process.exit(1)
  }
  if (!fs.existsSync(itineraryPath)) {
    console.error(`ERROR: Cannot find ${itineraryPath}`)
    process.exit(1)
  }

  const packingListContent = fs.readFileSync(packingListPath, 'utf-8')
  const itineraryContent = fs.readFileSync(itineraryPath, 'utf-8')

  // Parse
  const { categories, items, trip, contacts } = parsePackingList(packingListContent)
  const itineraryRows = parseItinerary(itineraryContent)

  // Count packed rows
  const packedCount = items.reduce(
    (acc, item) => acc + (item.scope === 'each' ? 2 : 1),
    0,
  )

  // Dry-run output
  console.log('\n=== YakPack Seed — Dry Run ===\n')
  console.log(`Categories:     ${categories.length}`)
  console.log(`Items:          ${items.length}`)
  console.log(`Packed rows:    ${packedCount}`)
  console.log(`Itinerary days: ${itineraryRows.length}`)
  console.log(`Contacts:       ${contacts.length}`)
  console.log(`Template trip:  1`)
  console.log()

  if (isDryRun) {
    console.log('--- Categories ---')
    for (const cat of categories) {
      const catItems = items.filter(
        (i) => i.category_sort_order === cat.sort_order,
      )
      console.log(
        `  [${String(cat.sort_order).padStart(2, '0')}] ${cat.name} — ${catItems.length} items`,
      )
    }
    console.log()
    console.log('--- Itinerary ---')
    for (const row of itineraryRows) {
      console.log(
        `  Day ${row.day}: ${row.leg.slice(0, 60)} | lat=${row.lat}, lon=${row.lon} | alt=${row.altitude_m}m | net=${row.network}`,
      )
    }
    if (contacts.length > 0) {
      console.log()
      console.log('--- Contacts ---')
      for (const c of contacts) console.log(`  ${c.role}: ${c.name ?? '—'} ${c.phone ?? ''}`.trimEnd())
    }
    console.log()
    console.log('Dry run complete. No changes written to DB.')
    return
  }

  // ── Live seed ──────────────────────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error(
      'ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.',
    )
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  console.log('YakPack seeding...\n')

  // ── 1. Resolve the template trip ──────────────────────────────────────────
  //
  // The seed maintains the TEMPLATE trip only — the row every new registration
  // is copied from. It must never touch a real user's trip, so every delete and
  // insert below is filtered on this id. Without that filter the old
  // `.neq(...)` deletes would wipe every account's data.
  console.log('Resolving template trip...')
  const { data: existingTemplate, error: tplReadError } = await supabase
    .from('trips')
    .select('id')
    .eq('is_template', true)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (tplReadError) { console.error('ERROR reading template trip:', tplReadError); process.exit(1) }

  let templateId = (existingTemplate as { id: string } | null)?.id ?? null

  if (templateId) {
    const { error } = await supabase
      .from('trips')
      .update({ name: trip.name, depart_date: trip.depart_date })
      .eq('id', templateId)
    if (error) { console.error('ERROR updating template trip:', error); process.exit(1) }
  } else {
    const { data, error } = await supabase
      .from('trips')
      .insert({ ...trip, is_template: true })
      .select('id')
      .single()
    if (error || !data) { console.error('ERROR creating template trip:', error); process.exit(1) }
    templateId = (data as { id: string }).id
  }
  console.log(`  template trip: ${templateId}`)

  // ── 2. Clear the template's content (scoped — never other trips) ──────────
  console.log('Clearing template content...')
  const { data: oldItems } = await supabase.from('items').select('id').eq('trip_id', templateId)
  const oldItemIds = ((oldItems ?? []) as { id: string }[]).map(i => i.id)
  if (oldItemIds.length > 0) {
    const { error } = await supabase.from('packed').delete().in('item_id', oldItemIds)
    if (error) { console.error('ERROR clearing packed:', error); process.exit(1) }
  }
  for (const table of ['items', 'categories', 'itinerary', 'trip_contacts'] as const) {
    const { error } = await supabase.from(table).delete().eq('trip_id', templateId)
    if (error) { console.error(`ERROR clearing ${table}:`, error); process.exit(1) }
  }

  // ── 3. Insert categories ──────────────────────────────────────────────────
  console.log(`Inserting ${categories.length} categories...`)
  const { data: insertedCategories, error: catError } = await supabase
    .from('categories')
    .insert(categories.map((c) => ({ trip_id: templateId, name: c.name, sort_order: c.sort_order, icon: c.icon })))
    .select('id, sort_order')

  if (catError) {
    console.error('ERROR inserting categories:', catError)
    process.exit(1)
  }

  // Build sort_order → id map
  const categoryIdMap = new Map<number, number>()
  for (const cat of insertedCategories ?? []) {
    categoryIdMap.set(cat.sort_order, cat.id)
  }

  // ── 4. Insert items ───────────────────────────────────────────────────────
  console.log(`Inserting ${items.length} items...`)
  const itemRows = items.map((item) => ({
    trip_id: templateId,
    category_id: categoryIdMap.get(item.category_sort_order)!,
    name: item.name,
    status: item.status,
    assigned_to: item.assigned_to,
    scope: item.scope,
    carry_tags: item.carry_tags,
    sort_order: item.sort_order,
    note: item.note,
    qty: item.qty,
    is_custom: item.is_custom,
  }))

  const { data: insertedItems, error: itemError } = await supabase
    .from('items')
    .insert(itemRows)
    .select('id, scope')

  if (itemError) {
    console.error('ERROR inserting items:', itemError)
    process.exit(1)
  }

  // ── 5. Insert packed rows ─────────────────────────────────────────────────
  console.log(`Inserting ${packedCount} packed rows...`)
  const packedRows: Array<{ item_id: string; user_key: string; packed: boolean }> = []
  for (const inserted of insertedItems ?? []) {
    // Only the organiser slot. The template's packed rows are never copied —
    // create_trip_from_template() generates fresh ones per trip — and a partner
    // slot has no holder here, so pre-creating one is meaningless.
    if (inserted.scope === 'each') {
      packedRows.push({ item_id: inserted.id, user_key: 'organiser', packed: false })
    } else {
      packedRows.push({ item_id: inserted.id, user_key: 'shared', packed: false })
    }
  }

  const { error: packedError } = await supabase.from('packed').insert(packedRows)
  if (packedError) {
    console.error('ERROR inserting packed rows:', packedError)
    process.exit(1)
  }

  // ── 6. Insert itinerary ───────────────────────────────────────────────────
  console.log(`Inserting ${itineraryRows.length} itinerary rows...`)
  const { error: itenError } = await supabase
    .from('itinerary')
    .insert(itineraryRows.map(r => ({ ...r, trip_id: templateId })))
  if (itenError) {
    console.error('ERROR inserting itinerary:', itenError)
    process.exit(1)
  }

  // ── 7. Insert contacts ────────────────────────────────────────────────────
  if (contacts.length > 0) {
    console.log(`Inserting ${contacts.length} contacts...`)
    const { error: contactError } = await supabase
      .from('trip_contacts')
      .insert(contacts.map(c => ({ ...c, trip_id: templateId })))
    if (contactError) {
      console.error('ERROR inserting contacts:', contactError)
      process.exit(1)
    }
  }

  console.log('\nSeeding complete!')
  console.log(`  Categories:     ${categories.length}`)
  console.log(`  Items:          ${items.length}`)
  console.log(`  Packed rows:    ${packedCount}`)
  console.log(`  Itinerary days: ${itineraryRows.length}`)
  console.log(`  Contacts:       ${contacts.length}`)
  console.log(`  Template trip:  ${templateId}`)
}

// Only run the destructive seed when this file is executed directly
// (e.g. `pnpm seed`). Importing parsePackingList from here must NOT seed.
const invokedDirectly =
  process.argv[1] != null &&
  /(?:^|[\\/])seed\.[tj]s$/.test(process.argv[1])

if (invokedDirectly) {
  main().catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
}
