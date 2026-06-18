'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import type { Leg, Trip, Profile, LegWeather } from '@/lib/plan'
import { amsRisk } from '@/lib/ams'
import DayCard from './day-card'

interface PlanScreenProps {
  legs:            Leg[]
  trip:            Trip | null
  profile:         Profile
  today:           string
  weatherMap?:     Record<number, LegWeather | null>
  todayInsightNode?: ReactNode
  aiEnabled?:      boolean
}

export default function PlanScreen({ legs, trip, profile, today, weatherMap, todayInsightNode, aiEnabled }: PlanScreenProps) {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const stripRef = useRef<HTMLDivElement>(null)
  const todayIndex = legs.findIndex(l => l.date === today)

  const departDate  = legs[0]?.date ?? ''
  const tripStarted = departDate && today >= departDate
  const tripEnded   = legs.length > 0 && today > (legs[legs.length - 1].date ?? '')

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

  return (
    <div className="h-full overflow-y-auto pb-20">
      {/* Header */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-2xl uppercase tracking-tight text-text leading-none">
              {trip?.name ?? 'Spiti Valley'}
            </h1>
            <p className="font-mono text-xs text-text-muted mt-1">
              {legs.length} days · {profile.display_name}
            </p>
          </div>
          {tripEnded ? (
            <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-border/30 text-text-muted border border-border shrink-0">
              Complete
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

        {/* Emergency contacts */}
        {trip && (trip.coordinator_name || trip.leader_name) && (
          <div className="mt-4 bg-surface border border-border rounded-xl px-4 py-3 flex flex-col gap-2">
            <p className="font-mono text-[10px] text-text-muted uppercase tracking-wider">Emergency contacts</p>
            {trip.coordinator_name && (
              <a href={`tel:${trip.coordinator_phone}`} className="flex items-center justify-between group">
                <span className="font-body text-sm text-text">{trip.coordinator_name}</span>
                <span className="font-mono text-xs text-accent group-active:opacity-70">{trip.coordinator_phone}</span>
              </a>
            )}
            {trip.leader_name && (
              <a href={`tel:${trip.leader_phone}`} className="flex items-center justify-between group border-t border-border/40 pt-2">
                <span className="font-body text-sm text-text">{trip.leader_name}</span>
                <span className="font-mono text-xs text-accent group-active:opacity-70">{trip.leader_phone}</span>
              </a>
            )}
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
              ams={amsRisk(legs, leg.day)}
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
