import { getTodayData, fetchWeather } from '@/lib/today'
import { deriveCarryTags } from '@/lib/weather'
import WeatherHero from '@/components/today/weather-hero'
import CarryChips from '@/components/today/carry-chips'
import LegCard from '@/components/today/leg-card'
import HeadsUp from '@/components/today/heads-up'
import Pemba, { deriveMood } from '@/components/pemba/pemba'

export default async function TodayPage() {
  const { todayLeg, items, isToday, isFuture, isPast } = await getTodayData()

  const wx = todayLeg ? await fetchWeather(todayLeg.lat, todayLeg.lon) : null
  const activeTags = wx && todayLeg ? deriveCarryTags(wx, todayLeg.altitude_m ?? 0) : []

  const mood = deriveMood({
    isToday,
    isPast,
    activeTags,
    hasWarnings: !!todayLeg?.warnings,
  })

  return (
    <div className="px-4 pt-4 pb-6 flex flex-col gap-3">
      {/* Page header */}
      <div>
        <h1 className="font-display font-bold text-2xl uppercase tracking-tight text-text">Today</h1>
        {isPast && <p className="font-mono text-xs text-text-muted mt-0.5">Trip complete — showing last day</p>}
        {isFuture && <p className="font-mono text-xs text-accent mt-0.5">Trip starts {todayLeg?.date} · showing Day 1 preview</p>}
      </div>

      {/* Pemba mascot */}
      <Pemba mood={mood} />

      {/* Today's leg */}
      {todayLeg && <LegCard leg={todayLeg} isToday={isToday} isFuture={isFuture} />}

      {/* Warnings */}
      {todayLeg && <HeadsUp warnings={todayLeg.warnings} />}

      {/* Weather hero */}
      {wx ? (
        <WeatherHero wx={wx} altitude_m={todayLeg?.altitude_m ?? 0} activeTags={activeTags} />
      ) : (
        <div className="bg-surface border border-border rounded-2xl p-5 font-mono text-sm text-text-muted">
          Weather unavailable — check your connection
        </div>
      )}

      {/* Carry chips */}
      {todayLeg && (
        <CarryChips
          items={items}
          activeTags={activeTags}
          carryToday={todayLeg.carry_today ?? []}
        />
      )}
    </div>
  )
}
