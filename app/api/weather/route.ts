import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const revalidate = 1800 // 30 min cache

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 })
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', lat)
  url.searchParams.set('longitude', lon)
  url.searchParams.set('current', 'temperature_2m,weather_code,apparent_temperature,wind_speed_10m')
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max')
  url.searchParams.set('timezone', 'Asia/Kolkata')
  url.searchParams.set('forecast_days', '1')

  const res = await fetch(url.toString(), {
    next: { revalidate: 1800 },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Weather fetch failed' }, { status: 502 })
  }

  const data = await res.json()
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
  })
}
