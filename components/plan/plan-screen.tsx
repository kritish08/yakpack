'use client'

import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import type { Leg, Trip, LegWeather } from '@/lib/plan'
import type { MemberView, TripContact } from '@/lib/database.types'
import { amsRisk } from '@/lib/ams'
import DayCard from './day-card'
import ImportPlan from './import-plan'

interface PlanScreenProps {
  legs:            Leg[]
  contacts:        TripContact[]
  trip:            Trip | null
  ctx:             MemberView
  isOrganiser?:    boolean
  today:           string
  weatherMap?:     Record<number, LegWeather | null>
  todayInsightNode?: ReactNode
  aiEnabled?:      boolean
}

export default function PlanScreen({ legs, contacts, trip, today, weatherMap, todayInsightNode, aiEnabled, isOrganiser }: PlanScreenProps) {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const stripRef = useRef<HTMLDivElement>(null)
  const todayIndex = legs.findIndex(l => l.date === today)

  // Precompute AMS risk once per legs change instead of O(n²) inside the render loop.
  const amsByDay = useMemo(
    () => Object.fromEntries(legs.map(l => [l.day, amsRisk(legs, l.day)])),
    [legs],
  )

  const departDate  = legs[0]?.date ?? ''
  const tripStarted = departDate && today >= departDate
  const tripEnded   = legs.length > 0 && today > (legs[legs.length - 1].date ?? '')

  // Formatted in the traveller's own timezone, from the same `today` the status
  // is decided by — so the badge and the date can never disagree.
  const lastDayLabel = legs.length > 0
    ? new Date((legs[legs.length - 1].date ?? '') + 'T12:00:00Z')
        .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

  const daysToGo = departDate && !tripStarted
    ? Math.ceil((new Date(departDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000)
    : null

  useEffect(() => {
    const ref = cardRefs.current[todayIndex >= 0 ? todayIndex : 0]
    ref?.scrollIntoView({ behavior: 'smooth', block: 'start' })

    const strip = stripRef.current
    if (strip && todayIndex >= 0) {
      const pill = strip.children[todayIndex] as HTMLElement | undefined
      if (pill) {
        strip.scrollTo({ left: pill.offsetLeft - strip.clientWidth / 2 + pill.offsetWidth / 2, behavior: 'smooth' })
      }
    }
  }, [todayIndex])

  function scrollToDay(index: number) {
    cardRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (legs.length === 0) {
    return (
      <div className="h-full overflow-y-auto pb-20 px-4 pt-5">
        <h1 className="font-display font-bold text-2xl uppercase tracking-tight text-text leading-none">
          {trip?.name ?? 'Your trip'}
        </h1>
        <div className="mt-10 flex flex-col items-center text-center gap-4 py-10">
          <span className="text-5xl" aria-hidden="true">🗺️</span>
          <p className="font-display font-bold text-base uppercase tracking-tight text-text">
            This trip has no days yet
          </p>
          <p className="font-body text-sm text-text-muted max-w-xs leading-relaxed">
            {isOrganiser
              ? 'Paste an itinerary and it will be read into days. Anything it cannot work out is left blank rather than guessed.'
              : 'The organiser has not added the plan yet.'}
          </p>
          {isOrganiser && <ImportPlan hasPlan={false} />}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto pb-20">
      {/* Header */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-2xl uppercase tracking-tight text-text leading-none">
              {trip?.name ?? 'Your trip'}
            </h1>
            <p className="font-mono text-xs text-text-muted mt-1">
              {legs.length === 0
                ? 'No plan yet'
                : tripEnded
                  ? `${legs.length} days · ended ${lastDayLabel}`
                  : `${legs.length} day${legs.length === 1 ? '' : 's'}`}
            </p>
          </div>
          {/* "Complete" read as "you finished packing". The trip is over — a
              status about dates, not about progress — and it is still fully
              editable, which the subtitle says rather than the badge. */}
          {tripEnded ? (
            <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-border/30 text-text-muted border border-border shrink-0">
              Trip ended
            </span>
          ) : daysToGo !== null ? (
            <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/30 shrink-0">
              {daysToGo}d to go
            </span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-accent-2/10 text-accent-2 border border-accent-2/30 shrink-0">
              Underway
            </span>
          )}
        </div>

        {tripEnded && (
          <p className="font-body text-xs text-text-dim leading-relaxed mt-2">
            These dates have passed. Everything stays exactly as it is — you can still
            edit the days, tick things off and look back over it.
          </p>
        )}

        {/* Trip contacts — as many as the trip has, each with its own role. */}
        {contacts.length > 0 && (
          <div className="mt-4 bg-surface border border-border rounded-xl px-4 py-3 flex flex-col gap-2">
            <p className="font-mono text-[10px] text-text-muted uppercase tracking-wider">Contacts</p>
            {contacts.map((c, i) => {
              const label = c.name || c.role
              // A contact with no number is still worth showing — a name and a
              // note ("permit office, Reckong Peo") is useful on its own — so
              // only the ones that can actually be dialled become links.
              const Row = c.phone ? 'a' : 'div'
              return (
                <Row
                  key={c.id}
                  {...(c.phone ? { href: `tel:${c.phone.replace(/\s+/g, '')}` } : {})}
                  className={`flex items-start justify-between gap-3 group ${i > 0 ? 'border-t border-border/40 pt-2' : ''}`}
                >
                  <span className="min-w-0">
                    <span className="font-body text-sm text-text block truncate">{label}</span>
                    <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider block truncate">
                      {c.name ? c.role : ''}{c.name && c.note ? ' · ' : ''}{c.note ?? ''}
                    </span>
                  </span>
                  {c.phone && (
                    <span className="font-mono text-xs text-accent group-active:opacity-70 shrink-0 pt-0.5">
                      {c.phone}
                    </span>
                  )}
                </Row>
              )
            })}
          </div>
        )}
      </div>

      {/* Journey strip — sticky */}
      <div className="sticky top-0 z-10 bg-bg/90 backdrop-blur-sm border-b border-border/50 px-4 py-2.5">
        <div
          ref={stripRef}
          className="flex gap-2 overflow-x-auto no-scrollbar"
          style={{ scrollbarWidth: 'none' }}
        >
          {legs.map((leg, i) => {
            const isToday = leg.date === today
            const isPast  = !!leg.date && today > leg.date
            return (
              <button
                key={leg.day}
                onClick={() => scrollToDay(i)}
                aria-label={`Day ${leg.day}`}
                className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-mono text-sm font-bold transition-all ${
                  isToday
                    ? 'bg-accent text-bg scale-110 shadow-sm'
                    : isPast
                    ? 'bg-border/30 text-text-muted'
                    : 'bg-surface border border-border text-text-muted hover:border-accent/50 hover:text-text'
                }`}
              >
                {leg.day}
              </button>
            )
          })}
        </div>
      </div>

      {/* Day cards */}
      <div className="px-4 pt-4 flex flex-col gap-4">
        {legs.map((leg, i) => {
          const isToday = leg.date === today
          const isPast  = !!leg.date && today > leg.date
          return (
            <DayCard
              key={leg.day}
              leg={leg}
              isToday={isToday}
              isPast={isPast}
              cardRef={el => { cardRefs.current[i] = el }}
              weather={weatherMap?.[leg.day] ?? null}
              insightNode={isToday ? todayInsightNode : undefined}
              aiEnabled={aiEnabled}
              ams={amsByDay[leg.day]}
            />
          )
        })}

        {legs.length === 0 && (
          <div className="text-center py-16">
            <p className="font-mono text-sm text-text-muted">No itinerary loaded yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
