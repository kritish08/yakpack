'use client'

import { useState, type ReactNode } from 'react'
import type { Leg, LegWeather } from '@/lib/plan'
import type { AmsRisk } from '@/lib/ams'

const networkLabel: Record<string, { label: string; cls: string }> = {
  good:   { label: '4G',        cls: 'text-accent-2 bg-accent-2/10 border-accent-2/30' },
  patchy: { label: '~4G',       cls: 'text-accent   bg-accent/10   border-accent/30'   },
  weak:   { label: 'Weak sig',  cls: 'text-accent-3 bg-accent-3/10 border-accent-3/30' },
  none:   { label: 'No signal', cls: 'text-text-muted bg-border/20  border-border'      },
}

interface DayCardProps {
  leg:             Leg
  isToday:         boolean
  isPast:          boolean
  cardRef?:        (el: HTMLDivElement | null) => void
  weather?:        LegWeather | null
  insightNode?:    ReactNode  // Suspense-wrapped AI insight, only for today
  aiEnabled?:      boolean
  ams?:            AmsRisk
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

function WeatherBadges({ weather }: { weather: LegWeather }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      <span className="font-mono text-[10px] border rounded px-1.5 py-0.5 text-text-muted border-border bg-surface">
        {weather.temp_min}–{weather.temp_max}°C
      </span>
      {weather.rain_pct >= 30 && (
        <span className="font-mono text-[10px] border rounded px-1.5 py-0.5 text-accent-4 bg-accent-4/10 border-accent-4/30">
          🌧 {weather.rain_pct}%
        </span>
      )}
      {weather.rain_pct < 30 && (
        <span className="font-mono text-[10px] border rounded px-1.5 py-0.5 text-text-muted border-border bg-surface">
          ☀ {weather.rain_pct}%
        </span>
      )}
      {weather.uv >= 6 && (
        <span className="font-mono text-[10px] border rounded px-1.5 py-0.5 text-accent bg-accent/10 border-accent/30">
          UV {weather.uv}
        </span>
      )}
    </div>
  )
}

