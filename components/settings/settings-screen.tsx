'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ByokSection from './byok-section'
import AdminPanel from './admin-panel'
import PartnersSection from './partners-section'
import type { AppRole, Database, MemberKey } from '@/lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface Props {
  profile: Profile | null
  userEmail: string
  memberKey: MemberKey
  appRole: AppRole
}

// --- Profile Card ---

function ProfileCard({ profile, userEmail, memberKey }: { profile: Profile | null; userEmail: string; memberKey: MemberKey }) {
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [draftName, setDraftName] = useState(displayName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Identity is per-trip: you own your own trip and may be the partner on another.
  const isOwner = memberKey === 'organiser'
  const initial = displayName ? displayName[0].toUpperCase() : (isOwner ? 'O' : 'P')
  const avatarColor = isOwner ? 'bg-accent/20 text-accent' : 'bg-accent-4/20 text-accent-4'
  const roleBadgeColor = isOwner ? 'text-accent bg-accent/10' : 'text-accent-4 bg-accent-4/10'
  const roleName = isOwner ? 'Trip organiser' : 'Partner'

  async function handleSave() {
    const trimmed = draftName.trim()
    if (!trimmed) return
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setSaving(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: err } = await (supabase.from('profiles') as any)
      .update({ display_name: trimmed })
      .eq('id', user.id)
    if (err) {
      setError(err.message)
    } else {
      setDisplayName(trimmed)
      setEditing(false)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
    }
    setSaving(false)
  }

  function handleCancel() {
    setDraftName(displayName)
    setEditing(false)
    setError(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') handleCancel()
  }

  return (
    <section className="bg-surface rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="font-display text-xs uppercase tracking-widest text-text-muted">Profile</h2>
      </div>
      <div className="px-4 py-5 flex items-start gap-4">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 font-display font-bold text-xl ${avatarColor}`}>
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                maxLength={40}
                className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-text text-sm outline-none focus:border-accent transition-colors font-body"
              />
              <button
                onClick={handleSave}
                disabled={saving || !draftName.trim()}
                aria-label="Save name"
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-accent-2 hover:bg-accent-2/10 disabled:opacity-40 transition-colors"
              >
                <Check size={16} aria-hidden="true" />
              </button>
              <button
                onClick={handleCancel}
                aria-label="Cancel edit"
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 transition-colors"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-2">
              <span className="font-body font-medium text-text text-base truncate">{displayName}</span>
              <button
                onClick={() => { setDraftName(displayName); setEditing(true) }}
                aria-label="Edit display name"
                className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
            </div>
          )}
          <p className="font-mono text-xs text-text-muted truncate mb-2">{userEmail}</p>
          <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${roleBadgeColor}`}>
            {roleName}
          </span>
          {error && <p className="text-accent-3 font-mono text-xs mt-2">{error}</p>}
          {success && <p className="text-accent-2 font-mono text-xs mt-2">Name updated.</p>}
        </div>
      </div>
    </section>
  )
}

// --- Change Password ---

function PasswordSection() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password: newPassword })
    if (err) {
      setError(err.message)
    } else {
      setSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setSuccess(false), 3000)
    }
    setLoading(false)
  }

  const inputClass = 'bg-surface-2 border border-border rounded-lg px-3 py-2 text-text text-sm outline-none focus:border-accent transition-colors w-full font-body'

  return (
    <section className="bg-surface rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="font-display text-xs uppercase tracking-widest text-text-muted">Security</h2>
      </div>
      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-3">
        <div className="space-y-1.5">
          <label className="font-mono text-xs text-text-muted uppercase tracking-wider block">New password</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" placeholder="Min. 8 characters" className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-xs text-text-muted uppercase tracking-wider block">Confirm new password</label>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" placeholder="Repeat password" className={inputClass} />
        </div>
        {error && <p className="text-accent-3 font-mono text-xs">{error}</p>}
        {success && <p className="text-accent-2 font-mono text-xs">Password updated successfully.</p>}
        <button
          type="submit"
          disabled={loading || !newPassword || !confirmPassword}
          className="w-full py-3 rounded-xl bg-accent text-bg font-display font-bold uppercase tracking-tight text-sm disabled:opacity-40 transition-opacity mt-1"
        >
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </section>
  )
}

// --- Toggle ---

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${on ? 'bg-accent' : 'bg-surface-2 border border-border'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-bg transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

// --- Preferences ---

function PreferencesSection() {
  const [notifs, setNotifs] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('yak_notifs')
    if (stored !== null) setNotifs(stored !== 'false')
  }, [])

  function toggleNotifs() {
    const next = !notifs
    setNotifs(next)
    localStorage.setItem('yak_notifs', String(next))
  }

  return (
    <section className="bg-surface rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="font-display text-xs uppercase tracking-widest text-text-muted">Preferences</h2>
      </div>
      <div className="px-4 py-4 flex items-center justify-between min-h-[56px]">
        <div>
          <p className="font-body text-sm text-text">Notifications</p>
          <p className="font-mono text-xs text-text-muted">Heads-up alerts &amp; daily briefings</p>
        </div>
        <Toggle on={notifs} onToggle={toggleNotifs} />
      </div>
    </section>
  )
}

// --- Main ---

export default function SettingsScreen({ profile, userEmail, memberKey, appRole }: Props) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <ProfileCard profile={profile} userEmail={userEmail} memberKey={memberKey} />
      <PasswordSection />
      <PartnersSection />
      <ByokSection isAdmin={appRole === 'admin'} />
      {appRole === 'admin' && <AdminPanel />}
      <PreferencesSection />
      <section>
        <button
          onClick={handleSignOut}
          className="w-full py-3 rounded-xl border border-accent text-accent font-body text-sm font-medium hover:bg-accent/10 transition-colors"
        >
          Sign out
        </button>
      </section>
    </div>
  )
}
