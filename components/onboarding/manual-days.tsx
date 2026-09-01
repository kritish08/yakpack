'use client'

import { useState } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import type { DraftContact, DraftDay } from '@/lib/import-types'

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

  const index = STEPS.indexOf(step)

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
      let next = ''
      if (lastDated) {
        const t = new Date(lastDated + 'T00:00:00')
        t.setDate(t.getDate() + 1)
        next = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
      }
      return [...d, { date: next, leg: '', place: '', altitude: '' }]
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
            onChange={e => {
              setStartDate(e.target.value)
              // Seed day one, so the days step is not staring at an empty date.
              setDays(d => (d.length > 0 && !d[0].date ? [{ ...d[0], date: e.target.value }, ...d.slice(1)] : d))
            }}
            className={field}
          />

          <button
            onClick={() => setStep('days')}
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
          <p className="font-body text-xs text-text-muted leading-relaxed mb-4">
            As many as you know. Altitude is worth filling in where you know it — it is
            what drives the altitude warnings and the cold-weather packing.
          </p>

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
