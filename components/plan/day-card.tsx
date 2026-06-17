import type { Leg } from '@/lib/plan'

const networkLabel: Record<string, { label: string; cls: string }> = {
  good:   { label: '4G',        cls: 'text-accent-2 bg-accent-2/10 border-accent-2/30' },
  patchy: { label: '~4G',       cls: 'text-accent   bg-accent/10   border-accent/30'   },
  weak:   { label: 'Weak sig',  cls: 'text-accent-3 bg-accent-3/10 border-accent-3/30' },
  none:   { label: 'No signal', cls: 'text-text-muted bg-border/20  border-border'      },
}

interface DayCardProps {
  leg: Leg
  isToday: boolean
  isPast: boolean
  cardRef?: (el: HTMLDivElement | null) => void
}

function Row({ icon, text, label, color }: { icon: string; text: string; label?: string; color?: string }) {
  return (
    <div className="px-4 py-2.5 flex gap-2.5 items-start">
      <span className="text-sm shrink-0 mt-px">{icon}</span>
      <p className={`font-body text-sm leading-snug ${color ?? 'text-text'}`}>
        {label && <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted mr-1.5">{label}</span>}
        {text}
      </p>
    </div>
  )
}

export default function DayCard({ leg, isToday, isPast, cardRef }: DayCardProps) {
  const net = leg.network ? networkLabel[leg.network] : null
  const altM = leg.altitude_m ?? 0
  const altColor = altM > 4000 ? 'text-accent-3' : altM > 3000 ? 'text-accent' : 'text-text-muted'

  const formattedDate = leg.date
    ? new Date(leg.date + 'T00:00:00').toLocaleDateString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short',
      })
    : `Day ${leg.day}`

  const hasContent = leg.highlights || leg.warnings || leg.tip || leg.fun || leg.prep_tonight

  return (
    <div
      ref={cardRef}
      className={`rounded-2xl border overflow-hidden transition-all ${
        isToday
          ? 'border-accent/60 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-accent)_20%,transparent)]'
          : 'border-border'
      } ${isPast ? 'opacity-50' : ''}`}
    >
      {/* Card header */}
      <div className={`px-4 py-3.5 flex items-center gap-3 ${isToday ? 'bg-accent/8' : 'bg-surface'}`}>
        {/* Day chip */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-base shrink-0 ${
          isToday
            ? 'bg-accent text-bg'
            : isPast
            ? 'bg-border/40 text-text-muted'
            : 'bg-surface-2 border border-border text-text-muted'
        }`}>
          {leg.day}
        </div>

        {/* Route name + date */}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[10px] text-text-muted uppercase tracking-wider leading-none mb-0.5">
            {formattedDate}
            {isToday && <span className="text-accent font-bold ml-1.5">· Today</span>}
          </p>
          <h3 className="font-display font-bold text-base uppercase tracking-tight text-text leading-tight truncate">
            {leg.leg}
          </h3>
        </div>

        {/* Altitude */}
        {altM > 0 && (
          <div className={`text-right shrink-0 ${altColor}`}>
            <p className="font-mono font-bold text-base leading-none">
              {(altM / 1000).toFixed(1)}k
            </p>
            <p className="font-mono text-[9px] uppercase tracking-wider opacity-70">metres</p>
          </div>
        )}
      </div>

      {/* Badges */}
      {(net || leg.warnings) && (
        <div className={`px-4 py-1.5 flex gap-1.5 flex-wrap border-t border-border/30 ${isToday ? 'bg-accent/5' : 'bg-surface'}`}>
          {net && (
            <span className={`font-mono text-[10px] uppercase tracking-wider border rounded px-1.5 py-0.5 ${net.cls}`}>
              {net.label}
            </span>
          )}
          {leg.warnings && (
            <span className="font-mono text-[10px] uppercase tracking-wider border rounded px-1.5 py-0.5 text-accent-3 bg-accent-3/10 border-accent-3/30">
              ⚠ Warning
            </span>
          )}
        </div>
      )}

      {/* Content rows */}
      {hasContent && (
        <div className="bg-surface-2/40 divide-y divide-border/40 border-t border-border/30">
          {leg.highlights && <Row icon="📍" text={leg.highlights} />}
          {leg.warnings  && <Row icon="⚠" text={leg.warnings} color="text-accent-3" />}
          {leg.tip       && <Row icon="💡" text={leg.tip} />}
          {leg.fun       && <Row icon="✨" text={leg.fun} color="text-text-muted" />}
          {leg.prep_tonight && <Row icon="🌙" label="Tonight" text={leg.prep_tonight} color="text-text-muted" />}
        </div>
      )}
    </div>
  )
}
