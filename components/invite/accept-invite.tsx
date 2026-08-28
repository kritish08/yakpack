'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { acceptInvite } from '@/app/actions/invites'

export default function AcceptInvite({ token }: { token: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      await acceptInvite(token)
      router.push('/app')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join this trip.')
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      <button
        onClick={accept}
        disabled={busy}
        className="w-full bg-accent text-bg font-display font-bold uppercase tracking-tight text-sm py-3 rounded-xl disabled:opacity-50 transition-opacity min-h-[44px] flex items-center justify-center gap-2"
      >
        {busy ? <><Loader2 size={15} className="animate-spin" /> Joining…</> : 'Join this trip'}
      </button>

      {error && <p className="font-mono text-xs text-accent-3 leading-relaxed">{error}</p>}

      <Link href="/app" className="font-mono text-xs text-text-muted hover:text-accent transition-colors">
        Not now
      </Link>
    </div>
  )
}
