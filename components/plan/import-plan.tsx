'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, Loader2, MapPin, Upload, X } from 'lucide-react'
import { byokHeaders, getKey } from '@/lib/byok'
import { saveItinerary, type ItineraryDayInput } from '@/app/actions/itinerary'
import type { NetworkQuality } from '@/lib/database.types'

interface Suggestion {
  query: string
  name: string
  country: string | null
  admin: string | null
  lat: number
  lon: number
  elevation: number | null
  nameMatches: boolean
}

interface ParsedDay {
  day: number
  date: string | null
  leg: string
  place: string | null
  highlights: string | null
  warnings: string | null
  network: NetworkQuality | null
  lat: number | null
  lon: number | null
  altitude_m: number | null
  suggestion: Suggestion | null
}

/**
 * Paste an itinerary, read what was understood, then save.
 *
 * The review step is the point. Extraction is imperfect and the geocoder is
 * openly unreliable for small mountain settlements, so every located place is
 * shown with the name and country it actually resolved to and has to be accepted
 * before its coordinates and altitude are used. Nothing is written on trust.
 */
export default function ImportPlan({ hasPlan }: { hasPlan: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [days, setDays] = useState<ParsedDay[] | null>(null)
  const [gaps, setGaps] = useState<string[]>([])
  const [accepted, setAccepted] = useState<Record<number, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, startTransition] = useTransition()

  async function parse() {
    setBusy(true); setError(null)
    try {
      if (!getKey()) {
        setError('Reading a plan uses the AI. Add your OpenAI key in Settings first.')
        return
      }
      const res = await fetch('/api/ai/import-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...byokHeaders() },
        body: JSON.stringify({ text }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json?.error ?? 'Could not read that itinerary.'); return }

      setDays(json.days as ParsedDay[])
      setGaps(json.gaps ?? [])
      // Confident matches start accepted; anything doubtful stays off so the
      // default outcome is "no data" rather than "wrong data".
      const next: Record<number, boolean> = {}
      for (const d of json.days as ParsedDay[]) next[d.day] = Boolean(d.suggestion?.nameMatches)
      setAccepted(next)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  function save() {
    if (!days) return
    setError(null)
    startTransition(async () => {
      try {
        const payload: ItineraryDayInput[] = days.map(d => {
          const use = accepted[d.day] && d.suggestion
          return {
            day: d.day,
            date: d.date,
            leg: d.leg,
            lat: use ? d.suggestion!.lat : null,
            lon: use ? d.suggestion!.lon : null,
            altitude_m: use ? d.suggestion!.elevation : null,
            highlights: d.highlights,
            warnings: d.warnings,
            network: d.network,
          }
        })
        await saveItinerary(payload)
        setOpen(false); setDays(null); setText(''); setGaps([])
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save the plan.')
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border hover:border-accent/40 text-text-muted hover:text-text transition-colors font-mono text-xs min-h-[44px]"
      >
        <Upload size={13} /> {hasPlan ? 'Replace plan' : 'Import a plan'}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Import a plan">
          <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-surface rounded-t-2xl border-t border-border w-full flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 shrink-0" />
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h3 className="font-display font-bold text-sm uppercase tracking-tight text-text">
                {days ? 'What we understood' : 'Import a plan'}
              </h3>
              <button onClick={() => setOpen(false)} aria-label="Close" className="p-2 text-text-muted hover:text-text min-h-[44px]">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {!days ? (
                <>
                  <p className="font-body text-xs text-text-muted leading-relaxed mb-3">
                    Paste an itinerary — an operator&apos;s day-by-day, an email, your own
                    notes. Anything it can&apos;t work out is left blank rather than guessed,
                    and you can fill those in afterwards.
                  </p>
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    rows={10}
                    placeholder={'Day 1 — Delhi to Manali, overnight bus\nDay 2 — Manali, acclimatise\n…'}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2.5 text-sm text-text font-body outline-none focus:border-accent transition-colors resize-y"
                  />
                  <button
                    onClick={parse}
                    disabled={busy || text.trim().length < 20}
                    className="mt-3 w-full bg-accent text-bg font-display font-bold uppercase tracking-tight text-sm py-3 rounded-xl disabled:opacity-40 min-h-[44px] flex items-center justify-center gap-2"
                  >
                    {busy ? <><Loader2 size={15} className="animate-spin" /> Reading…</> : 'Read it'}
                  </button>
                </>
              ) : (
                <>
                  {gaps.length > 0 && (
                    <div className="mb-4 rounded-xl border border-accent/25 bg-accent/[0.05] p-3">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-accent flex items-center gap-1.5 mb-1.5">
                        <AlertTriangle size={11} /> {gaps.length} thing{gaps.length === 1 ? '' : 's'} to check
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
                              onChange={e => setAccepted(a => ({ ...a, [d.day]: e.target.checked }))}
                              className="mt-0.5 accent-[var(--accent)]"
                            />
                            <span className="font-mono text-[11px] leading-relaxed">
                              <span className={d.suggestion.nameMatches ? 'text-text-muted' : 'text-accent-3'}>
                                <MapPin size={10} className="inline mb-0.5 mr-1" />
                                {d.place} → {d.suggestion.name}
                                {d.suggestion.admin ? `, ${d.suggestion.admin}` : ''}
                                {d.suggestion.country ? `, ${d.suggestion.country}` : ''}
                              </span>
                              <span className="block text-text-dim">
                                {d.suggestion.elevation != null ? `${d.suggestion.elevation.toLocaleString()} m` : 'no elevation'}
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

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={save}
                      disabled={pending}
                      className="flex-1 bg-accent text-bg font-display font-bold uppercase tracking-tight text-sm py-3 rounded-xl disabled:opacity-40 min-h-[44px] flex items-center justify-center gap-2"
                    >
                      {pending ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : <><Check size={15} /> Save {days.length} days</>}
                    </button>
                    <button
                      onClick={() => { setDays(null); setGaps([]) }}
                      className="px-4 rounded-xl border border-border text-text-muted font-mono text-xs min-h-[44px]"
                    >Back</button>
                  </div>
                </>
              )}

              {error && <p className="font-mono text-xs text-accent-3 mt-3">{error}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
