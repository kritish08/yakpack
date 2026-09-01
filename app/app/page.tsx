import Link from 'next/link'
import { getTodayData, fetchWeather } from '@/lib/today'
import { deriveCarryTags } from '@/lib/weather'
import WeatherHero from '@/components/today/weather-hero'
import CarryChips from '@/components/today/carry-chips'
import LegCard from '@/components/today/leg-card'
import HeadsUp from '@/components/today/heads-up'
import Pemba, { deriveMood } from '@/components/pemba/pemba'
import AiBriefingCard from '@/components/today/ai-briefing-card'
import { AI_ENABLED } from '@/lib/ai'

export default async function TodayPage() {
  const { todayLeg, items, packedIds, isToday, isFuture, isPast } = await getTodayData()

  // Three different things can leave this screen without a forecast, and they
  // need three different sentences. A day with no coordinates is a normal state
  // with an obvious next step; a failed fetch is a connection problem; no day at
  // all is neither. Collapsing them into "check your connection" tells someone
  // standing in a valley with full signal to go and fix their signal.
  const hasLocation = todayLeg?.lat != null && todayLeg?.lon != null
  const wx = hasLocation ? await fetchWeather(todayLeg!.lat!, todayLeg!.lon!) : null
  const activeTags = wx && todayLeg ? deriveCarryTags(wx, todayLeg.altitude_m ?? 0) : []

  const mood = deriveMood({
    isToday,
    isPast,
    activeTags,
    hasWarnings: !!todayLeg?.warnings,
  })

  return (
    <div className="px-4 pt-4 pb-6 flex flex-col gap-3">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-2xl uppercase tracking-tight text-text">Today</h1>
        {isPast   && <p className="font-mono text-xs text-text-muted mt-0.5">Trip complete — showing last day</p>}
        {isFuture && <p className="font-mono text-xs text-accent mt-0.5">Trip starts {todayLeg?.date} · showing Day 1 preview</p>}
      </div>

      {/* Pemba mascot */}
      <Pemba mood={mood} />

      {/* AI briefing — client-fetched so it can carry the caller's own key */}
      {AI_ENABLED && <AiBriefingCard />}

      {/* Today's leg */}
      {todayLeg && <LegCard leg={todayLeg} isToday={isToday} isFuture={isFuture} />}

      {/* Warnings */}
      {todayLeg && <HeadsUp warnings={todayLeg.warnings} />}

      {/* Weather */}
      {wx ? (
        <WeatherHero wx={wx} altitude_m={todayLeg?.altitude_m ?? 0} activeTags={activeTags} leg={todayLeg ?? null} />
      ) : todayLeg && !hasLocation ? (
        <div className="bg-surface border border-border rounded-2xl p-5">
          <p className="font-mono text-sm text-text-muted">No location on this day yet</p>
          <p className="font-body text-xs text-text-dim mt-1 leading-relaxed">
            Add a place to{' '}
            <Link href="/app/plan" className="text-accent underline underline-offset-2">
              {todayLeg.leg}
            </Link>{' '}
            and the forecast, the UV warning and the cold-weather items follow from it.
          </p>
        </div>
      ) : todayLeg ? (
        <div className="bg-surface border border-border rounded-2xl p-5 font-mono text-sm text-text-muted">
          Weather unavailable — check your connection
        </div>
      ) : (
        // No days at all. Reachable on purpose: the trip builder lets you skip
        // the itinerary and fill it in later, so this is a new trip rather than
        // a broken one. Say that, and say what to do next — an almost-empty
        // Today screen with no explanation reads as the app having failed.
        <div className="bg-surface border border-border rounded-2xl p-5">
          <p className="font-mono text-sm text-text-muted">No days in this trip yet</p>
          <p className="font-body text-xs text-text-dim mt-1 leading-relaxed">
            Add them on the{' '}
            <Link href="/app/plan" className="text-accent underline underline-offset-2">Plan</Link>{' '}
            screen — paste an itinerary or write the days yourself. Weather, altitude
            warnings and the day-by-day carry list all follow from them.
          </p>
          <p className="font-body text-xs text-text-dim mt-2 leading-relaxed">
            Your packing list works without any of that — it is on{' '}
            <Link href="/app/pack" className="text-accent underline underline-offset-2">Pack</Link>.
          </p>
        </div>
      )}

      {/* Carry chips with packed status */}
      {todayLeg && (
        <CarryChips
          items={items}
          activeTags={activeTags}
          carryToday={todayLeg.carry_today ?? []}
          packedIds={packedIds}
        />
      )}
    </div>
  )
}
