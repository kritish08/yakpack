'use client'

import { useEffect, useRef } from 'react'
import type { Leg, Trip, Profile } from '@/lib/plan'
import DayCard from './day-card'

interface PlanScreenProps {
  legs: Leg[]
  trip: Trip | null
  profile: Profile
  today: string
}

export default function PlanScreen({ legs, trip, profile, today }: PlanScreenProps) {
  const todayIndex = legs.findIndex(l => l.date === today)
  const todayRef = useRef<HTMLDivElement>(null)

  // Scroll today's card into view on mount
  useEffect(() => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const tripStarted = legs.length > 0 && today >= (legs[0].date ?? '')
  const tripEnded = legs.length > 0 && today > (legs[legs.length - 1].date ?? '')

  return (
    <div className="px-4 pt-4 pb-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="font-display font-bold text-2xl uppercase tracking-tight text-text">Plan</h1>
        {trip && (
          <p className="font-mono text-xs text-text-muted mt-0.5">
            {trip.name} · {legs.length} days
          </p>
        )}

        {/* Trip status strip */}
        {tripEnded ? (
          <div className="mt-3 bg-surface border border-border rounded-xl px-3 py-2 font-mono text-xs text-text-muted">
            Trip complete — what a ride, {profile.display_name}!
          </div>
        ) : !tripStarted ? (
          <div className="mt-3 bg-accent/10 border border-accent/30 rounded-xl px-3 py-2 font-mono text-xs text-accent">
            Departs {legs[0]?.date
              ? new Date(legs[0].date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
              : '—'}
          </div>
        ) : null}
      </div>

      {/* Trip contacts */}
      {trip && (
        <div className="mb-5 bg-surface border border-border rounded-2xl p-4 flex flex-col gap-2">
          <p className="font-mono text-[11px] text-text-muted uppercase tracking-wider mb-1">Emergency contacts</p>
          {trip.coordinator_name && (
            <a href={`tel:${trip.coordinator_phone}`} className="flex items-center justify-between group">
              <span className="font-body text-sm text-text">{trip.coordinator_name}</span>
              <span className="font-mono text-xs text-accent group-active:text-accent/70">{trip.coordinator_phone}</span>
            </a>
          )}
          {trip.leader_name && (
            <a href={`tel:${trip.leader_phone}`} className="flex items-center justify-between group border-t border-border/50 pt-2">
              <span className="font-body text-sm text-text">{trip.leader_name}</span>
              <span className="font-mono text-xs text-accent group-active:text-accent/70">{trip.leader_phone}</span>
            </a>
          )}
        </div>
      )}

      {/* Timeline */}
      <div>
        {legs.map((leg, i) => {
          const isToday = leg.date === today
          const isPast = !!leg.date && today > leg.date

          return (
            <div key={leg.day} ref={isToday ? todayRef : undefined}>
              <DayCard
                leg={leg}
                isToday={isToday}
                isPast={isPast}
                isLast={i === legs.length - 1}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
