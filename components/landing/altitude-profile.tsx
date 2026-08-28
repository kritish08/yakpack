/**
 * The trip's real elevation profile, Delhi → Kunzum La → Delhi.
 *
 * This is the page's structural spine rather than decoration: altitude is the
 * variable the whole app turns on. It decides AMS risk, which layers get pulled
 * to the top of the pack, and — at Chandratal — whether there is any signal at
 * all. Numbers come from docs/02_itinerary.md.
 *
 * Pure SVG + CSS so it server-renders with no JS; the draw-on animation is a
 * stroke-dashoffset transition that prefers-reduced-motion switches off.
 */

export interface Leg {
  day: number
  place: string
  altitude: number
  network: 'good' | 'patchy' | 'weak' | 'none'
  note?: string
}

export const LEGS: Leg[] = [
  { day: 1, place: 'Delhi → Shimla',   altitude:  216, network: 'good'   },
  { day: 2, place: 'Sangla · Chitkul', altitude: 3450, network: 'patchy', note: 'First night at altitude' },
  { day: 3, place: 'Chitkul',          altitude: 3450, network: 'patchy' },
  { day: 4, place: 'Nako → Tabo',      altitude: 3625, network: 'weak',   note: 'Enter Spiti' },
  { day: 5, place: 'Dhankar → Kaza',   altitude: 3800, network: 'weak'   },
  { day: 6, place: 'Komic · Hikkim',   altitude: 4587, network: 'weak',   note: "World's highest post office" },
  { day: 7, place: 'Kunzum La',        altitude: 4590, network: 'none',   note: 'No signal. Sub-zero camp.' },
  { day: 8, place: 'Batal → Manali',   altitude: 2050, network: 'good'   },
  { day: 9, place: 'Manali → Delhi',   altitude:  216, network: 'good'   },
]

const W = 1000
const H = 220
const PAD_TOP = 34
const PAD_BOTTOM = 34
const MIN_ALT = 0
const MAX_ALT = 4800

function x(i: number) {
  return (i / (LEGS.length - 1)) * W
}
function y(alt: number) {
  const usable = H - PAD_TOP - PAD_BOTTOM
  return H - PAD_BOTTOM - ((alt - MIN_ALT) / (MAX_ALT - MIN_ALT)) * usable
}

const points = LEGS.map((l, i) => [x(i), y(l.altitude)] as const)
const line = points.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
const area = `${line} L${W},${H} L0,${H} Z`

const peakIdx = LEGS.reduce((best, l, i) => (l.altitude > LEGS[best].altitude ? i : best), 0)
const darkIdx = LEGS.findIndex(l => l.network === 'none')

export default function AltitudeProfile({ className = '' }: { className?: string }) {
  return (
    <figure className={className}>
      <figcaption className="sr-only">
        Elevation profile of the nine-day route, from 216 m in Delhi to 4,590 m at Kunzum La and back.
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-[140px] sm:h-[180px] overflow-visible"
        role="img"
        aria-label="Elevation profile climbing from 216 metres to 4,590 metres over nine days"
      >
        <defs>
          <linearGradient id="alt-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 4,000 m — the line above which the app force-promotes cold-weather kit */}
        <line
          x1="0" x2={W} y1={y(4000)} y2={y(4000)}
          stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="4 6" vectorEffect="non-scaling-stroke"
        />

        <path d={area} fill="url(#alt-fill)" className="yp-profile-area" />
        <path
          d={line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="yp-profile-line"
        />

        {points.map(([px, py], i) => (
          <circle
            key={i}
            cx={px}
            cy={py}
            r={i === peakIdx || i === darkIdx ? 5 : 3}
            fill={i === darkIdx ? 'var(--accent-3)' : i === peakIdx ? 'var(--accent)' : 'var(--bg)'}
            stroke={i === darkIdx ? 'var(--accent-3)' : 'var(--accent)'}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            className="yp-profile-dot"
            style={{ animationDelay: `${0.9 + i * 0.07}s` }}
          />
        ))}
      </svg>

      {/* Day scale — the ticks carry the actual altitudes, so the axis is the content */}
      <ol className="mt-3 grid grid-cols-9 gap-0.5 font-mono text-[9px] sm:text-[10px] text-text-dim">
        {LEGS.map(l => (
          <li key={l.day} className="text-center leading-tight">
            <span className="block text-text-muted">D{l.day}</span>
            <span className={l.network === 'none' ? 'text-accent-3' : ''}>
              {l.altitude.toLocaleString()}
            </span>
          </li>
        ))}
      </ol>
    </figure>
  )
}
