'use client'

import { useState } from 'react'
import { ArrowLeft, ClipboardPaste, Loader2, MapPin, Plus, Trash2, Wand2 } from 'lucide-react'
import { parseItineraryText } from '@/lib/parse-itinerary'
import type { DraftContact, DraftDay } from '@/lib/import-types'

interface Elevation {
  place: string
  name: string
  country: string | null
  elevation: number | null
  matches: boolean
  /** Resolved to a different country from the rest of the route. */
  offRoute: boolean
}

const btn = 'font-display font-bold uppercase tracking-tight text-sm py-3 rounded-xl min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-40'
const field = 'w-full bg-surface-2 border border-border rounded-xl px-3 py-2.5 text-sm text-text outline-none focus:border-accent transition-colors'
const label = 'font-mono text-[10px] uppercase tracking-wider text-text-muted block mb-1'

type Step = 'name' | 'days' | 'contacts'
const STEPS: Step[] = ['name', 'days', 'contacts']

/**
 * Building a trip by hand, in three small steps.
 *
 * Only the first is required. Days and contacts can both be skipped outright,
 * because the point of this path is to get someone into the app with something
 * real, not to make them fill a form before they are allowed in. Everything here
 * is editable afterwards from Plan and Settings, and the step footer says so.
 *
 * Altitude is typed, not looked up. The geocoder is unreliable for exactly the
 * small mountain settlements where altitude matters most, and someone entering
 * their own trip already knows roughly how high they are sleeping — a typed
 * number beats a confidently wrong one.
 */
