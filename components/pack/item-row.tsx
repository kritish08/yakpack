'use client'

import { Pencil, Trash2 } from 'lucide-react'
import type { Item, Packed } from '@/lib/pack'
import type { AssignedTo, MemberKey, MemberView } from '@/lib/database.types'

interface ItemRowProps {
  item: Item
  packed: Packed[]
  ctx: MemberView
  onToggle: (itemId: string, userKey: AssignedTo, isPacked: boolean) => void
  onEdit?: (item: Item) => void
  onDelete?: (itemId: string) => void
}

const statusDot: Record<string, string> = {
  owned: 'bg-accent-2',
  to_buy: 'bg-accent-3',
  standard: 'bg-text-muted',
}

/** One colour per slot, so a person keeps the same colour across every screen. */
const SLOT_COLOUR: Record<MemberKey, { on: string; off: string }> = {
  organiser: { on: 'bg-accent   border-accent   text-bg', off: 'border-accent/40   text-accent/60'   },
  partner_1: { on: 'bg-accent-4 border-accent-4 text-bg', off: 'border-accent-4/40 text-accent-4/60' },
  partner_2: { on: 'bg-accent-2 border-accent-2 text-bg', off: 'border-accent-2/40 text-accent-2/60' },
}

function PersonDot({ initial, isPacked, isMe, slot }: {
  initial: string; isPacked: boolean; isMe: boolean; slot: MemberKey
}) {
  const c = SLOT_COLOUR[slot]
  return (
    <span
      className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center font-mono text-[9px] font-bold transition-all
        ${isPacked ? c.on : c.off} ${isMe ? 'ring-1 ring-offset-1 ring-offset-surface ring-current/30' : ''}`}
    >
      {isPacked ? (
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
          <path d="M1 3L3 5L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : initial}
    </span>
  )
}

export default function ItemRow({ item, packed, ctx, onToggle, onEdit, onDelete }: ItemRowProps) {
  const isEach = item.scope === 'each'
  // Personal items track a row per person; shared items track exactly one.
  const userKey: AssignedTo = isEach ? ctx.memberKey : 'shared'
  const isPacked = packed.some(p => p.item_id === item.id && p.user_key === userKey)

  // My dot leads, so the row reads from the perspective of whoever is holding
  // the phone regardless of which slot they occupy.
  const people = isEach
    ? [...ctx.members].sort((a, b) => Number(b.isMe) - Number(a.isMe))
    : []

  return (
    <div className="group flex items-center gap-1 px-4 hover:bg-surface-2/50 active:bg-surface-2 transition-colors min-h-[52px]">
      <button
        onClick={() => onToggle(item.id, userKey, isPacked)}
        className="flex items-center gap-3 flex-1 min-w-0 text-left py-3"
      >
        {isEach ? (
          <span className="shrink-0 flex gap-1">
            {people.map(m => (
              <PersonDot
                key={m.memberKey}
                slot={m.memberKey}
                initial={(m.displayName || '?')[0].toUpperCase()}
                isPacked={packed.some(p => p.item_id === item.id && p.user_key === m.memberKey)}
                isMe={m.isMe}
              />
            ))}
          </span>
        ) : (
          <span className={`shrink-0 w-5 h-5 rounded-[5px] border-2 flex items-center justify-center transition-all ${isPacked ? 'bg-accent-2 border-accent-2' : 'border-border bg-transparent'}`}>
            {isPacked && (
              <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                <path d="M1 4L4.5 7.5L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
        )}
        <span className="flex-1 min-w-0">
          <span className={`font-body text-sm block truncate transition-colors ${isPacked ? 'text-text-muted line-through' : 'text-text'}`}>
            {item.name}
            {item.qty && <span className="text-text-muted ml-1">× {item.qty}</span>}
          </span>
          {item.note && <span className="font-mono text-xs text-text-dim block truncate">{item.note}</span>}
        </span>
      </button>

      <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${statusDot[item.status]}`} />

      <div className="shrink-0 flex items-center sm:opacity-0 group-hover:opacity-100 transition-opacity">
        {onEdit && (
          <button
            onClick={e => { e.stopPropagation(); onEdit(item) }}
            className="p-2 text-text-dim hover:text-accent transition-colors min-h-[44px] min-w-[36px] flex items-center justify-center"
            aria-label={`Edit ${item.name}`}
          ><Pencil size={13} /></button>
        )}
        {onDelete && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(item.id) }}
            className="p-2 text-text-dim hover:text-accent-3 transition-colors min-h-[44px] min-w-[36px] flex items-center justify-center"
            aria-label={`Delete ${item.name}`}
          ><Trash2 size={13} /></button>
        )}
      </div>
    </div>
  )
}
