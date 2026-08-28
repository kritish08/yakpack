'use client'

/**
 * Bring-your-own-key storage.
 *
 * The key never leaves the browser except as a per-request header to our own
 * /api/ai/* routes, which use it for that one call and discard it. Nothing is
 * written to the database, so there is no key at rest to encrypt, rotate, or
 * lose in a breach — and no way for the operator to read a user's key.
 *
 * Two storage choices, because they are a real trade-off rather than a default:
 *   - sessionStorage (default): gone when the tab closes. Safer.
 *   - localStorage ("remember on this device"): survives restarts. Convenient.
 * Reads check both, so a remembered key keeps working across sessions.
 */

const KEY = 'yakpack:openai-key'
const MODEL = 'yakpack:openai-model'
const REMEMBER = 'yakpack:openai-remember'

export const DEFAULT_MODEL = 'gpt-5.6-luna'

function stores(): Storage[] {
  try {
    if (typeof window === 'undefined') return []
    return [window.sessionStorage, window.localStorage]
  } catch {
    return []
  }
}

function readFirst(name: string): string | null {
  for (const s of stores()) {
    try {
      const v = s.getItem(name)
      if (v) return v
    } catch { /* storage blocked — treat as absent */ }
  }
  return null
}

export function getKey(): string | null {
  return readFirst(KEY)
}

export function getModel(): string {
  return readFirst(MODEL) ?? DEFAULT_MODEL
}

export function isRemembered(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(REMEMBER) === '1'
  } catch {
    return false
  }
}

export function setKey(key: string, model: string, remember: boolean): void {
  clearKey()
  const trimmed = key.trim()
  if (!trimmed) return
  try {
    const target = remember ? window.localStorage : window.sessionStorage
    target.setItem(KEY, trimmed)
    target.setItem(MODEL, model || DEFAULT_MODEL)
    if (remember) window.localStorage.setItem(REMEMBER, '1')
  } catch { /* storage full or blocked — the key simply is not kept */ }
}

export function clearKey(): void {
  for (const s of stores()) {
    try {
      s.removeItem(KEY)
      s.removeItem(MODEL)
      s.removeItem(REMEMBER)
    } catch { /* ignore */ }
  }
}

/** Headers carrying the caller's key, or nothing when they have not set one. */
export function byokHeaders(): Record<string, string> {
  const key = getKey()
  if (!key) return {}
  return { 'x-openai-key': key, 'x-openai-model': getModel() }
}

/**
 * Asks OpenAI which models this key can actually reach, so the picker offers
 * real options instead of a hardcoded list that drifts.
 * Called directly from the browser with the user's own key — it never transits
 * our server.
 */
export async function listModels(key: string): Promise<string[]> {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${key.trim()}` },
  })
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'That key was rejected by OpenAI.' : `OpenAI returned ${res.status}.`)
  }
  const body = await res.json()
  const ids: string[] = (body?.data ?? []).map((m: { id: string }) => m.id)
  // Chat-capable families only — embeddings, audio and image models cannot answer.
  return ids
    .filter(id => /^(gpt|o[13-9])/.test(id))
    .filter(id => !/(embedding|tts|whisper|audio|realtime|moderation|image|transcribe|search|codex)/.test(id))
    .sort()
    .reverse()
}