export default function ManualDays({
  tripName, onTripName, contacts, onContacts, onBack, onDone,
}: {
  tripName: string
  onTripName: (v: string) => void
  contacts: DraftContact[]
  onContacts: (c: DraftContact[]) => void
  onBack: () => void
  onDone: (days: DraftDay[]) => void
}) {
  const [step, setStep] = useState<Step>('name')
  const [days, setDays] = useState<DraftDay[]>([{ date: '', leg: '', place: '', altitude: '' }])
  const [startDate, setStartDate] = useState('')
  const [dayCount, setDayCount] = useState('')
  const [paste, setPaste] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [elevations, setElevations] = useState<Record<number, Elevation>>({})
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupNote, setLookupNote] = useState<string | null>(null)

  const index = STEPS.indexOf(step)

  /** Local-calendar date arithmetic; toISOString() would shift the day west. */
  function addDays(isoDate: string, n: number): string {
    const t = new Date(isoDate + 'T00:00:00')
    t.setDate(t.getDate() + n)
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  }

  /**
   * Lays out N blank, consecutively dated days.
   *
   * Typing "9" and getting nine dated rows to fill in beats pressing "Add a day"
   * nine times, which was the single most tedious thing about this screen.
   */
  function prefill(n: number, from: string) {
    const count = Math.max(1, Math.min(60, n))
    setDays(Array.from({ length: count }, (_, i) => ({
      date: from ? addDays(from, i) : '',
      leg: '', place: '', altitude: '',
    })))
    setElevations({})
  }

  /**
   * Turns pasted text into rows, with no AI and no key.
   *
   * Most itineraries already arrive shaped as "Day 1 — Delhi to Shimla", so
   * rules get there without a round trip or an API key — and BYOK means no key
   * is the default state of a new account.
   */
  function applyPaste() {
    const year = startDate ? Number(startDate.slice(0, 4)) : undefined
    const parsed = parseItineraryText(paste, year)
    if (parsed.length === 0) { setLookupNote('Nothing that looked like days — try one line per day.'); return }

    setDays(parsed.map((d, i) => ({
      // A source with no dates still gets them, counted from the trip's start.
      date: d.date ?? (startDate ? addDays(startDate, i) : ''),
      leg: d.leg,
      place: d.place ?? '',
      altitude: d.altitude != null ? String(d.altitude) : '',
    })))
    setElevations({})
    setPasteOpen(false)
    setPaste('')
    setLookupNote(`Read ${parsed.length} day${parsed.length === 1 ? '' : 's'}. Check them below.`)
  }

  /**
   * Proposes an elevation per day from its place name. Never applies one.
   *
   * Open-Meteo resolves "Kaza" to Kazan' in Russia at 61 m against a true
   * 3,800 m, and altitude is what the AMS warnings run on — so each suggestion
   * is shown with the name and country it actually resolved to, and has to be
   * accepted. A doubtful match is offered, not taken.
   */
  async function lookupAltitudes() {
    // Only rows with no altitude yet. The lookup exists to fill gaps, not to
    // second-guess a number the source actually stated: the itinerary said
    // Chitkul is 3,450 m and the geocoder says 529 m, and the itinerary is
    // right. Offering to overwrite it is offering to make the trip wrong.
    const targets = days.map(d => (d.altitude.trim() ? '' : (d.place || d.leg).trim()))
    if (targets.every(t => !t)) {
      setLookupNote(days.every(d => d.altitude.trim())
        ? 'Every day already has an altitude.'
        : 'Add a place or a route first.')
      return
    }
    setLookingUp(true); setLookupNote(null)
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ places: targets }),
      })
      const json = await res.json()
      if (!res.ok) { setLookupNote(json?.error ?? 'Could not look those up.'); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = (json.suggestions as any[])

      // A matching name is a weaker signal than it looks: "Tabo" resolves to
      // Tabo in Ivory Coast and "Manali" to a Manali at 6 m, both with the name
      // matching exactly. A trip almost never crosses continents day to day, so
      // the country the rest of the route agrees on is a far better check —
      // whichever country most days landed in becomes the expectation, and the
      // outliers are called out.
      const tally = new Map<string, number>()
      for (const sg of raw) {
        if (sg?.country) tally.set(sg.country, (tally.get(sg.country) ?? 0) + 1)
      }
      const mainCountry = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

      const next: Record<number, Elevation> = {}
      raw.forEach((sg, i) => {
        if (sg && sg.elevation != null) {
          next[i] = {
            place: targets[i],
            name: sg.name,
            country: sg.country,
            elevation: sg.elevation,
            matches: !!sg.nameMatches,
            offRoute: Boolean(mainCountry && sg.country && sg.country !== mainCountry),
          }
        }
      })
      setElevations(next)
      const asked = targets.filter(Boolean).length
      const n = Object.keys(next).length
      setLookupNote(n === 0
        ? 'No elevations found for those places — type them instead.'
        : `Found ${n} of the ${asked} day${asked === 1 ? '' : 's'} still missing one. Tap the ones that look right.`)
    } catch {
      setLookupNote('Could not reach the lookup.')
    } finally {
      setLookingUp(false)
    }
  }

  function acceptElevation(i: number) {
    const e = elevations[i]
    if (!e) return
    setDay(i, { altitude: String(e.elevation) })
    setElevations(prev => { const n = { ...prev }; delete n[i]; return n })
  }

  function setDay(i: number, patch: Partial<DraftDay>) {
    setDays(d => d.map((row, n) => (n === i ? { ...row, ...patch } : row)))
  }

  /**
   * Adds a day, dating it the day after the last one that has a date.
   *
   * Formatted from the local date parts rather than through toISOString().
   * `new Date('2027-05-14T00:00:00')` is local midnight, and toISOString()
   * converts that to UTC — east of Greenwich it lands on the previous day, so
   * every added day came out with the date of the one before it. Only visible
   * in a non-UTC timezone, which is why it survived the unit tests.
   */
  function addDay() {
    setDays(d => {
      const lastDated = [...d].reverse().find(x => x.date)?.date
      return [...d, { date: lastDated ? addDays(lastDated, 1) : '', leg: '', place: '', altitude: '' }]
    })
  }

  function finish(withDays: DraftDay[]) {
    onDone(withDays.filter(d => d.leg.trim() !== ''))
  }

  return (
    <>
      <button
        onClick={() => (index === 0 ? onBack() : setStep(STEPS[index - 1]))}
        className="flex items-center gap-1.5 font-mono text-xs text-text-muted min-h-[44px]"
      >
        <ArrowLeft size={13} aria-hidden="true" /> Back
      </button>

      <div className="flex gap-1.5 mb-4" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span key={s} className={`h-1 flex-1 rounded-full ${i <= index ? 'bg-accent' : 'bg-border'}`} />
        ))}
      </div>

      {step === 'name' && (
        <>
          <h2 className="font-display font-bold text-sm uppercase tracking-tight text-text mb-1">Where are you going?</h2>
          <p className="font-body text-xs text-text-muted leading-relaxed mb-4">
            Only the name is needed. Everything else can wait.
          </p>

          <label className={label} htmlFor="yak-trip-name">Trip name</label>
          <input
            id="yak-trip-name"
            value={tripName}
            onChange={e => onTripName(e.target.value)}
            placeholder="Ladakh in May"
            maxLength={80}
            autoFocus
            className={`${field} mb-3`}
          />

          <label className={label} htmlFor="yak-start">Start date (optional)</label>
          <input
            id="yak-start"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className={field}
          />

          <label className={`${label} mt-3`} htmlFor="yak-daycount">How many days? (optional)</label>
          <input
            id="yak-daycount"
            type="number" inputMode="numeric" min={1} max={60}
            value={dayCount}
            onChange={e => setDayCount(e.target.value)}
            placeholder="9"
            className={field}
          />
          <p className="font-mono text-[10px] text-text-dim mt-1 leading-relaxed">
            Lays out that many dated rows to fill in. You can still add or remove days after.
          </p>

          <button
            onClick={() => {
              const n = parseInt(dayCount, 10)
              if (Number.isFinite(n) && n > 0) prefill(n, startDate)
              else if (startDate) setDays(d => (d.length > 0 && !d[0].date ? [{ ...d[0], date: startDate }, ...d.slice(1)] : d))
              setStep('days')
            }}
            disabled={tripName.trim().length === 0}
            className={`${btn} w-full bg-accent text-bg mt-5`}
          >
            Next
          </button>
        </>
      )}

      {step === 'days' && (
        <>
          <h2 className="font-display font-bold text-sm uppercase tracking-tight text-text mb-1">The days</h2>
          <p className="font-body text-xs text-text-muted leading-relaxed mb-3">
            Paste an itinerary and it will be read for you, or fill the rows in yourself.
            Altitude matters most — it drives the altitude warnings and the cold-weather packing.
          </p>

          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => setPasteOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 rounded-lg border border-border text-text-muted hover:text-text hover:border-accent/40 transition-colors font-mono text-[11px] min-h-[40px]"
            >
              <ClipboardPaste size={13} aria-hidden="true" /> Paste an itinerary
            </button>
            <button
              onClick={lookupAltitudes}
              disabled={lookingUp}
              className="flex items-center gap-1.5 px-3 rounded-lg border border-border text-text-muted hover:text-text hover:border-accent/40 transition-colors font-mono text-[11px] min-h-[40px] disabled:opacity-40"
            >
              {lookingUp
                ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Looking up…</>
                : <><Wand2 size={13} aria-hidden="true" /> Look up altitudes</>}
            </button>
          </div>

          {pasteOpen && (
            <div className="mb-4">
              <textarea
                value={paste}
                onChange={e => setPaste(e.target.value)}
                rows={7}
                aria-label="Paste your itinerary"
                placeholder={'Day 1 — Delhi to Shimla, overnight bus\nDay 2 — Shimla to Chitkul (3,450 m)\nDay 3 — Chitkul to Tabo via Nako, 3280 m'}
                className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2.5 text-sm text-text font-body outline-none focus:border-accent transition-colors resize-y"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={applyPaste} disabled={paste.trim().length < 8} className={`${btn} flex-1 bg-accent text-bg`}>
                  Read it
                </button>
                <button onClick={() => { setPasteOpen(false); setPaste('') }} className="px-4 rounded-xl border border-border text-text-muted font-mono text-xs min-h-[44px]">
                  Cancel
                </button>
              </div>
              <p className="font-mono text-[10px] text-text-dim mt-2 leading-relaxed">
                Read here on your device — no AI key needed. Dates and altitudes are picked
                up when they are written down, and left blank when they are not.
              </p>
            </div>
          )}

          {lookupNote && <p className="font-mono text-[11px] text-accent mb-3 leading-relaxed">{lookupNote}</p>}

          <ol className="flex flex-col gap-3">
            {days.map((d, i) => (
              <li key={i} className="border border-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[11px] text-accent">Day {i + 1}</span>
                  {days.length > 1 && (
                    <button
                      onClick={() => setDays(rows => rows.filter((_, n) => n !== i))}
                      aria-label={`Remove day ${i + 1}`}
                      className="p-1.5 text-text-dim hover:text-accent-3 min-h-[36px] min-w-[36px] flex items-center justify-center"
                    ><Trash2 size={13} /></button>
                  )}
                </div>
                <input
                  value={d.leg}
                  onChange={e => setDay(i, { leg: e.target.value })}
                  placeholder="Leh to Nubra via Khardung La"
                  aria-label={`Day ${i + 1} route`}
                  maxLength={300}
                  className={`${field} mb-2`}
                />
                <div className="flex gap-2">
                  <input
                    type="date" value={d.date} onChange={e => setDay(i, { date: e.target.value })}
                    aria-label={`Day ${i + 1} date`} className={field}
                  />
                  <input
                    type="number" inputMode="numeric" value={d.altitude}
                    onChange={e => setDay(i, { altitude: e.target.value })}
                    placeholder="Altitude m" aria-label={`Day ${i + 1} altitude in metres`}
                    min={-500} max={9000} className={field}
                  />
                </div>

                {elevations[i] && (
                  <button
                    onClick={() => acceptElevation(i)}
                    className="mt-2 w-full text-left flex items-start gap-2 rounded-lg border border-border/60 hover:border-accent/50 transition-colors px-2.5 py-2"
                  >
                    <MapPin size={11} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                    <span className="font-mono text-[11px] leading-relaxed">
                      <span className={elevations[i].matches && !elevations[i].offRoute ? 'text-text-muted' : 'text-accent-3'}>
                        {elevations[i].place} → {elevations[i].name}
                        {elevations[i].country ? `, ${elevations[i].country}` : ''}
                      </span>
                      <span className="block text-text-dim">
                        {elevations[i].elevation?.toLocaleString()} m · tap to use
                        {elevations[i].offRoute
                          ? ' — different country from the rest of your route'
                          : elevations[i].matches ? '' : ' — name did not match, check it'}
                      </span>
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ol>

          <button onClick={addDay} className="flex items-center gap-1.5 font-mono text-[11px] text-accent min-h-[44px] mt-2">
            <Plus size={14} aria-hidden="true" /> Add a day
          </button>

          <div className="flex gap-2 mt-3">
            <button onClick={() => setStep('contacts')} className={`${btn} flex-1 bg-accent text-bg`}>Next</button>
            <button
              onClick={() => setStep('contacts')}
              className="px-4 rounded-xl border border-border text-text-muted font-mono text-xs min-h-[44px]"
            >Skip</button>
          </div>
        </>
      )}

      {step === 'contacts' && (
        <>
          <h2 className="font-display font-bold text-sm uppercase tracking-tight text-text mb-1">Anyone to ring?</h2>
          <p className="font-body text-xs text-text-muted leading-relaxed mb-4">
            An operator, a driver, tonight&rsquo;s homestay. They show on your Plan screen
            as tap-to-dial, and they work offline. You can add these any time from Settings.
          </p>

          <ul className="flex flex-col gap-3">
            {contacts.map((c, i) => (
              <li key={i} className="border border-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[11px] text-accent">Contact {i + 1}</span>
                  <button
                    onClick={() => onContacts(contacts.filter((_, n) => n !== i))}
                    aria-label={`Remove contact ${i + 1}`}
                    className="p-1.5 text-text-dim hover:text-accent-3 min-h-[36px] min-w-[36px] flex items-center justify-center"
                  ><Trash2 size={13} /></button>
                </div>
                <input
                  value={c.role}
                  onChange={e => onContacts(contacts.map((x, n) => (n === i ? { ...x, role: e.target.value } : x)))}
                  placeholder="Role — driver, homestay, operator"
                  aria-label={`Contact ${i + 1} role`} maxLength={60} className={`${field} mb-2`}
                />
                <div className="flex gap-2">
                  <input
                    value={c.name}
                    onChange={e => onContacts(contacts.map((x, n) => (n === i ? { ...x, name: e.target.value } : x)))}
                    placeholder="Name" aria-label={`Contact ${i + 1} name`} maxLength={80} className={field}
                  />
                  <input
                    value={c.phone} inputMode="tel"
                    onChange={e => onContacts(contacts.map((x, n) => (n === i ? { ...x, phone: e.target.value } : x)))}
                    placeholder="Phone" aria-label={`Contact ${i + 1} phone`} maxLength={40} className={field}
                  />
                </div>
              </li>
            ))}
          </ul>

          <button
            onClick={() => onContacts([...contacts, { role: '', name: '', phone: '' }])}
            className="flex items-center gap-1.5 font-mono text-[11px] text-accent min-h-[44px] mt-2"
          >
            <Plus size={14} aria-hidden="true" /> Add a contact
          </button>

          <button onClick={() => finish(days)} className={`${btn} w-full bg-accent text-bg mt-3`}>
            Next — the packing list
          </button>
        </>
      )}
    </>
  )
}
