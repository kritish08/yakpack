import type { Database } from '@/lib/database.types'

type Item = Database['public']['Tables']['items']['Row']
type Packed = Database['public']['Tables']['packed']['Row']
type ProfileRole = 'kritish' | 'partner'

export interface ProgressStat {
  label: string
  done: number
  total: number
  color: string
}

function isPackedFor(item: Item, packed: Packed[], userKey: string) {
  const key = item.scope === 'each' ? userKey : 'shared'
  return packed.some(p => p.item_id === item.id && p.user_key === key)
}

export function overallProgress(items: Item[], packed: Packed[], role: ProfileRole): ProgressStat {
  const total = items.length
  const done = items.filter(i => isPackedFor(i, packed, role)).length
  return { label: 'Overall', done, total, color: 'bg-accent' }
}

export function personProgress(
  items: Item[],
  packed: Packed[],
  role: ProfileRole,
  label: string,
  color: string
): ProgressStat {
  // My items = assigned to me OR shared
  const mine = items.filter(i => i.assigned_to === role || i.assigned_to === 'shared')
  const done = mine.filter(i => isPackedFor(i, packed, role)).length
  return { label, done, total: mine.length, color }
}

export function categoryProgress(
  items: Item[],
  packed: Packed[],
  role: ProfileRole,
  categoryId: number,
  categoryName: string
): ProgressStat {
  const catItems = items.filter(i => i.category_id === categoryId)
  const done = catItems.filter(i => isPackedFor(i, packed, role)).length
  return { label: categoryName, done, total: catItems.length, color: 'bg-accent-2' }
}
