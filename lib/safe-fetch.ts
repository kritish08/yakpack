import 'server-only'
import dns from 'node:dns/promises'
import net from 'node:net'
import https from 'node:https'
import type { IncomingMessage } from 'node:http'

/**
 * Fetching a URL the user typed is a server-side request to an attacker-chosen
 * address. Left unguarded that is textbook SSRF: `http://169.254.169.254/` reads
 * the cloud metadata service, `http://127.0.0.1:54321` reads Supabase's own API
 * with whatever credentials the container has, and an internal hostname reaches
 * anything on the private network.
 *
 * The rules here are deliberately strict — this feature exists to read a public
 * itinerary page, and nothing legitimate needs any of what is blocked:
 *
 *   1. https only, on the default port.
 *   2. Every IP the hostname resolves to must be publicly routable. Checking
 *      *every* record matters: a name that returns one public and one private
 *      address is a bypass if you only check the first.
 *   3. Redirects are followed by hand, at most three hops, each re-validated.
 *      `redirect: 'follow'` would let a public URL bounce to a private one
 *      without the guard ever seeing it.
 *   4. The body is capped and the whole thing is on a timeout, so a slow or
 *      endless response cannot hold a server function open.
 *
 *   5. The connection is pinned to the addresses that were checked. Validating
 *      a hostname and then handing it to `fetch` resolves it twice, and a
 *      hostile resolver can answer publicly for the check and privately for the
 *      connection -- DNS rebinding, a time-of-check/time-of-use bug that no
 *      amount of address-rule work fixes. That is why this uses node:https with
 *      a custom `lookup` rather than fetch: there is no second resolution to
 *      poison. SNI and certificate validation still use the hostname, so
 *      pinning the address does not weaken TLS.
 */

export const MAX_BYTES = 2 * 1024 * 1024
const TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 3

/** Something a public web page could never legitimately be served from. */
function isBlockedIPv4(ip: string): boolean {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true
  const [a, b, c] = p
  return (
    a === 0 ||                                 // "this network"
    a === 10 ||                                // private
    a === 127 ||                               // loopback
    (a === 100 && b >= 64 && b <= 127) ||      // CGNAT
    (a === 169 && b === 254) ||                // link-local — cloud metadata lives here
    (a === 172 && b >= 16 && b <= 31) ||       // private
    (a === 192 && b === 0 && c === 0) ||       // IETF protocol assignments — /24, not /16
    (a === 192 && b === 168) ||                // private
    (a === 198 && (b === 18 || b === 19)) ||   // benchmarking
    a >= 224                                   // multicast + reserved
  )
}

/**
 * Expands any valid IPv6 text form to its eight 16-bit groups.
 *
 * Needed because WHATWG URL parsing rewrites `::ffff:169.254.169.254` as
 * `::ffff:a9fe:a9fe`. Matching only the dotted-quad spelling therefore misses
 * every embedded IPv4 address that actually arrives through a URL — which is
 * all of them.
 *
 * Returns null on anything it cannot parse, and every caller treats null as
 * blocked: this guard fails closed.
 */
