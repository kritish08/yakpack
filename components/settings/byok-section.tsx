'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Trash2 } from 'lucide-react'
import { DEFAULT_MODEL, clearKey, getKey, getModel, isRemembered, listModels, setKey } from '@/lib/byok'

const input =
  'w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors'

/** Mask a key for display — never render the whole thing back to the screen. */
function mask(key: string) {
  return key.length <= 12 ? '••••' : `${key.slice(0, 7)}…${key.slice(-4)}`
}

export default function ByokSection({ isAdmin = false }: { isAdmin?: boolean }) {
  const [stored, setStored] = useState<string | null>(null)
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [remember, setRemember] = useState(false)

  const [draft, setDraft] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [state, setState] = useState<'idle' | 'checking' | 'ok' | 'bad'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Storage is browser-only, so this reads after mount rather than during render.
  useEffect(() => {
    setStored(getKey())
    setModel(getModel())
    setRemember(isRemembered())
  }, [])

  async function check() {
    if (!draft.trim()) return
    setState('checking'); setError(null)
    try {
      const ids = await listModels(draft)
      setModels(ids)
      setModel(ids.includes(model) ? model : (ids.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : ids[0] ?? DEFAULT_MODEL))
      setState('ok')
    } catch (e) {
      setState('bad')
      setError(e instanceof Error ? e.message : 'Could not reach OpenAI.')
    }
  }

  function save() {
    setKey(draft, model, remember)
    setStored(getKey())
    setDraft(''); setState('idle'); setModels([])
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function remove() {
    clearKey()
    setStored(null); setModel(DEFAULT_MODEL); setRemember(false)
  }

  return (
    <section>
      <h2 className="font-display font-bold text-sm uppercase tracking-tight text-text mb-1">
        AI guide
      </h2>
      <p className="font-body text-xs text-text-muted leading-relaxed mb-3">
        {isAdmin
          ? 'Your account falls back to this deployment\u2019s server key, so Pemba already works. Add a personal key below only if you want to bill it elsewhere.'
          : 'Pemba runs on your own OpenAI key. It stays in this browser and is sent with each request \u2014 it is never saved to our database.'}
      </p>

      <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3">
        {stored ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs text-text truncate">{mask(stored)}</p>
              <p className="font-mono text-[10px] text-text-dim mt-0.5">
                {model} · {remember ? 'remembered on this device' : 'forgotten when the tab closes'}
              </p>
            </div>
            <button onClick={remove}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-text-muted hover:text-accent-3 hover:border-accent-3/40 transition-colors font-mono text-xs min-h-[44px]">
              <Trash2 size={13} /> Remove
            </button>
          </div>
        ) : (
          <p className="font-mono text-xs text-text-dim">
            {isAdmin ? 'No personal key — using the deployment\u2019s server key.' : 'No key set — Pemba is unavailable.'}
          </p>
        )}

        <div className="flex gap-2">
          <input type="password" value={draft} autoComplete="off"
            onChange={e => { setDraft(e.target.value); setState('idle') }}
            placeholder={stored ? 'Replace key…' : 'sk-…'} className={input}
            aria-label="OpenAI API key" />
          <button onClick={check} disabled={!draft.trim() || state === 'checking'}
            className="shrink-0 px-3 rounded-lg border border-border font-mono text-xs text-text-muted hover:text-text hover:border-accent/40 transition-colors disabled:opacity-40 min-h-[44px]">
            {state === 'checking' ? <Loader2 size={14} className="animate-spin" /> : 'Check'}
          </button>
        </div>

        {state === 'bad' && <p className="text-accent-3 font-mono text-xs">{error}</p>}

        {state === 'ok' && (
          <>
            <p className="text-accent-2 font-mono text-xs flex items-center gap-1.5">
              <Check size={12} /> Key works — {models.length} models available
            </p>
            <select value={model} onChange={e => setModel(e.target.value)} className={input} aria-label="Model">
              {models.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                className="mt-0.5 accent-[var(--accent)]" />
              <span className="font-body text-xs text-text-muted leading-relaxed">
                Remember on this device
              </span>
            </label>
            <button onClick={save}
              className="bg-accent text-bg font-display font-bold uppercase tracking-tight text-xs py-2.5 rounded-xl min-h-[44px]">
              Save key
            </button>
          </>
        )}

        {saved && <p className="text-accent-2 font-mono text-xs">Saved.</p>}
      </div>
    </section>
  )
}
