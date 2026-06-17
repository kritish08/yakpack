'use client'

import type { Item, Packed, Profile } from '@/lib/pack'

interface ItemRowProps {
  item: Item
  packed: Packed[]
  profile: Profile
  onToggle: (itemId: string, userKey: string, isPacked: boolean) => void
}

const assignedColors: Record<string, string> = {
  kritish: 'bg-accent/15 text-accent border-accent/30',
  partner: 'bg-accent-4/15 text-accent-4 border-accent-4/30',
  shared: 'bg-accent-2/15 text-accent-2 border-accent-2/30',
}

const statusDot: Record<string, string> = {
  owned: 'bg-accent-2',
  to_buy: 'bg-accent-3',
  standard: 'bg-text-muted',
}

export default function ItemRow({ item, packed, profile, onToggle }: ItemRowProps) {
  const userKey = item.scope === 'each' ? profile.role : 'shared'
  const isPacked = packed.some(p => p.item_id === item.id && p.user_key === userKey)

  // For shared items, find who packed it
  const packedRow = packed.find(p => p.item_id === item.id && p.user_key === userKey)

  return (
    <button
      onClick={() => onToggle(item.id, userKey, isPacked)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2/50 active:bg-surface-2 transition-colors text-left min-h-[52px]"
    >
      {/* Checkbox */}
      <span
        className={`shrink-0 w-5 h-5 rounded-[5px] border-2 flex items-center justify-center transition-all
          ${isPacked
            ? 'bg-accent-2 border-accent-2'
            : 'border-border bg-transparent'
          }`}
      >
        {isPacked && (
          <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
            <path d="M1 4L4.5 7.5L11 1" stroke="#0f0e0c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>

      {/* Name + note */}
      <span className="flex-1 min-w-0">
        <span className={`font-body text-sm block truncate transition-colors ${isPacked ? 'text-text-muted line-through' : 'text-text'}`}>
          {item.name}
          {item.qty && <span className="text-text-muted ml-1">× {item.qty}</span>}
        </span>
        {item.note && (
          <span className="font-mono text-xs text-text-dim block truncate">{item.note}</span>
        )}
      </span>

      {/* Assigned chip */}
      <span className={`shrink-0 font-mono text-[10px] uppercase tracking-wider border rounded px-1.5 py-0.5 ${assignedColors[item.assigned_to]}`}>
        {item.assigned_to === 'shared' ? 'shared' : item.assigned_to === profile.role ? 'me' : item.assigned_to}
      </span>

      {/* Status dot */}
      <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${statusDot[item.status]}`} />
    </button>
  )
}
