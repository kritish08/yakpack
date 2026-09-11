'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2, Trash2 } from 'lucide-react'
import { exportMyData, deleteMyAccount } from '@/app/actions/account'
import { wipeLocalData } from '@/lib/local-wipe'

/**
 * Leaving.
 *
 * A product that can be signed up for should be leavable without emailing
 * anyone. Export sits next to delete on purpose — the useful order is "take your
 * data, then close the account", and separating them invites doing the second
 * without the first.
 *
 * Deletion asks the account to be typed out rather than using a confirm dialog:
 * this is the one irreversible control in the app, and a dialog is dismissed by
 * reflex.
 */
export default function DangerZone({ email }: { email: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState('')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, startTransition] = useTransition()

  async function download() {
    setError(null); setBusy(true)
    try {
      const json = await exportMyData()
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `yakpack-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the export.')
    } finally {
      setBusy(false)
    }
  }

  function destroy() {
    setError(null)
    startTransition(async () => {
      try {
        await deleteMyAccount()
        // The account is gone server-side; the device still holds its cached
        // rows, pages, outbox and API key until this runs.
        await wipeLocalData()
        router.push('/')
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not delete the account.')
      }
    })
  }

  return (
    <section>
      <h2 className="font-display font-bold text-sm uppercase tracking-tight text-text mb-1">
        Your data
      </h2>
      <p className="font-body text-xs text-text-muted leading-relaxed mb-3">
        Take a copy whenever you like, and close the account whenever you like.
      </p>

      <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-4">
        <div>
          <button
            onClick={download}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 rounded-lg border border-border text-text-muted hover:text-text hover:border-accent/40 transition-colors font-mono text-[11px] min-h-[44px] disabled:opacity-40"
          >
            {busy
              ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Preparing…</>
              : <><Download size={13} aria-hidden="true" /> Download my data</>}
          </button>
          <p className="font-mono text-[10px] text-text-dim mt-1.5 leading-relaxed">
            JSON: your trips, packing lists, days and contacts.
          </p>
        </div>

        <div className="border-t border-border/50 pt-4">
          {!open ? (
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-1.5 font-mono text-[11px] text-accent-3 min-h-[44px]"
            >
              <Trash2 size={13} aria-hidden="true" /> Delete my account
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="font-body text-xs text-text leading-relaxed">
                This deletes your account, the trips you organise and everything in
                them. Trips you were invited to stay with whoever organised them.
                It cannot be undone.
              </p>
              <label className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                Type <span className="text-text">{email}</span> to confirm
              </label>
              <input
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="off"
                aria-label="Type your email to confirm deletion"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent-3 transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={destroy}
                  disabled={pending || confirm.trim().toLowerCase() !== email.trim().toLowerCase()}
                  className="flex items-center gap-1.5 px-3 rounded-lg bg-accent-3 text-bg font-display font-bold text-xs uppercase min-h-[44px] disabled:opacity-40"
                >
                  {pending ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Trash2 size={13} aria-hidden="true" />}
                  Delete for ever
                </button>
                <button
                  onClick={() => { setOpen(false); setConfirm(''); setError(null) }}
                  className="px-3 rounded-lg border border-border text-text-muted font-mono text-xs min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {error && <p className="font-mono text-xs text-accent-3">{error}</p>}
      </div>
    </section>
  )
}
