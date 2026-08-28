'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { safeNext } from '@/lib/safe-next'

type Mode = 'signin' | 'forgot'

function LoginPageForm() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  // Set by the auth proxy when it bounced an unauthenticated request. Validated
  // rather than trusted: an unchecked `next` is an open redirect.
  const destination = safeNext(searchParams.get('next'))
  const supabase = createClient()

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setResetSent(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === 'forgot') {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/api/auth/callback?next=/reset-password`,
      })
      if (err) {
        setError(err.message)
      } else {
        setResetSent(true)
      }
      setLoading(false)
      return
    }

    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      router.push(destination)
      router.refresh()
    }
  }

  if (resetSent) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="bg-surface rounded-2xl p-8 w-full max-w-sm shadow-xl border border-border text-center">
          <span className="text-5xl">📬</span>
          <h1 className="font-display font-bold text-xl uppercase tracking-tight text-text mt-4">
            Check your email
          </h1>
          <p className="text-text-muted font-mono text-sm mt-2 leading-relaxed">
            A reset link was sent to{' '}
            <span className="text-text">{email}</span>.
          </p>
          <button
            onClick={() => switchMode('signin')}
            className="mt-6 font-mono text-sm text-accent hover:underline"
          >
            ← Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl p-8 w-full max-w-sm shadow-xl border border-border">
        <div className="text-center mb-8">
          <span className="text-5xl" aria-label="Pemba the yak">🐂</span>
          <h1 className="font-display font-bold text-2xl uppercase tracking-tight text-text mt-3">
            YakPack
          </h1>
          <p className="text-text-muted font-mono text-sm mt-1">
            {mode === 'forgot' ? 'Reset your password.' : 'Haul it like a yak.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono text-text-muted uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-surface-2 border border-border rounded-lg px-4 py-3 text-text font-body text-sm placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors"
              placeholder="you@example.com"
            />
          </div>

          {mode === 'signin' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-text-muted uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-surface-2 border border-border rounded-lg px-4 py-3 text-text font-body text-sm placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors"
                placeholder="••••••••"
              />
            </div>
          )}

          {error && (
            <p className="text-accent-3 font-mono text-xs">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-bg font-display font-bold uppercase tracking-tight text-sm py-3 rounded-xl mt-2 disabled:opacity-50 transition-opacity"
          >
            {loading
              ? mode === 'forgot' ? 'Sending…' : 'Signing in…'
              : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
          </button>

          <button
            type="button"
            onClick={() => switchMode(mode === 'signin' ? 'forgot' : 'signin')}
            className="font-mono text-xs text-text-muted hover:text-accent transition-colors text-center"
          >
            {mode === 'signin' ? 'Forgot password?' : '← Back to sign in'}
          </button>
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
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <LoginPageForm />
    </Suspense>
  )
}
