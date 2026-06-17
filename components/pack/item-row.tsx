'use client'

import type { Item, Packed, Profile } from '@/lib/pack'

interface ItemRowProps {
  item: Item
  packed: Packed[]
  profile: Profile
  onToggle: (itemId: string, userKey: string, isPacked: boolean) => void
}

const statusDot: Record<string, string> = {
  owned: 'bg-accent-2',
  to_buy: 'bg-accent-3',
  standard: 'bg-text-muted',
}

// Mini K/G badge — shows one person's packed state for scope='each' items
function PersonDot({ initial, isPacked, isMe, color }: { initial: string; isPacked: boolean; isMe: boolean; color: 'amber' | 'blue' }) {
  const base = color === 'amber'
    ? isPacked ? 'bg-accent border-accent text-bg' : 'border-accent/40 text-accent/60'
    : isPacked ? 'bg-accent-4 border-accent-4 text-bg' : 'border-accent-4/40 text-accent-4/60'

  return (
    <span
      className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center font-mono text-[9px] font-bold transition-all ${base} ${isMe ? 'ring-1 ring-offset-1 ring-offset-surface ring-current/30' : ''}`}
    >
      {isPacked ? (
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
          <path d="M1 3L3 5L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : initial}
    </span>
  )
}

export default function ItemRow({ item, packed, profile, onToggle }: ItemRowProps) {
  const myKey = profile.role
  const partnerKey = profile.role === 'kritish' ? 'partner' : 'kritish'

  const isEach = item.scope === 'each'
  const userKey = isEach ? myKey : 'shared'
  const isPacked = packed.some(p => p.item_id === item.id && p.user_key === userKey)

  // For scope='each': also track partner's state
  const partnerPacked = isEach
    ? packed.some(p => p.item_id === item.id && p.user_key === partnerKey)
    : false

  const myColor   = myKey === 'kritish' ? 'amber' : 'blue'
  const partColor = partnerKey === 'kritish' ? 'amber' : 'blue'
  const myInitial      = myKey === 'kritish' ? 'K' : 'G'
  const partnerInitial = partnerKey === 'kritish' ? 'K' : 'G'

  // Strike-through only when MY item is packed (for shared: when shared row exists)
  const strikeThrough = isPacked

  return (
    <button
      onClick={() => onToggle(item.id, userKey, isPacked)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2/50 active:bg-surface-2 transition-colors text-left min-h-[52px]"
    >
      {/* For scope='each': dual K/G dots. For scope='shared': single checkbox */}
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
        <span
          className={`shrink-0 w-5 h-5 rounded-[5px] border-2 flex items-center justify-center transition-all
            ${isPacked ? 'bg-accent-2 border-accent-2' : 'border-border bg-transparent'}`}
        >
          {isPacked && (
            <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
              <path d="M1 4L4.5 7.5L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </span>
      )}

      {/* Name + note */}
      <span className="flex-1 min-w-0">
        <span className={`font-body text-sm block truncate transition-colors ${strikeThrough ? 'text-text-muted line-through' : 'text-text'}`}>
          {item.name}
          {item.qty && <span className="text-text-muted ml-1">× {item.qty}</span>}
        </span>
        {item.note && (
          <span className="font-mono text-xs text-text-dim block truncate">{item.note}</span>
        )}
      </span>

      {/* Status dot */}
      <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${statusDot[item.status]}`} />
    </button>
  )
}
