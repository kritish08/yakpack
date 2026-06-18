import type { Item } from '@/lib/today'
import type { CarryTag } from '@/lib/weather'

interface CarryChipsProps {
  items:      Item[]
  activeTags: CarryTag[]
  carryToday: string[]
  packedIds:  Set<string>
}

function getWeatherItems(items: Item[], activeTags: CarryTag[]) {
  if (activeTags.length === 0) return []
  return items.filter(item =>
    item.carry_tags?.some(t => activeTags.includes(t as CarryTag))
  )
}

export default function CarryChips({ items, activeTags, carryToday, packedIds }: CarryChipsProps) {
  const weatherItems = getWeatherItems(items, activeTags)

  // Sort: unpacked first, packed last
  const sorted = [...weatherItems].sort((a, b) => {
    const aPacked = packedIds.has(a.id) ? 1 : 0
    const bPacked = packedIds.has(b.id) ? 1 : 0
    return aPacked - bPacked
  })

  const packedCount   = sorted.filter(i => packedIds.has(i.id)).length
  const unpackedCount = sorted.length - packedCount

  return (
    <div className="bg-surface rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-xs text-text-muted uppercase tracking-wider">Carry today</p>
        {sorted.length > 0 && (
          <span className="font-mono text-[10px] text-text-dim">
            {packedCount}/{sorted.length} ready
          </span>
        )}
      </div>

      {/* Itinerary-specified carry list */}
      {carryToday.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {carryToday.map((item, i) => (
            <span key={i} className="font-body text-xs bg-surface-2 border border-border rounded-lg px-2.5 py-1 text-text">
              {item}
            </span>
          ))}
        </div>
      )}

      {/* Weather-reactive packing items with pack status */}
      {sorted.length > 0 && (
        <>
          <p className="font-mono text-xs text-accent uppercase tracking-wider mb-2">
            ⚡ Weather gear
            {unpackedCount > 0 && <span className="ml-1.5 text-accent-3">· {unpackedCount} still to grab</span>}
          </p>
          <div className="flex flex-col gap-1.5">
            {sorted.map(item => {
              const packed = packedIds.has(item.id)
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 border transition-colors ${
                    packed
                      ? 'bg-accent-2/5 border-accent-2/20'
                      : 'bg-accent/5 border-accent/20'
                  }`}
                >
                  {/* Status dot */}
                  <span className={`shrink-0 w-2 h-2 rounded-full ${packed ? 'bg-accent-2' : 'bg-accent-3'}`} />
                  <span className={`font-body text-sm flex-1 min-w-0 truncate ${packed ? 'text-text-muted line-through' : 'text-text'}`}>
                    {item.name}
                  </span>
                  {item.qty && (
                    <span className="font-mono text-xs text-text-dim shrink-0">×{item.qty}</span>
                  )}
                  <span className={`font-mono text-[10px] shrink-0 ${packed ? 'text-accent-2' : 'text-accent-3'}`}>
                    {packed ? '✓ packed' : 'grab it'}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {carryToday.length === 0 && sorted.length === 0 && (
        <p className="font-mono text-xs text-text-dim">No specific carry list for today</p>
      )}
    </div>
  )
}
