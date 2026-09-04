import 'server-only'

/**
 * A per-user token bucket, held in process memory.
 *
 * Honest about what this is. On a serverless host each instance keeps its own
 * counters, so a caller spread across instances gets a higher effective limit
 * than the number below suggests, and a cold start forgets everything. It is
 * therefore not a defence against a determined distributed abuser.
 *
 * It is a defence against the things that actually happen: a runaway client
 * loop, a stuck retry, one enthusiastic user, and a script pointed at
 * /api/import/url — which fetches a URL of the caller's choosing from the
 * server, and is the one route here that could otherwise be used as a general
 * purpose proxy. Bounding that per instance is worth far more than nothing, and
 * it is the difference between "someone was rude" and "someone used our egress".
 *
 * When this stops being enough, the replacement is Postgres or Upstash behind
 * the same `check()` signature; nothing above it needs to change.
 */

interface Bucket { tokens: number; updated: number }

const buckets = new Map<string, Bucket>()

/** Bounded so a stream of one-off keys cannot grow the map without limit. */
const MAX_KEYS = 10_000

export interface Limit {
  /** Sustained requests per minute. */
  perMinute: number
  /** How many may be spent at once before the sustained rate applies. */
  burst?: number
}

export interface LimitResult {
  ok: boolean
  /** Seconds until the next token, for Retry-After. */
  retryAfter: number
  remaining: number
}

export function check(key: string, limit: Limit): LimitResult {
  const capacity = limit.burst ?? limit.perMinute
  const refillPerMs = limit.perMinute / 60_000
  const now = Date.now()

  if (buckets.size > MAX_KEYS) buckets.clear()

  const b = buckets.get(key) ?? { tokens: capacity, updated: now }
  // Refill for the time elapsed, capped at the bucket's capacity.
  b.tokens = Math.min(capacity, b.tokens + (now - b.updated) * refillPerMs)
  b.updated = now

  if (b.tokens < 1) {
    buckets.set(key, b)
    return { ok: false, retryAfter: Math.ceil((1 - b.tokens) / refillPerMs / 1000), remaining: 0 }
  }

  b.tokens -= 1
  buckets.set(key, b)
  return { ok: true, retryAfter: 0, remaining: Math.floor(b.tokens) }
}

/**
 * Guards a route. Returns a 429 to return, or null to carry on.
 *
 * Keyed by user id rather than IP: every one of these routes is behind auth, and
 * an account is the thing being limited. IP would punish everyone behind one
 * office NAT and do nothing about a single account looping.
 */
export function rateLimit(userId: string, route: string, limit: Limit): Response | null {
  const r = check(`${route}:${userId}`, limit)
  if (r.ok) return null

  return Response.json(
    { error: 'That is a lot of requests in a short time. Give it a moment and try again.' },
    { status: 429, headers: { 'Retry-After': String(Math.max(1, r.retryAfter)) } },
  )
}