function expandIPv6(input: string): number[] | null {
  let s = input

  const dotted = s.match(/^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (dotted) {
    const q = dotted[2].split('.').map(Number)
    if (q.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return null
    s = `${dotted[1]}${(((q[0] << 8) | q[1]) >>> 0).toString(16)}:${(((q[2] << 8) | q[3]) >>> 0).toString(16)}`
  }

  const halves = s.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const fill = 8 - head.length - tail.length
  if (fill < 0 || (halves.length === 1 && fill !== 0)) return null

  const parts = [...head, ...Array(halves.length === 2 ? fill : 0).fill('0'), ...tail]
  if (parts.length !== 8) return null

  const out = parts.map(g => (g === '' ? 0 : parseInt(g, 16)))
  return out.some(n => !Number.isFinite(n) || n < 0 || n > 0xffff) ? null : out
}

const v4 = (hi: number, lo: number) => [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join('.')

function isBlockedIPv6(ip: string): boolean {
  const g = expandIPv6(ip.toLowerCase().split('%')[0])
  if (!g) return true

  // Anything carrying an IPv4 address is judged by the IPv4 rules, or
  // ::ffff:127.0.0.1 walks straight past a v6-only check.
  const zeroPrefix = (n: number) => g.slice(0, n).every(x => x === 0)

  if (zeroPrefix(5) && g[5] === 0xffff) return isBlockedIPv4(v4(g[6], g[7]))  // IPv4-mapped
  if (zeroPrefix(6)) return true                                              // ::, ::1, IPv4-compatible
  if (g[0] === 0x0064 && g[1] === 0xff9b) return isBlockedIPv4(v4(g[6], g[7])) // NAT64
  if (g[0] === 0x2002) return isBlockedIPv4(v4(g[1], g[2]))                   // 6to4

  if ((g[0] & 0xfe00) === 0xfc00) return true  // fc00::/7  unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true  // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return true  // ff00::/8  multicast
  return false
}

/**
 * Exported for tests. This predicate is the whole SSRF guard: everything else is
 * plumbing around it, and a rule this consequential should be assertable on its
 * own rather than only through a live fetch.
 */
export function isBlockedAddress(ip: string): boolean {
  const v = net.isIP(ip)
  if (v === 4) return isBlockedIPv4(ip)
  if (v === 6) return isBlockedIPv6(ip)
  return true
}

export class UnsafeUrlError extends Error {}

/**
 * Validates one URL and returns it, or throws with a message safe to show.
 *
 * Messages are deliberately vague about *why* an address was refused: a precise
 * error turns this endpoint into a port scanner that reports what is listening
 * on the private network.
 */
interface SafeTarget {
  url: URL
  /** The addresses this host was validated at, and the only ones we will use. */
  addresses: string[]
}

async function assertSafe(raw: string): Promise<SafeTarget> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new UnsafeUrlError('That does not look like a web address.')
  }

  if (url.protocol !== 'https:') {
    throw new UnsafeUrlError('Only https links can be read.')
  }
  if (url.port && url.port !== '443') {
    throw new UnsafeUrlError('Only standard https links can be read.')
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('Links with credentials in them are not read.')
  }

  const host = url.hostname.replace(/^\[|\]$/g, '')

  // A literal IP never needs resolving, and must not be trusted to.
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) throw new UnsafeUrlError('That address cannot be reached.')
    return { url, addresses: [host] }
  }

  let records: { address: string }[]
  try {
    records = await dns.lookup(host, { all: true, verbatim: true })
  } catch {
    throw new UnsafeUrlError('That address could not be found.')
  }
  if (records.length === 0) throw new UnsafeUrlError('That address could not be found.')
  // Every record, not the first: one public and one private answer is a bypass.
  if (records.some(r => isBlockedAddress(r.address))) {
    throw new UnsafeUrlError('That address cannot be reached.')
  }

  return { url, addresses: records.map(r => r.address) }
}

/**
 * A DNS lookup that answers only with addresses this module already checked.
 *
 * This is the whole anti-rebinding mechanism. Node calls it instead of resolving
 * the name again, so the socket can only be opened to an address that passed
 * isBlockedAddress() moments ago. It never consults a resolver, so there is
 * nothing for a short TTL to change underneath us.
 *
 * Exported for tests: "the socket can only go where we already checked" is the
 * whole claim, and it should be assertable without standing up a hostile
 * resolver.
 */
export function pinnedLookup(addresses: string[]) {
  const entries = addresses.map(a => ({ address: a, family: net.isIP(a) }))

  return (
    _hostname: string,
    options: { all?: boolean; family?: number },
    callback: (err: NodeJS.ErrnoException | null, address?: unknown, family?: number) => void,
  ): void => {
    const wanted = options.family
      ? entries.filter(e => e.family === options.family)
      : entries

    if (wanted.length === 0) {
      callback(Object.assign(new Error('no validated address'), { code: 'ENOTFOUND' }))
      return
    }
    if (options.all) callback(null, wanted)
    else callback(null, wanted[0].address, wanted[0].family)
  }
}

