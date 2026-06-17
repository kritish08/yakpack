import type { Leg } from '@/lib/today'

interface LegCardProps {
  leg: Leg
  isToday: boolean
  isFuture: boolean
}

const networkColor: Record<string, string> = {
  good: 'text-accent-2',
  patchy: 'text-accent',
  weak: 'text-accent',
  none: 'text-accent-3',
}

export default function LegCard({ leg, isToday, isFuture }: LegCardProps) {
  const dateLabel = leg.date
    ? new Date(leg.date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })
    : `Day ${leg.day}`

  return (
    <div className="bg-surface rounded-2xl border border-border p-4">
      {/* Date + badge */}
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-xs text-text-muted">{dateLabel} · Day {leg.day}</span>
        {isFuture && (
          <span className="font-mono text-[10px] uppercase tracking-wider bg-accent-4/10 text-accent-4 border border-accent-4/30 rounded px-1.5 py-0.5">
            Upcoming
          </span>
        )}
        {isToday && (
          <span className="font-mono text-[10px] uppercase tracking-wider bg-accent-2/10 text-accent-2 border border-accent-2/30 rounded px-1.5 py-0.5">
            Today
          </span>
        )}
      </div>

      {/* Leg description */}
      <p className="font-body text-sm text-text leading-relaxed">{leg.leg}</p>

      {/* Meta row */}
      <div className="flex gap-4 mt-3 pt-3 border-t border-border/50">
        <div>
          <span className="font-mono text-xs text-text-muted">Altitude </span>
          <span className="font-mono text-xs text-text">{leg.altitude_m?.toLocaleString()} m</span>
        </div>
        {leg.network && (
          <div>
            <span className="font-mono text-xs text-text-muted">Network </span>
            <span className={`font-mono text-xs ${networkColor[leg.network] ?? 'text-text'}`}>
              {leg.network}
            </span>
          </div>
        )}
      </div>

      {/* Fun fact */}
      {leg.fun && (
        <p className="font-body text-xs text-text-muted mt-3 italic">{leg.fun}</p>
      )}
    </div>
  )
}
