'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Check, FileText, Link2, Loader2, PencilLine, Upload,
} from 'lucide-react'
import { byokHeaders, getKey } from '@/lib/byok'
import { extractPdfText, PdfError, MAX_PDF_BYTES } from '@/lib/pdf'
import { baseList, factsFromDays, sortItems } from '@/lib/packing-rules'
import { hasDayMarkers, parseItineraryText } from '@/lib/parse-itinerary'
import { createTripFromOnboarding } from '@/app/actions/onboarding'
import type { DraftContact, DraftDay, ParsedDay, ProposedItem } from '@/lib/import-types'
import DayReview from './day-review'
import PackingReview from './packing-review'
import ManualDays from './manual-days'

type Stage = 'choose' | 'pdf' | 'url' | 'manual' | 'days' | 'packing'

const btn = 'font-display font-bold uppercase tracking-tight text-sm py-3 rounded-xl min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-40'
const field = 'w-full bg-surface-2 border border-border rounded-xl px-3 py-2.5 text-sm text-text outline-none focus:border-accent transition-colors'

/**
 * Creating a trip, three ways in and one way through.
 *
 * PDF, link and manual all converge on the same two review screens — the days,
 * then the packing list — because the risky part of an import is never the
 * intake, it is trusting what came out. One review path means one place where
 * that trust is granted, and the manual path gets the same altitude-aware
 * packing list as an imported one for free.
 *
 * Nothing is written until the last step. A flow abandoned halfway leaves no
 * half-built trip behind.
 */
