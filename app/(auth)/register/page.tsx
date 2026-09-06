'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { safeNext, DEFAULT_NEXT } from '@/lib/safe-next'
import { DEFAULT_MODEL, listModels, setKey } from '@/lib/byok'

const input =
  'w-full bg-surface-2 border border-border rounded-lg px-4 py-3 text-text font-body text-sm placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors'
const label = 'text-xs font-mono text-text-muted uppercase tracking-wider'

function RegisterPageForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Validated rather than trusted: an unchecked `next` is an open redirect.
  const destination = safeNext(searchParams.get('next'))
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [tripName, setTripName] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // BYOK — entirely optional; the app works without it.
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [models, setModels] = useState<string[]>([])
  const [remember, setRemember] = useState(false)
  const [keyState, setKeyState] = useState<'idle' | 'checking' | 'ok' | 'bad'>('idle')
  const [keyError, setKeyError] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmSent, setConfirmSent] = useState(false)

  async function verifyKey() {
    if (!apiKey.trim()) return
    setKeyState('checking')
    setKeyError(null)
    try {
      const ids = await listModels(apiKey)
      setModels(ids)
      setModel(ids.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : (ids[0] ?? DEFAULT_MODEL))
      setKeyState('ok')
    } catch (e) {
      setKeyState('bad')
      setKeyError(e instanceof Error ? e.message : 'Could not reach OpenAI.')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    let data
    try {
      const res = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName.trim() || email.split('@')[0] } },
      })
      if (res.error) {
        setError(res.error.message)
        setLoading(false)
        return
      }
      data = res.data
    } catch {
      // signUp rejects when the network is unreachable, not just on a bad request.
      setError('Could not reach the server. Check your connection and try again.')
      setLoading(false)
      return
    }

    // The key is stored locally only — it is deliberately never sent to signUp.
    if (apiKey.trim() && keyState === 'ok') setKey(apiKey, model, remember)

    // With email confirmation on there is no session yet, so the trip is created
    // on first authenticated load instead (see the app layout).
    if (!data.session) {
      setConfirmSent(true)
      setLoading(false)
      return
    }

    // Deliberately no trip here. Copying the seeded template on signup meant
    // every new account opened on somebody else's nine-day Himalayan road trip,
    // and made the onboarding flow unreachable by giving the user a trip before
    // they were ever asked how they wanted to start. Onboarding creates it.
    // Onboarding first — a new account has no trip yet — but carry ?next=
    // through it, so an invite link that sent someone here to sign up still
    // lands them where they were going once the trip exists.
    const params = new URLSearchParams()
    if (tripName.trim()) params.set('name', tripName.trim())
    if (destination !== DEFAULT_NEXT) params.set('next', destination)
    const query = params.toString()
    router.push(query ? `/onboarding?${query}` : '/onboarding')
    router.refresh()
  }

  if (confirmSent) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="bg-surface rounded-2xl p-8 w-full max-w-sm shadow-xl border border-border text-center">
          <span className="text-5xl">📬</span>
          <h1 className="font-display font-bold text-xl uppercase tracking-tight text-text mt-4">
            Confirm your email
          </h1>
          <p className="text-text-muted font-mono text-sm mt-2 leading-relaxed">
            We sent a link to <span className="text-text">{email}</span>. Open it and your
            trip will be waiting.
          </p>
          <Link href="/login" className="mt-6 inline-block font-mono text-sm text-accent hover:underline">
            ← Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4 py-12">
      <div className="bg-surface rounded-2xl p-8 w-full max-w-md shadow-xl border border-border">
        <div className="text-center mb-8">
          <span className="text-5xl" aria-label="Pemba the yak">🐂</span>
          <h1 className="font-display font-bold text-2xl uppercase tracking-tight text-text mt-3">
            Create your trip
          </h1>
          <p className="text-text-muted font-mono text-sm mt-1">
            Your own copy of the pack list and plan.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className={label}>Your name</label>
            <input id="name" type="text" value={displayName} autoComplete="name"
              onChange={e => setDisplayName(e.target.value)} className={input} placeholder="Kritish" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className={label}>Email</label>
            <input id="email" type="email" value={email} required autoComplete="email"
              onChange={e => setEmail(e.target.value)} className={input} placeholder="you@example.com" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className={label}>Password</label>
            <div className="relative">
              <input id="password" type={showPassword ? 'text' : 'password'} value={password}
                required minLength={8} autoComplete="new-password"
                onChange={e => setPassword(e.target.value)} className={input} placeholder="At least 8 characters" />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-text-dim hover:text-text transition-colors">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="trip" className={label}>Trip name</label>
            <input id="trip" type="text" value={tripName}
              onChange={e => setTripName(e.target.value)} className={input} placeholder="Spiti, June" />
          </div>

          {/* ── BYOK ───────────────────────────────────────────────────── */}
          <fieldset className="border border-border rounded-xl p-4 mt-2">
            <legend className="px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
              AI guide — optional
            </legend>
            <p className="font-body text-xs text-text-muted leading-relaxed mb-3">
              Pemba runs on your own OpenAI key so this project does not pay for
              everyone&apos;s conversations. The key stays in your browser and is never
              saved to our database. Everything else works without it.
            </p>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="apikey" className={label}>OpenAI API key</label>
              <div className="flex gap-2">
                <input id="apikey" type="password" value={apiKey} autoComplete="off"
                  onChange={e => { setApiKey(e.target.value); setKeyState('idle') }}
                  className={input} placeholder="sk-…" />
                <button type="button" onClick={verifyKey} disabled={!apiKey.trim() || keyState === 'checking'}
                  className="shrink-0 px-3 rounded-lg border border-border font-mono text-xs text-text-muted hover:text-text hover:border-accent/40 transition-colors disabled:opacity-40 min-h-[44px]">
                  {keyState === 'checking' ? <Loader2 size={14} className="animate-spin" /> : 'Check'}
                </button>
              </div>
            </div>

            {keyState === 'bad' && <p className="text-accent-3 font-mono text-xs mt-2">{keyError}</p>}

            {keyState === 'ok' && (
              <>
                <p className="text-accent-2 font-mono text-xs mt-2 flex items-center gap-1.5">
                  <Check size={12} /> Key works — {models.length} models available
                </p>
                <div className="flex flex-col gap-1.5 mt-3">
                  <label htmlFor="model" className={label}>Model</label>
                  <select id="model" value={model} onChange={e => setModel(e.target.value)} className={input}>
                    {models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <label className="flex items-start gap-2 mt-3 cursor-pointer">
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                    className="mt-0.5 accent-[var(--accent)]" />
                  <span className="font-body text-xs text-text-muted leading-relaxed">
                    Remember on this device. Leave off and the key is forgotten when you
                    close the tab.
                  </span>
                </label>
              </>
            )}
          </fieldset>

          {error && <p className="text-accent-3 font-mono text-xs">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-accent text-bg font-display font-bold uppercase tracking-tight text-sm py-3 rounded-xl mt-2 disabled:opacity-50 transition-opacity min-h-[44px]">
            {loading ? 'Creating your trip…' : 'Create account'}
          </button>

          <p className="font-mono text-xs text-text-muted text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-accent hover:underline">Sign in</Link>
          </p>
          <p className="font-mono text-[10px] text-text-dim text-center leading-relaxed">
            By creating an account you agree to the{' '}
            <Link href="/terms" className="text-text-muted hover:text-accent underline">terms</Link> and{' '}
            <Link href="/privacy" className="text-text-muted hover:text-accent underline">privacy policy</Link>.
          </p>
        </form>
      </div>
    </div>
  )
}

/**
 * useSearchParams() opts a component out of static prerendering, and these pages
 * are otherwise fully static. The Suspense boundary keeps the shell prerendered
 * and lets only the form hydrate with the `next` parameter.
 */
export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <RegisterPageForm />
    </Suspense>
  )
}
