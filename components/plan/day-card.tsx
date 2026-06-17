import type { Leg } from '@/lib/plan'

const networkBadge: Record<string, { label: string; color: string }> = {
  good:    { label: '4G', color: 'text-accent-2 bg-accent-2/10 border-accent-2/30' },
  patchy:  { label: '~4G', color: 'text-accent bg-accent/10 border-accent/30' },
  weak:    { label: 'Weak', color: 'text-accent-3 bg-accent-3/10 border-accent-3/30' },
  none:    { label: 'No signal', color: 'text-text-muted bg-border/30 border-border' },
}

interface DayCardProps {
  leg: Leg
  isToday: boolean
  isPast: boolean
  isLast: boolean
}

export default function DayCard({ leg, isToday, isPast, isLast }: DayCardProps) {
  const net = leg.network ? networkBadge[leg.network] : null
  const altColor = (leg.altitude_m ?? 0) > 4000
    ? 'text-accent-3'
    : (leg.altitude_m ?? 0) > 3000
    ? 'text-accent'
    : 'text-text-muted'

  const formattedDate = leg.date
    ? new Date(leg.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
    : `Day ${leg.day}`

  return (
    <div className="flex gap-3">
      {/* Timeline spine */}
      <div className="flex flex-col items-center w-8 shrink-0">
        {/* Node */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0 transition-colors
          ${isToday
            ? 'bg-accent text-bg ring-4 ring-accent/20'
            : isPast
            ? 'bg-border text-text-muted'
            : 'bg-surface border-2 border-border text-text-muted'
          }`}>
          {leg.day}
        </div>
        {/* Line to next card */}
        {!isLast && (
          <div className={`w-px flex-1 min-h-[1.5rem] mt-1 ${isPast ? 'bg-border/50' : 'bg-border'}`} />
        )}
      </div>

      {/* Card */}
      <div className={`flex-1 pb-6 transition-opacity ${isPast ? 'opacity-60' : 'opacity-100'}`}>
        <div className={`bg-surface border rounded-2xl overflow-hidden transition-colors
          ${isToday ? 'border-accent/50 shadow-[0_0_0_1px_var(--color-accent)/20]' : 'border-border'}`}>

          {/* Card header */}
          <div className="px-4 pt-4 pb-3 border-b border-border/50">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-[11px] text-text-muted uppercase tracking-wider">
                  {formattedDate}
                  {isToday && <span className="ml-2 text-accent font-bold">· Today</span>}
                </p>
                <h3 className="font-display font-bold text-base uppercase tracking-tight text-text mt-0.5 leading-tight">
                  {leg.leg}
                </h3>
              </div>
              {/* Altitude */}
              {leg.altitude_m && (
                <span className={`font-mono text-xs shrink-0 mt-0.5 ${altColor}`}>
                  ⛰ {(leg.altitude_m / 1000).toFixed(1)}k m
                </span>
              )}
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {net && (
                <span className={`font-mono text-[10px] uppercase tracking-wider border rounded px-1.5 py-0.5 ${net.color}`}>
                  {net.label}
                </span>
              )}
              {leg.warnings && (
                <span className="font-mono text-[10px] uppercase tracking-wider border rounded px-1.5 py-0.5 text-accent-3 bg-accent-3/10 border-accent-3/30">
                  ⚠ Warning
                </span>
              )}
            </div>
          </div>

          {/* Highlights */}
          {leg.highlights && (
            <div className="px-4 py-3 border-b border-border/50">
              <p className="font-body text-sm text-text leading-relaxed">{leg.highlights}</p>
            </div>
          )}

          {/* Details grid */}
          <div className="divide-y divide-border/50">
            {leg.warnings && (
              <div className="px-4 py-2.5 flex gap-2">
                <span className="text-accent-3 text-sm shrink-0">⚠</span>
                <p className="font-body text-sm text-accent-3 leading-snug">{leg.warnings}</p>
              </div>
            )}
            {leg.tip && (
              <div className="px-4 py-2.5 flex gap-2">
                <span className="text-accent text-sm shrink-0">💡</span>
                <p className="font-body text-sm text-text leading-snug">{leg.tip}</p>
              </div>
            )}
            {leg.fun && (
              <div className="px-4 py-2.5 flex gap-2">
                <span className="text-accent-2 text-sm shrink-0">✨</span>
                <p className="font-body text-sm text-text-muted leading-snug">{leg.fun}</p>
              </div>
            )}
            {leg.prep_tonight && (
              <div className="px-4 py-2.5 flex gap-2">
                <span className="text-accent-4 text-sm shrink-0">🌙</span>
                <p className="font-body text-sm text-text-muted leading-snug">
                  <span className="text-accent-4 font-mono text-[10px] uppercase tracking-wider mr-1">Tonight:</span>
                  {leg.prep_tonight}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
