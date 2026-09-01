'use client'

import { AlertTriangle, MapPin } from 'lucide-react'
import type { ParsedDay } from '@/lib/import-types'

/**
 * The confirmation step between extraction and the database.
 *
 * This screen is the reason the import is trustworthy. Extraction is imperfect
 * and Open-Meteo's geocoder is openly unreliable for small mountain settlements
 * — it puts "Kaza" in Russia at 61 m and finds nothing at all for Chandratal.
 * Since altitude drives the AMS warnings, a wrong number is worse than no
 * number, so every located place shows what it actually resolved to and has to
 * be accepted. Confident matches start ticked; doubtful ones start clear, which
 * makes the default failure *missing* data rather than *wrong* data.
 */
export default function DayReview({
  days, gaps, accepted, onToggle,
}: {
  days: ParsedDay[]
  gaps: string[]
  accepted: Record<number, boolean>
  onToggle: (day: number, on: boolean) => void
}) {
  return (
    <>
      {gaps.length > 0 && (
        <div className="mb-4 rounded-xl border border-accent/25 bg-accent/[0.05] p-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent flex items-center gap-1.5 mb-1.5">
            <AlertTriangle size={11} aria-hidden="true" />
            {gaps.length} thing{gaps.length === 1 ? '' : 's'} to check
          </p>
          <ul className="flex flex-col gap-1">
            {gaps.map((g, i) => (
              <li key={i} className="font-body text-xs text-text-muted leading-relaxed">{g}</li>
            ))}
          </ul>
        </div>
      )}

      <ol className="flex flex-col gap-2">
        {days.map(d => (
          <li key={d.day} className="border border-border rounded-xl p-3">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[11px] text-accent shrink-0">D{d.day}</span>
              <span className="font-body text-sm text-text flex-1 min-w-0">{d.leg}</span>
              <span className="font-mono text-[10px] text-text-dim shrink-0">{d.date ?? 'no date'}</span>
            </div>

            {d.suggestion ? (
              <label className="mt-2 flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(accepted[d.day])}
                  onChange={e => onToggle(d.day, e.target.checked)}
                  className="mt-0.5 accent-[var(--accent)]"
                />
                <span className="font-mono text-[11px] leading-relaxed">
                  <span className={d.suggestion.nameMatches ? 'text-text-muted' : 'text-accent-3'}>
                    <MapPin size={10} className="inline mb-0.5 mr-1" aria-hidden="true" />
                    {d.place} → {d.suggestion.name}
                    {d.suggestion.admin ? `, ${d.suggestion.admin}` : ''}
                    {d.suggestion.country ? `, ${d.suggestion.country}` : ''}
                  </span>
                  <span className="block text-text-dim">
                    {d.suggestion.elevation != null
                      ? `${d.suggestion.elevation.toLocaleString()} m`
                      : 'no elevation'}
                    {' · '}use for weather and altitude
                  </span>
                </span>
              </label>
            ) : (
              <p className="mt-2 font-mono text-[11px] text-text-dim">
                No location — this day gets no weather.
              </p>
            )}
          </li>
        ))}
      </ol>
    </>
  )
}