/** One GET to an already-validated target. Redirects are not followed here. */
function requestOnce(target: SafeTarget, signal: AbortSignal): Promise<IncomingMessage> {
  const host = target.url.hostname.replace(/^\[|\]$/g, '')

  return new Promise<IncomingMessage>((resolve, reject) => {
    const req = https.request(
      target.url,
      {
        method: 'GET',
        signal,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lookup: pinnedLookup(target.addresses) as any,
        // SNI stays the hostname so the certificate is still checked against the
        // name the user typed. A literal IP gets none, which is what TLS expects.
        servername: net.isIP(host) ? undefined : host,
        headers: {
          // Identify honestly. Some sites serve a different page to unknown
          // agents, but pretending to be a browser to get around that is not
          // this feature's business.
          'User-Agent': 'YakPack/1.0 (+https://yakpack.tech; itinerary import)',
          Accept: 'text/html,text/plain;q=0.9',
          'Accept-Language': 'en',
        },
      },
      resolve,
    )
    req.on('error', reject)
    req.end()
  })
}

export interface FetchedPage {
  url: string
  contentType: string
  body: string
  truncated: boolean
}

/**
 * Fetches a public web page, following redirects by hand so each hop is checked.
 */
export async function safeFetchPage(raw: string): Promise<FetchedPage> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    let target = await assertSafe(raw)

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await requestOnce(target, controller.signal)
      const status = res.statusCode ?? 0

      if (status >= 300 && status < 400) {
        const location = res.headers.location
        res.destroy()
        if (!location) throw new UnsafeUrlError('That page redirected nowhere.')
        if (hop === MAX_REDIRECTS) throw new UnsafeUrlError('That page redirected too many times.')
        // Resolved against the current URL, then re-validated from scratch —
        // this is the hop that would otherwise land inside the private network.
        // Re-validating also re-pins: the next hop connects only to addresses
        // checked for *its* hostname.
        target = await assertSafe(new URL(location, target.url).toString())
        continue
      }

      if (status < 200 || status > 299) {
        res.destroy()
        throw new UnsafeUrlError(`That page returned ${status}.`)
      }

      const contentType = (res.headers['content-type'] ?? '').toLowerCase()
      if (!/text\/html|text\/plain|application\/xhtml/.test(contentType)) {
        res.destroy()
        throw new UnsafeUrlError(
          contentType.includes('pdf')
            ? 'That link is a PDF — download it and use the PDF option instead.'
            : 'That link is not a web page.',
        )
      }

      // Declared length is a hint, not a promise, so the stream is capped too.
      const declared = Number(res.headers['content-length'] ?? 0)
      if (declared > MAX_BYTES) {
        res.destroy()
        throw new UnsafeUrlError('That page is too large to read.')
      }

      const { text, truncated } = await readCapped(res)
      return { url: target.url.toString(), contentType, body: text, truncated }
    }

    throw new UnsafeUrlError('That page redirected too many times.')
  } catch (e) {
    if (e instanceof UnsafeUrlError) throw e
    const err = e as NodeJS.ErrnoException
    if (err?.name === 'AbortError' || err?.code === 'ABORT_ERR') {
      throw new UnsafeUrlError('That page took too long to respond.')
    }
    throw new UnsafeUrlError('That page could not be read.')
  } finally {
    clearTimeout(timer)
  }
}

/** Reads at most MAX_BYTES, then stops pulling rather than buffering the rest. */
async function readCapped(res: IncomingMessage): Promise<{ text: string; truncated: boolean }> {
  const chunks: Buffer[] = []
  let total = 0
  let truncated = false

  for await (const chunk of res) {
    const buf = chunk as Buffer
    total += buf.length
    if (total > MAX_BYTES) {
      chunks.push(buf.subarray(0, buf.length - (total - MAX_BYTES)))
      truncated = true
      res.destroy()
      break
    }
    chunks.push(buf)
  }

  return { text: Buffer.concat(chunks).toString('utf8'), truncated }
}
