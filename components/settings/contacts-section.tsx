'use client'

import { useEffect, useState, useTransition } from 'react'
import { Phone, Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react'
import { listContacts, addContact, updateContact, deleteContact } from '@/app/actions/contacts'
import type { TripContact } from '@/lib/database.types'

/**
 * Roles worth suggesting, not a fixed set.
 *
 * They come from what a trip pack actually hands you — an operator's two names,
 * the driver you get on day one, the homestay you booked, the insurer you hope
 * never to ring. The field stays free text: this is a shortcut, not a schema.
 */
const ROLE_SUGGESTIONS = [
  'Trip coordinator',
  'Trip leader',
  'Driver',
  'Homestay / hotel',
  'Emergency',
  'Insurance',
  'Permit office',
]

interface Draft { role: string; name: string; phone: string; note: string }

const EMPTY: Draft = { role: '', name: '', phone: '', note: '' }

const inputClass =
  'w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors'

function ContactForm({
  initial, submitLabel, pending, onSubmit, onCancel,
}: {
  initial: Draft
  submitLabel: string
  pending: boolean
  onSubmit: (d: Draft) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<Draft>(initial)
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft(d => ({ ...d, [k]: e.target.value }))

  const valid = draft.role.trim() && (draft.name.trim() || draft.phone.trim())

  return (
    <div className="flex flex-col gap-2">
      <input
        value={draft.role} onChange={set('role')}
        list="yak-contact-roles" placeholder="Role — driver, homestay, insurance"
        aria-label="Contact role" maxLength={60} className={inputClass}
      />
      <datalist id="yak-contact-roles">
        {ROLE_SUGGESTIONS.map(r => <option key={r} value={r} />)}
      </datalist>
      <div className="flex gap-2">
        <input
          value={draft.name} onChange={set('name')} placeholder="Name"
          aria-label="Contact name" maxLength={80} className={inputClass}
        />
        <input
          value={draft.phone} onChange={set('phone')} placeholder="Phone"
          aria-label="Contact phone" inputMode="tel" maxLength={40} className={inputClass}
        />
      </div>
      <input
        value={draft.note} onChange={set('note')} placeholder="Note (optional)"
        aria-label="Contact note" maxLength={160} className={inputClass}
      />
      <div className="flex gap-2">
        <button
          disabled={pending || !valid}
          onClick={() => onSubmit(draft)}
          className="flex items-center gap-1.5 px-3 rounded-lg bg-accent text-bg font-display font-bold text-xs uppercase disabled:opacity-40 min-h-[44px]"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 rounded-lg border border-border text-text-muted font-mono text-xs min-h-[44px]"
        >
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  )
}

/**
 * The trip's contact list.
 *
 * Any number of rows, each labelled with its own role, rather than the fixed
 * coordinator/leader pair the app started with — that pair was one operator's
 * org chart, and every trip since has needed a different set.
 */
export default function ContactsSection({ isOrganiser }: { isOrganiser: boolean }) {
  const [contacts, setContacts] = useState<TripContact[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    listContacts().then(setContacts).catch(e => setError(e.message))
  }, [])

  function run(fn: () => Promise<unknown>, done?: () => void) {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
        setContacts(await listContacts())
        done?.()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.')
      }
    })
  }

  return (
    <section>
      <h2 className="font-display font-bold text-sm uppercase tracking-tight text-text mb-1">
        Contacts
      </h2>
      <p className="font-body text-xs text-text-muted leading-relaxed mb-3">
        Whoever is worth ringing from the road — the operator, your driver, tonight&rsquo;s
        homestay. They show on the Plan screen as tap-to-dial, and they come with you
        offline.
      </p>

      <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3">
        {!contacts && !error && <p className="font-mono text-xs text-text-dim">Loading…</p>}

        {contacts?.length === 0 && !adding && (
          <p className="font-mono text-[11px] text-text-dim">
            No contacts yet.
          </p>
        )}

        {contacts?.map((c, i) => (
          <div key={c.id} className={i > 0 ? 'border-t border-border/50 pt-3' : ''}>
            {editingId === c.id ? (
              <ContactForm
                initial={{ role: c.role, name: c.name ?? '', phone: c.phone ?? '', note: c.note ?? '' }}
                submitLabel="Save"
                pending={pending}
                onSubmit={d => run(
                  () => updateContact(c.id, d),
                  () => setEditingId(null),
                )}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-body text-sm text-text truncate">{c.name || c.role}</p>
                  <p className="font-mono text-[10px] text-text-dim truncate">
                    {c.name ? c.role : ''}{c.name && c.note ? ' · ' : ''}{c.note ?? ''}
                  </p>
                  {c.phone && (
                    <a
                      href={`tel:${c.phone.replace(/\s+/g, '')}`}
                      className="font-mono text-xs text-accent inline-flex items-center gap-1 mt-0.5"
                    >
                      <Phone size={11} aria-hidden="true" /> {c.phone}
                    </a>
                  )}
                </div>
                {isOrganiser && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setAdding(false); setEditingId(c.id) }}
                      aria-label={`Edit ${c.name || c.role}`}
                      className="p-2 text-text-dim hover:text-accent transition-colors min-h-[44px] min-w-[36px] flex items-center justify-center"
                    ><Pencil size={14} /></button>
                    <button
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm(`Remove ${c.name || c.role} from this trip's contacts?`)) {
                          run(() => deleteContact(c.id))
                        }
                      }}
                      aria-label={`Remove ${c.name || c.role}`}
                      className="p-2 text-text-dim hover:text-accent-3 transition-colors min-h-[44px] min-w-[36px] flex items-center justify-center"
                    ><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {isOrganiser && (adding ? (
          <div className="border-t border-border/50 pt-3">
            <ContactForm
              initial={EMPTY}
              submitLabel="Add"
              pending={pending}
              onSubmit={d => run(() => addContact(d), () => setAdding(false))}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <button
            onClick={() => { setEditingId(null); setAdding(true) }}
            className="flex items-center gap-1.5 self-start font-mono text-[11px] text-accent min-h-[44px]"
          >
            <Plus size={14} /> Add a contact
          </button>
        ))}

        {contacts && !isOrganiser && (
          <p className="font-mono text-[11px] text-text-dim border-t border-border/50 pt-3">
            Only the organiser can edit trip contacts.
          </p>
        )}

        {error && <p className="font-mono text-xs text-accent-3">{error}</p>}
      </div>
    </section>
  )
}