export default function NewTripFlow({ aiEnabled, isFirstTrip }: { aiEnabled: boolean; isFirstTrip: boolean }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [stage, setStage] = useState<Stage>('choose')
  const [tripName, setTripName] = useState('')
  const [days, setDays] = useState<ParsedDay[]>([])
  const [gaps, setGaps] = useState<string[]>([])
  const [accepted, setAccepted] = useState<Record<number, boolean>>({})
  const [contacts, setContacts] = useState<DraftContact[]>([])

  const [items, setItems] = useState<ProposedItem[]>([])
  const [chosen, setChosen] = useState<Record<string, boolean>>({})
  const [curated, setCurated] = useState(false)
  const [restored, setRestored] = useState<string[]>([])
  const [dropped, setDropped] = useState<string[]>([])

  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const hasKey = useMemo(() => aiEnabled && typeof window !== 'undefined' && Boolean(getKey()), [aiEnabled])

  /* ── Intake ─────────────────────────────────────────────────────────────── */

  /** Turns parsed days into the review screen, once locations are resolved. */
  function present(parsed: ParsedDay[], gapList: string[], name?: string) {
    setDays(parsed)
    setGaps(gapList)
    setTripName(prev => prev || name || '')
    // Confident matches start ticked; anything doubtful stays off, so the
    // default outcome is "no data" rather than "wrong data".
    setAccepted(Object.fromEntries(parsed.map(d => [d.day, Boolean(d.suggestion?.nameMatches)])))
    setStage('days')
  }

  /**
   * Reads an itinerary with rules alone — no model, no key, no cost.
   *
   * Only when the source is explicitly numbered by day, which is how operators,
   * blogs and confirmation emails actually write them. That covers the common
   * case, and it matters more than it looks: keys are BYOK, so "no key" is the
   * default state of every new account. An importer that cannot run until the
   * user has been to another company's website and pasted a credential is an
   * importer most people never see.
   *
   * Locations still resolve through /api/geocode, which is route-aware and also
   * needs no key. Returns false when the text is not day-shaped, so the caller
   * can fall back to the model.
   */
  async function structureWithRules(text: string, fallbackName?: string): Promise<boolean> {
    if (!hasDayMarkers(text)) return false
    const rows = parseItineraryText(text)
    if (rows.length < 2) return false

    let suggestions: (ParsedDay['suggestion'])[] = rows.map(() => null)
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ places: rows.map(r => r.place) }),
      })
      if (res.ok) {
        const json = await res.json()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        suggestions = (json.suggestions as any[]).map((sg, i) =>
          sg && sg.elevation != null
            ? { query: rows[i].place ?? '', name: sg.name, country: sg.country, admin: sg.admin,
                lat: sg.lat, lon: sg.lon, elevation: sg.elevation,
                // Off-route means the geocoder found *a* place, not *the* place;
                // it must never arrive pre-ticked.
                nameMatches: Boolean(sg.nameMatches) && sg.distanceKm <= 400 }
            : null)
      }
    } catch {
      // A failed lookup is not a failed import — the days are still good, they
      // simply arrive without coordinates.
    }

    const gapList: string[] = []
    const parsed: ParsedDay[] = rows.map((r, i) => {
      const sg = suggestions[i]
      if (!r.place) gapList.push(`Day ${r.day}: no place named — no weather or altitude.`)
      else if (!sg) gapList.push(`Day ${r.day}: couldn't find “${r.place}”.`)
      else if (!sg.nameMatches) gapList.push(`Day ${r.day}: “${r.place}” best matched “${sg.name}${sg.country ? ', ' + sg.country : ''}” — check before accepting.`)
      if (!r.date) gapList.push(`Day ${r.day}: no date, so it won't line up with “today”.`)

      return {
        day: r.day, date: r.date, leg: r.leg, place: r.place,
        highlights: null, warnings: null, network: null,
        // An altitude written in the source outranks anything looked up.
        lat: null, lon: null, altitude_m: r.altitude,
        suggestion: sg,
      }
    })

    present(parsed, gapList, fallbackName)
    return true
  }

  /** Text from any source → structured days → the review screen. */
  async function structure(text: string, fallbackName?: string) {
    setBusy('Reading the itinerary…')
    try {
      // Rules first: free, instant, and right for anything already written as a
      // day-by-day. The model is the fallback for prose, not the default.
      if (await structureWithRules(text, fallbackName)) return

      if (!hasKey) {
        setError(
          'That source is not written as a numbered day-by-day, so it needs Pemba to read it — ' +
          'add your OpenAI key in Settings. Or build the trip yourself and paste the days in, which needs no key.',
        )
        return
      }

      const res = await fetch('/api/ai/import-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...byokHeaders() },
        body: JSON.stringify({ text }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json?.error ?? 'Could not read that itinerary.'); return }

      present(json.days as ParsedDay[], json.gaps ?? [], json.tripName || fallbackName)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(null)
    }
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setBusy('Reading the PDF…')
    try {
      const out = await extractPdfText(file)
      if (out.looksScanned) {
        setError('That PDF looks like a scan — there is no text in it to read. Copy the itinerary out and use the manual option, or try a different file.')
        return
      }
      await structure(out.text, file.name.replace(/\.pdf$/i, ''))
    } catch (e) {
      setError(e instanceof PdfError ? e.message : 'That PDF could not be read.')
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onFetchUrl() {
    setError(null)
    setBusy('Fetching the page…')
    try {
      const res = await fetch('/api/import/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json?.error ?? 'That page could not be read.'); return }
      await structure(json.text, json.title ?? undefined)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(null)
    }
  }

  /* ── Packing ────────────────────────────────────────────────────────────── */

  /**
   * Applies the accepted geocoder suggestions, giving the days their real numbers.
   *
   * Falls back to what the day already holds rather than to null. On the manual
   * path there is never a suggestion — the traveller typed the altitude
   * themselves — and overwriting that with null threw away the one number the
   * AMS warnings and the cold-weather packing rules actually run on.
   */
  function resolvedDays() {
    return days.map(d => {
      const use = accepted[d.day] && d.suggestion
      return {
        ...d,
        lat: use ? d.suggestion!.lat : d.lat,
        lon: use ? d.suggestion!.lon : d.lon,
        altitude_m: use ? d.suggestion!.elevation : d.altitude_m,
      }
    })
  }

  async function buildPackingList(fromDays: ReturnType<typeof resolvedDays>) {
    setError(null)

    // The rule-derived list always exists. It is what a traveller with no key
    // gets, and what Pemba starts from when there is one.
    const floor = sortItems(baseList(factsFromDays(fromDays)))
    const apply = (list: ProposedItem[], isCurated: boolean) => {
      setItems(list)
      setChosen(Object.fromEntries(list.map(i => [`${i.category}::${i.name}`, true])))
      setCurated(isCurated)
      setStage('packing')
    }

    if (!hasKey) { apply(floor, false); return }

    setBusy('Pemba is building your list…')
    try {
      const res = await fetch('/api/ai/suggest-packing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...byokHeaders() },
        body: JSON.stringify({ tripName, days: fromDays }),
      })
      const json = await res.json()
      if (!res.ok) {
        // A curation failure is not a dead end — the floor is a complete list.
        setError('Pemba could not build a list just now, so this is the rule-based one.')
        apply(floor, false)
        return
      }
      setRestored(json.restored ?? [])
      setDropped(json.dropped ?? [])
      apply(json.items as ProposedItem[], true)
    } catch {
      setError('Could not reach Pemba, so this is the rule-based list.')
      apply(floor, false)
    } finally {
      setBusy(null)
    }
  }

  /* ── Save ───────────────────────────────────────────────────────────────── */

  function save() {
    setError(null)
    const finalDays = resolvedDays()
    const finalItems = items.filter(i => chosen[`${i.category}::${i.name}`])

    startTransition(async () => {
      try {
        await createTripFromOnboarding({
          name: tripName.trim() || 'My trip',
          days: finalDays.map(d => ({
            day: d.day, date: d.date, leg: d.leg,
            lat: d.lat, lon: d.lon, altitude_m: d.altitude_m,
            highlights: d.highlights, warnings: d.warnings, network: d.network,
          })),
          items: finalItems.map(i => ({
            category: i.category, name: i.name, note: i.note ?? null,
            scope: i.scope, status: i.status,
          })),
          contacts: contacts.map(c => ({ role: c.role, name: c.name, phone: c.phone })),
        })
        router.push('/app')
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not create the trip.')
      }
    })
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */

  const busyBar = busy && (
    <p className="font-mono text-xs text-text-muted flex items-center gap-2 mt-3">
      <Loader2 size={13} className="animate-spin" aria-hidden="true" /> {busy}
    </p>
  )
  const errorBar = error && <p className="font-mono text-xs text-accent-3 mt-3 leading-relaxed">{error}</p>

  function back(to: Stage) {
    return (
      <button onClick={() => { setStage(to); setError(null) }} className="flex items-center gap-1.5 font-mono text-xs text-text-muted min-h-[44px]">
        <ArrowLeft size={13} aria-hidden="true" /> Back
      </button>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <h1 className="font-display font-bold text-2xl uppercase tracking-tight text-text leading-none">
        {isFirstTrip ? 'Your first trip' : 'New trip'}
      </h1>

      {/* ── Choose how to start ── */}
      {stage === 'choose' && (
        <>
          <p className="font-body text-sm text-text-muted leading-relaxed mt-2 mb-5">
            Start from what you already have. Anything missing you can fill in later —
            nothing here has to be finished now.
          </p>

          <div className="flex flex-col gap-3">
            <Choice
              icon={<FileText size={18} aria-hidden="true" />}
              title="Upload a PDF"
              body="An operator's itinerary or a booking confirmation. Read on your device — the file itself never leaves it. Up to 20 MB."
              onClick={() => { setStage('pdf'); setError(null) }}
            />
            <Choice
              icon={<Link2 size={18} aria-hidden="true" />}
              title="Paste a link"
              body="A public itinerary page. We read the text off it and show you what we understood."
              onClick={() => { setStage('url'); setError(null) }}
            />
            <Choice
              icon={<PencilLine size={18} aria-hidden="true" />}
              title="Build it myself"
              body="Name the trip, add days as you know them, and carry on inside the app."
              onClick={() => { setStage('manual'); setError(null) }}
            />
          </div>

          <p className="font-mono text-[11px] text-text-dim mt-4 leading-relaxed">
            Anything written as a numbered day-by-day is read here on your device — no
            account with anyone else, no key, no cost.
            {aiEnabled && !hasKey && ' For a brochure written as prose, add your OpenAI key in Settings and Pemba will read that too.'}
          </p>
        </>
      )}

      {/* ── PDF ── */}
      {stage === 'pdf' && (
        <>
          {back('choose')}
          <p className="font-body text-sm text-text-muted leading-relaxed mb-4">
            Pick the PDF. It is opened here in your browser — only the text you go on to
            accept is ever sent anywhere.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={e => onPickFile(e.target.files?.[0])}
            className="hidden"
            id="yak-pdf"
          />
          <label htmlFor="yak-pdf" className={`${btn} w-full bg-accent text-bg cursor-pointer`}>
            <Upload size={15} aria-hidden="true" /> Choose a PDF
          </label>
          <p className="font-mono text-[11px] text-text-dim mt-2">
            Up to {Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB. A numbered day-by-day is read
            without any key. Scanned brochures have no text in them at all — those need the
            manual route.
          </p>
          {busyBar}{errorBar}
        </>
      )}

      {/* ── URL ── */}
      {stage === 'url' && (
        <>
          {back('choose')}
          <p className="font-body text-sm text-text-muted leading-relaxed mb-4">
            Paste the link to a public itinerary page.
          </p>
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://…"
            aria-label="Itinerary link"
            className={field}
          />
          <button onClick={onFetchUrl} disabled={Boolean(busy) || url.trim().length < 8} className={`${btn} w-full bg-accent text-bg mt-3`}>
            Read the page
          </button>
          <p className="font-mono text-[11px] text-text-dim mt-2 leading-relaxed">
            Public https pages only. If the itinerary loads with JavaScript there may be
            nothing to read — copy the text out and build it manually instead.
          </p>
          {busyBar}{errorBar}
        </>
      )}

      {/* ── Manual ── */}
      {stage === 'manual' && (
        <ManualDays
          tripName={tripName}
          onTripName={setTripName}
          contacts={contacts}
          onContacts={setContacts}
          onBack={() => setStage('choose')}
          onDone={(draft: DraftDay[]) => {
            const asDays: ParsedDay[] = draft.map((d, i) => ({
              day: i + 1,
              date: d.date || null,
              leg: d.leg,
              place: d.place || null,
              highlights: null, warnings: null, network: null,
              lat: null, lon: null, altitude_m: d.altitude === '' ? null : Number(d.altitude),
              suggestion: null,
            }))
            setDays(asDays)
            setAccepted({})
            buildPackingList(asDays.map(d => ({ ...d })))
          }}
        />
      )}

      {/* ── Review the days ── */}
      {stage === 'days' && (
        <>
          {back('choose')}
          <label className="font-mono text-[10px] uppercase tracking-wider text-text-muted block mb-1">Trip name</label>
          <input value={tripName} onChange={e => setTripName(e.target.value)} maxLength={80} className={`${field} mb-4`} aria-label="Trip name" />

          <h2 className="font-display font-bold text-sm uppercase tracking-tight text-text mb-2">What we understood</h2>
          <DayReview
            days={days}
            gaps={gaps}
            accepted={accepted}
            onToggle={(day, on) => setAccepted(a => ({ ...a, [day]: on }))}
          />
          <button
            onClick={() => buildPackingList(resolvedDays())}
            disabled={Boolean(busy) || days.length === 0}
            className={`${btn} w-full bg-accent text-bg mt-4`}
          >
            Next — the packing list
          </button>
          {busyBar}{errorBar}
        </>
      )}

      {/* ── Review the packing list ── */}
      {stage === 'packing' && (
        <>
          {back(days.length > 0 && gaps.length + Object.keys(accepted).length > 0 ? 'days' : 'manual')}
          <h2 className="font-display font-bold text-sm uppercase tracking-tight text-text mb-2">Your packing list</h2>
          <PackingReview
            items={items}
            curated={curated}
            restored={restored}
            dropped={dropped}
            chosen={chosen}
            onToggle={(k, on) => setChosen(c => ({ ...c, [k]: on }))}
            onToggleCategory={(cat, on) =>
              setChosen(c => {
                const next = { ...c }
                for (const i of items) if (i.category === cat) next[`${i.category}::${i.name}`] = on
                return next
              })
            }
          />
          <button onClick={save} disabled={pending} className={`${btn} w-full bg-accent text-bg mt-5`}>
            {pending
              ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Creating…</>
              : <><Check size={15} aria-hidden="true" /> Create the trip</>}
          </button>
          {errorBar}
        </>
      )}
    </div>
  )
}

function Choice({ icon, title, body, onClick }: { icon: React.ReactNode; title: string; body: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-surface border border-border rounded-2xl p-4 hover:border-accent/40 transition-colors flex gap-3"
    >
      <span className="text-accent shrink-0 mt-0.5">{icon}</span>
      <span className="min-w-0">
        <span className="font-display font-bold text-sm uppercase tracking-tight text-text block">{title}</span>
        <span className="font-body text-xs text-text-muted leading-relaxed block mt-1">{body}</span>
      </span>
    </button>
  )
}
