'use client'

import { useEffect, useState, useTransition } from 'react'
import { Shield, X, Loader2, Trash2, KeyRound, Check, Pencil } from 'lucide-react'
import {
  listUsers, updateUserName, setUserPassword, setUserRole, deleteUser,
  type ManagedUser,
} from '@/app/actions/admin'

const input =
  'w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors'

type Editing = { id: string; mode: 'name' | 'password' } | null

/**
 * Account management for the deployment operator.
 *
 * Every mutation runs through a server action that re-checks admin standing —
 * rendering this component is a convenience, never the authorisation.
 */
export default function AdminPanel() {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<ManagedUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [draft, setDraft] = useState('')
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    setError(null)
    listUsers().then(setUsers).catch(e => setError(e.message))
  }, [open])

  function run(fn: () => Promise<void>, success: string) {
    setError(null); setNotice(null)
    startTransition(async () => {
      try {
        await fn()
        setUsers(await listUsers())
        setEditing(null); setDraft('')
        setNotice(success)
        setTimeout(() => setNotice(null), 3000)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.')
      }
    })
  }

  function confirmDelete(u: ManagedUser) {
    const ok = window.confirm(
      `Delete ${u.email}? This removes their account and every trip they own — items, plan and progress. This cannot be undone.`,
    )
    if (ok) run(() => deleteUser(u.id), `Deleted ${u.email}.`)
  }

  return (
    <section>
      <h2 className="font-display font-bold text-sm uppercase tracking-tight text-text mb-1">
        Administration
      </h2>
      <p className="font-body text-xs text-text-muted leading-relaxed mb-3">
        You operate this deployment. Pemba uses the server key for your account;
        everyone else brings their own.
      </p>

      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 bg-surface border border-border rounded-2xl px-4 py-3.5 hover:border-accent/40 transition-colors min-h-[44px]"
      >
        <span className="flex items-center gap-2.5">
          <Shield size={15} className="text-accent" />
          <span className="font-body text-sm text-text">Manage accounts</span>
        </span>
        <span className="font-mono text-[11px] text-text-dim">Open</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Manage accounts">
          <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-surface rounded-t-2xl border-t border-border w-full flex flex-col overflow-hidden" style={{ maxHeight: '85vh' }}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 shrink-0" />

            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Shield size={15} className="text-accent" />
                <h3 className="font-display font-bold text-sm uppercase tracking-tight text-text">Accounts</h3>
                {users && <span className="font-mono text-[11px] text-text-dim">{users.length}</span>}
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="p-2 text-text-muted hover:text-text transition-colors min-h-[44px]">
                <X size={18} />
              </button>
            </div>

            {error &&  <p className="px-4 py-2 font-mono text-xs text-accent-3 border-b border-border">{error}</p>}
            {notice && <p className="px-4 py-2 font-mono text-xs text-accent-2 border-b border-border">{notice}</p>}

            <div className="overflow-y-auto flex-1 divide-y divide-border/40 pb-[env(safe-area-inset-bottom)]">
              {!users && !error && (
                <p className="px-4 py-8 text-center font-mono text-xs text-text-dim">Loading…</p>
              )}

              {users?.map(u => (
                <div key={u.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm text-text truncate">
                        {u.displayName}
                        {u.isSelf && <span className="ml-1.5 font-mono text-[10px] text-accent">you</span>}
                      </p>
                      <p className="font-mono text-[11px] text-text-dim truncate">{u.email}</p>
                      <p className="font-mono text-[10px] text-text-dim mt-0.5">
                        <span className={u.appRole === 'admin' ? 'text-accent' : ''}>{u.appRole}</span>
                        {' · '}{u.tripCount} trip{u.tripCount === 1 ? '' : 's'}
                      </p>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => { setEditing({ id: u.id, mode: 'name' }); setDraft(u.displayName) }}
                        aria-label={`Rename ${u.email}`}
                        className="p-2 text-text-dim hover:text-accent transition-colors min-h-[44px] min-w-[36px] flex items-center justify-center"
                      ><Pencil size={13} /></button>
                      <button
                        onClick={() => { setEditing({ id: u.id, mode: 'password' }); setDraft('') }}
                        aria-label={`Set password for ${u.email}`}
                        className="p-2 text-text-dim hover:text-accent transition-colors min-h-[44px] min-w-[36px] flex items-center justify-center"
                      ><KeyRound size={13} /></button>
                      {!u.isSelf && (
                        <button
                          onClick={() => confirmDelete(u)}
                          aria-label={`Delete ${u.email}`}
                          className="p-2 text-text-dim hover:text-accent-3 transition-colors min-h-[44px] min-w-[36px] flex items-center justify-center"
                        ><Trash2 size={13} /></button>
                      )}
                    </div>
                  </div>

                  {editing?.id === u.id && (
                    <div className="mt-2.5 flex gap-2">
                      <input
                        type={editing.mode === 'password' ? 'password' : 'text'}
                        value={draft}
                        autoFocus
                        onChange={e => setDraft(e.target.value)}
                        placeholder={editing.mode === 'password' ? 'New password (min 8)' : 'Display name'}
                        className={input}
                        aria-label={editing.mode === 'password' ? 'New password' : 'Display name'}
                      />
                      <button
                        disabled={pending || !draft.trim()}
                        onClick={() => editing.mode === 'password'
                          ? run(() => setUserPassword(u.id, draft), `Password updated for ${u.email}.`)
                          : run(() => updateUserName(u.id, draft), 'Name updated.')}
                        className="shrink-0 px-3 rounded-lg bg-accent text-bg font-display font-bold text-xs uppercase disabled:opacity-40 min-h-[44px]"
                      >
                        {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      </button>
                      <button
                        onClick={() => { setEditing(null); setDraft('') }}
                        className="shrink-0 px-3 rounded-lg border border-border text-text-muted font-mono text-xs min-h-[44px]"
                      >Cancel</button>
                    </div>
                  )}

                  <button
                    disabled={pending || (u.isSelf && u.appRole === 'admin')}
                    onClick={() => run(
                      () => setUserRole(u.id, u.appRole === 'admin' ? 'user' : 'admin'),
                      `${u.email} is now ${u.appRole === 'admin' ? 'a user' : 'an admin'}.`,
                    )}
                    className="mt-2 font-mono text-[11px] text-text-muted hover:text-accent transition-colors disabled:opacity-30 disabled:hover:text-text-muted"
                  >
                    {u.appRole === 'admin' ? 'Revoke admin' : 'Make admin'}
                  </button>
                </div>
              ))}

              {users?.length === 0 && (
                <p className="px-4 py-8 text-center font-mono text-xs text-text-dim">No accounts yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
