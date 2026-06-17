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

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryInsert {
  name: string
  sort_order: number
  icon: string | null
}

interface ItemInsert {
  // category_id filled in after category upsert
  category_sort_order: number
  name: string
  status: 'owned' | 'to_buy' | 'standard'
  assigned_to: 'kritish' | 'partner' | 'shared'
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
  id: number
  name: string
  depart_date: string
  coordinator_name: string
  coordinator_phone: string
  leader_name: string
  leader_phone: string
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
 * Parse docs/01_packing_list_master.md
 * Returns { categories, items, trip }
 */
function parsePackingList(content: string): {
  categories: CategoryInsert[]
  items: ItemInsert[]
  trip: TripInsert
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

  // ── Hardcoded trip row (from Trip Meta section) ───────────────────────────
  const trip: TripInsert = {
    id: 1,
    name: 'Experience Spiti Valley (Ex-Delhi) — Kinnaur · Spiti · Chandratal',
    depart_date: '2026-06-19',
    coordinator_name: 'Ritvik',
    coordinator_phone: '8197891921',
    leader_name: 'Sashi',
    leader_phone: '+91 89511 55846',
  }

  return { categories, items, trip }
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

    // coords — parse the first coordinate pair
    // Pattern: "CityName 28.61, 77.21" or "CityName 28.61, 77.21 → ..."
    const coordsRaw = getField('coords')
    let lat = 0
    let lon = 0
    if (coordsRaw) {
      // Match first occurrence of "number, number" (lat, lon)
      const coordMatch = coordsRaw.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/)
      if (coordMatch) {
        lat = parseFloat(coordMatch[1])
        lon = parseFloat(coordMatch[2])
      }
    }

    // altitude — extract first integer (in metres)
    const altRaw = getField('altitude')
    let altitude_m: number | null = null
    if (altRaw) {
      // Look for patterns like "216 m", "~2,700–3,450 m", "Sangla ~2,700 m"
      // Extract first plain number (ignoring ~, commas, ranges)
      const altMatch = altRaw.match(/~?(\d[\d,]*)/)
      if (altMatch) {
        altitude_m = parseInt(altMatch[1].replace(',', ''), 10)
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
  const { categories, items, trip } = parsePackingList(packingListContent)
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
  console.log(`Trip row:       1 (id=1)`)
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

  // ── 1. Delete existing data (idempotent: delete-then-reinsert) ────────────
  console.log('Clearing existing data...')
  await supabase.from('packed').delete().neq('item_id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('categories').delete().neq('id', 0)
  await supabase.from('itinerary').delete().neq('day', 0)
  await supabase.from('trip').delete().eq('id', 1)

  // ── 2. Insert categories ──────────────────────────────────────────────────
  console.log(`Inserting ${categories.length} categories...`)
  const { data: insertedCategories, error: catError } = await supabase
    .from('categories')
    .insert(categories.map((c) => ({ name: c.name, sort_order: c.sort_order, icon: c.icon })))
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

  // ── 3. Insert items ───────────────────────────────────────────────────────
  console.log(`Inserting ${items.length} items...`)
  const itemRows = items.map((item) => ({
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

  // ── 4. Insert packed rows ─────────────────────────────────────────────────
  console.log(`Inserting ${packedCount} packed rows...`)
  const packedRows: Array<{ item_id: string; user_key: string; packed: boolean }> = []

  // We need to pair items with their scope. Re-build the pairing:
  // insertedItems is in the same order as itemRows (and items[]).
  for (let i = 0; i < (insertedItems ?? []).length; i++) {
    const inserted = insertedItems![i]
    if (inserted.scope === 'each') {
      packedRows.push({ item_id: inserted.id, user_key: 'kritish', packed: false })
      packedRows.push({ item_id: inserted.id, user_key: 'partner', packed: false })
    } else {
      packedRows.push({ item_id: inserted.id, user_key: 'shared', packed: false })
    }
  }

  const { error: packedError } = await supabase.from('packed').insert(packedRows)
  if (packedError) {
    console.error('ERROR inserting packed rows:', packedError)
    process.exit(1)
  }

  // ── 5. Insert itinerary ───────────────────────────────────────────────────
  console.log(`Inserting ${itineraryRows.length} itinerary rows...`)
  const { error: itenError } = await supabase.from('itinerary').insert(itineraryRows)
  if (itenError) {
    console.error('ERROR inserting itinerary:', itenError)
    process.exit(1)
  }

  // ── 6. Insert trip row ────────────────────────────────────────────────────
  console.log('Inserting trip row...')
  const { error: tripError } = await supabase.from('trip').insert(trip)
  if (tripError) {
    console.error('ERROR inserting trip:', tripError)
    process.exit(1)
  }

  console.log('\nSeeding complete!')
  console.log(`  Categories:     ${categories.length}`)
  console.log(`  Items:          ${items.length}`)
  console.log(`  Packed rows:    ${packedCount}`)
  console.log(`  Itinerary days: ${itineraryRows.length}`)
  console.log(`  Trip row:       1`)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