// Lazy, on-demand Pemba insight for any non-today leg.
function PembaTake({ day }: { day: number }) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [insight, setInsight] = useState<string | null>(null)
  const [error, setError]     = useState(false)

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && insight === null && !loading) {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch(`/api/ai/plan-insight?day=${day}`)
        if (!res.ok) throw new Error('failed')
        const json = await res.json()
        if (typeof json.insight === 'string' && json.insight.trim()) {
          setInsight(json.insight)
        } else {
          setError(true)
        }
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="border-t border-accent/15">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="w-full min-h-[44px] px-4 py-2.5 flex items-center gap-1.5 text-left bg-accent/3 active:bg-accent/8 transition-colors"
      >
        <span className="text-sm shrink-0">🐂</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
          Pemba&apos;s take
        </span>
        <span className={`font-mono text-[10px] text-text-dim ml-auto transition-transform ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {open && (
        <div className="px-4 pb-3 pt-0.5 bg-accent/3 flex gap-2.5 items-start">
          <span className="w-5 shrink-0" />
          <div className="flex-1 min-w-0">
            {loading && (
              <div className="flex flex-col gap-1.5 py-1">
                <div className="h-3 bg-border/50 rounded-full animate-pulse w-full" />
                <div className="h-3 bg-border/50 rounded-full animate-pulse w-4/5" />
              </div>
            )}
            {!loading && insight && (
              <p className="font-body text-sm leading-relaxed text-text/80 italic">{insight}</p>
            )}
            {!loading && error && (
              <p className="font-mono text-[11px] text-text-muted">Pemba&apos;s offline right now — check the day&apos;s notes above.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function DayCard({ leg, isToday, isPast, cardRef, weather, insightNode, aiEnabled, ams }: DayCardProps) {
  const net    = leg.network ? networkLabel[leg.network] : null
  const altM   = leg.altitude_m ?? 0
  const altColor = altM > 4000 ? 'text-accent-3' : altM > 3000 ? 'text-accent' : 'text-text-muted'

  const formattedDate = leg.date
    ? new Date(leg.date + 'T00:00:00').toLocaleDateString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short',
      })
    : `Day ${leg.day}`

  const hasContent = leg.highlights || leg.warnings || leg.tip || leg.fun || leg.prep_tonight
  const hasWeather = weather && !isPast

  // AMS badge (rule-based, AI-independent). Folds in the old >4000m "High alt" badge.
  const amsLevel = !isPast ? (ams?.level ?? 'none') : 'none'
  const amsBadge =
    amsLevel === 'high'
      ? { cls: 'text-accent-3 bg-accent-3/10 border-accent-3/30', label: '⛰ AMS risk' }
      : amsLevel === 'watch'
      ? { cls: 'text-accent bg-accent/10 border-accent/30', label: '💧 Acclimatise' }
      : altM > 4000 && !isPast
      ? { cls: 'text-accent-3 bg-accent-3/10 border-accent-3/30', label: '⛰ High alt' }
      : null

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
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-base shrink-0 ${
          isToday
            ? 'bg-accent text-bg'
            : isPast
            ? 'bg-border/40 text-text-muted'
            : 'bg-surface-2 border border-border text-text-muted'
        }`}>
          {leg.day}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-mono text-[10px] text-text-muted uppercase tracking-wider leading-none mb-0.5">
            {formattedDate}
            {isToday && <span className="text-accent font-bold ml-1.5">· Today</span>}
          </p>
          <h3 className="font-display font-bold text-base uppercase tracking-tight text-text leading-tight truncate">
            {leg.leg}
          </h3>
        </div>

        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          {altM > 0 && (
            <div className={altColor}>
              <p className="font-mono font-bold text-base leading-none">
                {(altM / 1000).toFixed(1)}k
              </p>
              <p className="font-mono text-[9px] uppercase tracking-wider opacity-70">metres</p>
            </div>
          )}
        </div>
      </div>

      {/* Weather + badges row */}
      {(net || leg.warnings || hasWeather || amsBadge) && (
        <div className={`px-4 py-2 flex gap-1.5 flex-wrap border-t border-border/30 ${isToday ? 'bg-accent/5' : 'bg-surface'}`}>
          {amsBadge && (
            <span className={`font-mono text-[10px] uppercase tracking-wider border rounded px-1.5 py-0.5 ${amsBadge.cls}`}>
              {amsBadge.label}
            </span>
          )}
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
          {hasWeather && <WeatherBadges weather={weather!} />}
        </div>
      )}

      {/* AMS note (rule-based, shown regardless of AI flag) */}
      {amsLevel !== 'none' && ams?.note && (
        <Row
          icon={amsLevel === 'high' ? '⛰' : '💧'}
          label="Altitude"
          text={ams.note}
          color={amsLevel === 'high' ? 'text-accent-3' : 'text-accent'}
        />
      )}

      {/* Content rows */}
      {hasContent && (
        <div className="bg-surface-2/40 divide-y divide-border/40 border-t border-border/30">
          {leg.highlights && <Row icon="📍" text={leg.highlights} />}
          {leg.warnings   && <Row icon="⚠" text={leg.warnings} color="text-accent-3" />}
          {leg.tip        && <Row icon="💡" text={leg.tip} />}
          {leg.fun        && <Row icon="✨" text={leg.fun} color="text-text-muted" />}
          {leg.prep_tonight && <Row icon="🌙" label="Tonight" text={leg.prep_tonight} color="text-text-muted" />}
        </div>
      )}

      {/* Pemba AI insight — today eager (server-streamed), other days lazy on tap */}
      {isToday && insightNode}
      {aiEnabled && !isToday && !isPast && <PembaTake day={leg.day} />}

      {/* Context-aware Ask Pemba deep-link (all non-past days) */}
      {!isPast && aiEnabled && (
        <div className={`px-4 py-2.5 min-h-[44px] flex items-center border-t border-border/20 ${isToday ? 'bg-accent/5' : 'bg-surface'}`}>
          <a
            href={`/ask?day=${leg.day}`}
            className="font-mono text-[10px] text-text-dim hover:text-accent transition-colors flex items-center gap-1"
          >
            🐂 Ask Pemba about this day →
          </a>
        </div>
      )}
    </div>
  )
}
