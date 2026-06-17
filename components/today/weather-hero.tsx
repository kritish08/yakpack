import type { WeatherData, CarryTag } from '@/lib/weather'
import { wmoDescription } from '@/lib/weather'

interface WeatherHeroProps {
  wx: WeatherData
  altitude_m: number
  activeTags: CarryTag[]
}

const TAG_CONFIG: Record<CarryTag, { label: string; icon: string; color: string }> = {
  cold: { label: 'Cold', icon: '🧊', color: 'text-accent-4 bg-accent-4/10 border-accent-4/30' },
  rain: { label: 'Rain', icon: '🌧', color: 'text-accent-4 bg-accent-4/10 border-accent-4/30' },
  uv:   { label: 'High UV', icon: '☀️', color: 'text-accent bg-accent/10 border-accent/30' },
}

export default function WeatherHero({ wx, altitude_m, activeTags }: WeatherHeroProps) {
  const { current, daily } = wx
  const { icon, label } = wmoDescription(current.weather_code)
  const tempMin = Math.round(daily.temperature_2m_min[0])
  const tempMax = Math.round(daily.temperature_2m_max[0])
  const uv = daily.uv_index_max[0]
  const precip = daily.precipitation_probability_max[0]

  return (
    <div className="bg-surface rounded-2xl border border-border p-5">
      {/* Big temp */}
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono font-medium leading-none" style={{ fontSize: 'clamp(40px, 9vw, 72px)' }}>
            {Math.round(current.temperature_2m)}°
          </div>
          <div className="font-mono text-sm text-text-muted mt-1">
            Feels {Math.round(current.apparent_temperature)}° · Wind {Math.round(current.wind_speed_10m)} km/h
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl">{icon}</div>
          <div className="font-mono text-xs text-text-muted mt-1">{label}</div>
        </div>
      </div>

      {/* Daily range row */}
      <div className="flex gap-4 mt-4 pt-4 border-t border-border/50">
        <div className="flex-1 text-center">
          <div className="font-mono text-xs text-text-muted uppercase tracking-wider">Low</div>
          <div className="font-mono text-lg font-medium text-text mt-0.5">{tempMin}°</div>
        </div>
        <div className="flex-1 text-center border-x border-border/50">
          <div className="font-mono text-xs text-text-muted uppercase tracking-wider">High</div>
          <div className="font-mono text-lg font-medium text-text mt-0.5">{tempMax}°</div>
        </div>
        <div className="flex-1 text-center">
          <div className="font-mono text-xs text-text-muted uppercase tracking-wider">UV</div>
          <div className="font-mono text-lg font-medium text-text mt-0.5">{uv.toFixed(1)}</div>
        </div>
        <div className="flex-1 text-center">
          <div className="font-mono text-xs text-text-muted uppercase tracking-wider">Rain%</div>
          <div className="font-mono text-lg font-medium text-text mt-0.5">{precip}%</div>
        </div>
      </div>

      {/* Altitude */}
      <div className="mt-3 font-mono text-xs text-text-muted">
        {altitude_m.toLocaleString()} m elevation
      </div>

      {/* Active condition tags */}
      {activeTags.length > 0 && (
        <div className="flex gap-2 mt-4 flex-wrap">
          {activeTags.map(tag => (
            <span key={tag} className={`font-mono text-xs border rounded-full px-2.5 py-1 ${TAG_CONFIG[tag].color}`}>
              {TAG_CONFIG[tag].icon} {TAG_CONFIG[tag].label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
