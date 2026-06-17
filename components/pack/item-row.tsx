'use client'

import { Pencil, Trash2 } from 'lucide-react'
import type { Item, Packed, Profile } from '@/lib/pack'

interface ItemRowProps {
  item: Item
  packed: Packed[]
  profile: Profile
  onToggle: (itemId: string, userKey: string, isPacked: boolean) => void
  onEdit?: (item: Item) => void
  onDelete?: (itemId: string) => void
}

const statusDot: Record<string, string> = {
  owned: 'bg-accent-2',
  to_buy: 'bg-accent-3',
  standard: 'bg-text-muted',
}

function PersonDot({ initial, isPacked, isMe, color }: { initial: string; isPacked: boolean; isMe: boolean; color: 'amber' | 'blue' }) {
  const base = color === 'amber'
    ? isPacked ? 'bg-accent border-accent text-bg' : 'border-accent/40 text-accent/60'
    : isPacked ? 'bg-accent-4 border-accent-4 text-bg' : 'border-accent-4/40 text-accent-4/60'

  return (
    <span className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center font-mono text-[9px] font-bold transition-all ${base} ${isMe ? 'ring-1 ring-offset-1 ring-offset-surface ring-current/30' : ''}`}>
      {isPacked ? (
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
          <path d="M1 3L3 5L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : initial}
    </span>
  )
}

export default function ItemRow({ item, packed, profile, onToggle, onEdit, onDelete }: ItemRowProps) {
  const myKey = profile.role
  const partnerKey = profile.role === 'kritish' ? 'partner' : 'kritish'

  const isEach = item.scope === 'each'
  const userKey = isEach ? myKey : 'shared'
  const isPacked = packed.some(p => p.item_id === item.id && p.user_key === userKey)
  const partnerPacked = isEach ? packed.some(p => p.item_id === item.id && p.user_key === partnerKey) : false

  const myColor   = myKey === 'kritish' ? 'amber' : 'blue'
  const partColor = partnerKey === 'kritish' ? 'amber' : 'blue'
  const myInitial      = myKey === 'kritish' ? 'K' : 'G'
  const partnerInitial = partnerKey === 'kritish' ? 'K' : 'G'

  return (
    <div className="group flex items-center gap-1 px-4 hover:bg-surface-2/50 active:bg-surface-2 transition-colors min-h-[52px]">
      <button
        onClick={() => onToggle(item.id, userKey, isPacked)}
        className="flex items-center gap-3 flex-1 min-w-0 text-left py-3"
      >
        {isEach ? (
          <span className="shrink-0 flex gap-1">
            {myKey === 'kritish' ? (
              <>
                <PersonDot initial={myInitial}      isPacked={isPacked}      isMe={true}  color={myColor} />
                <PersonDot initial={partnerInitial} isPacked={partnerPacked} isMe={false} color={partColor} />
              </>
            ) : (
              <>
                <PersonDot initial={partnerInitial} isPacked={partnerPacked} isMe={false} color={partColor} />
                <PersonDot initial={myInitial}      isPacked={isPacked}      isMe={true}  color={myColor} />
              </>
            )}
          </span>
        ) : (
          <span className={`shrink-0 w-5 h-5 rounded-[5px] border-2 flex items-center justify-center transition-all ${isPacked ? 'bg-accent-2 border-accent-2' : 'border-border bg-transparent'}`}>
            {isPacked && (
              <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                <path d="M1 4L4.5 7.5L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
          >
            <Pencil size={13} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(item.id) }}
            className="p-2 text-text-dim hover:text-accent-3 transition-colors min-h-[44px] min-w-[36px] flex items-center justify-center"
            aria-label={`Delete ${item.name}`}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
