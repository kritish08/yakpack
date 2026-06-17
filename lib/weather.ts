export interface WeatherData {
  current: {
    temperature_2m: number
    weather_code: number
    apparent_temperature: number
    wind_speed_10m: number
  }
  daily: {
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    sunrise: string[]
    sunset: string[]
    uv_index_max: number[]
    precipitation_probability_max: number[]
  }
}

export type CarryTag = 'cold' | 'rain' | 'uv'

export function deriveCarryTags(wx: WeatherData, altitude_m: number): CarryTag[] {
  const tags: CarryTag[] = []
  const tempMin = wx.daily.temperature_2m_min[0]
  const precipProb = wx.daily.precipitation_probability_max[0]
  const uvMax = wx.daily.uv_index_max[0]

  if (tempMin < 5 || altitude_m > 4000) tags.push('cold')
  if (precipProb >= 50) tags.push('rain')
  if (uvMax >= 6) tags.push('uv')
  return tags
}

const WMO_ICONS: Record<number, { icon: string; label: string }> = {
  0:  { icon: '☀️', label: 'Clear sky' },
  1:  { icon: '🌤', label: 'Mainly clear' },
  2:  { icon: '⛅', label: 'Partly cloudy' },
  3:  { icon: '☁️', label: 'Overcast' },
  45: { icon: '🌫', label: 'Foggy' },
  48: { icon: '🌫', label: 'Icy fog' },
  51: { icon: '🌦', label: 'Light drizzle' },
  53: { icon: '🌦', label: 'Drizzle' },
  55: { icon: '🌧', label: 'Heavy drizzle' },
  61: { icon: '🌧', label: 'Light rain' },
  63: { icon: '🌧', label: 'Rain' },
  65: { icon: '🌧', label: 'Heavy rain' },
  71: { icon: '❄️', label: 'Light snow' },
  73: { icon: '❄️', label: 'Snow' },
  75: { icon: '❄️', label: 'Heavy snow' },
  77: { icon: '🌨', label: 'Snow grains' },
  80: { icon: '🌦', label: 'Rain showers' },
  81: { icon: '🌧', label: 'Heavy showers' },
  82: { icon: '⛈', label: 'Violent showers' },
  85: { icon: '❄️', label: 'Snow showers' },
  95: { icon: '⛈', label: 'Thunderstorm' },
  96: { icon: '⛈', label: 'Thunderstorm + hail' },
  99: { icon: '⛈', label: 'Severe thunderstorm' },
}

export function wmoDescription(code: number) {
  return WMO_ICONS[code] ?? { icon: '🌡', label: 'Unknown' }
}
