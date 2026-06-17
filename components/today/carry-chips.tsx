import type { Item } from '@/lib/today'
import type { CarryTag } from '@/lib/weather'

interface CarryChipsProps {
  items: Item[]
  activeTags: CarryTag[]
  carryToday: string[]
}

// Items whose carry_tags overlap with active weather tags
function getWeatherItems(items: Item[], activeTags: CarryTag[]) {
  if (activeTags.length === 0) return []
  return items.filter(item =>
    item.carry_tags?.some(t => activeTags.includes(t as CarryTag))
  )
}

export default function CarryChips({ items, activeTags, carryToday }: CarryChipsProps) {
  const weatherItems = getWeatherItems(items, activeTags)

  return (
    <div className="bg-surface rounded-2xl border border-border p-4">
      <p className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">Carry today</p>

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

      {/* Weather-reactive packing items */}
      {weatherItems.length > 0 && (
        <>
          <p className="font-mono text-xs text-accent uppercase tracking-wider mb-2 mt-3">⚡ Weather gear</p>
          <div className="flex flex-wrap gap-2">
            {weatherItems.map(item => (
              <span key={item.id} className="font-body text-xs bg-accent/10 border border-accent/30 text-accent rounded-lg px-2.5 py-1">
                {item.name}
              </span>
            ))}
          </div>
        </>
      )}

      {carryToday.length === 0 && weatherItems.length === 0 && (
        <p className="font-mono text-xs text-text-dim">No specific carry list for today</p>
      )}
    </div>
  )
}
