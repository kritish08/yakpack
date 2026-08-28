/**
 * Validates a `?next=` redirect target.
 *
 * `startsWith('/')` is NOT enough. A protocol-relative URL such as `//evil.com`
 * begins with a slash and every browser resolves it to a different origin, and
 * some normalise a backslash to a slash, so `/\evil.com` escapes too. On a login
 * page that is an open redirect: an attacker sends a link on this domain and the
 * victim lands off-site the instant they authenticate.
 *
 * The rule: exactly one leading slash, followed by something that is neither a
 * slash nor a backslash. Bare "/" falls through to the default because the
 * marketing page is not a useful post-login destination.
 */
export const DEFAULT_NEXT = '/app'

export function safeNext(raw: string | null | undefined, fallback = DEFAULT_NEXT): string {
  if (!raw) return fallback
  if (!/^\/[^/\\]/.test(raw)) return fallback
  return raw
}
