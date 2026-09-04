import { describe, it, expect } from 'vitest'
import { isBlockedAddress, safeFetchPage, UnsafeUrlError } from '@/lib/safe-fetch'

/**
 * /api/import/url makes a server-side request to an address the caller chooses.
 * Unguarded that is textbook SSRF, and this app's own Supabase sits on
 * 127.0.0.1 — so these are the rules that stand between "read my itinerary page"
 * and "read your database".
 */
describe('address rules', () => {
  const blocked: [string, string][] = [
    ['169.254.169.254', 'cloud metadata'],
    ['169.254.1.1', 'link-local'],
    ['127.0.0.1', 'loopback'],
    ['127.1.2.3', 'loopback, whole /8'],
    ['0.0.0.0', 'this network'],
    ['10.0.0.5', 'private 10/8'],
    ['172.16.0.1', 'private, bottom of 172.16/12'],
    ['172.31.255.255', 'private, top of 172.16/12'],
    ['192.168.1.1', 'private 192.168/16'],
    ['100.64.0.1', 'CGNAT, bottom'],
    ['100.127.255.255', 'CGNAT, top'],
    ['192.0.0.1', 'IETF protocol assignments'],
    ['198.18.0.1', 'benchmarking'],
    ['224.0.0.1', 'multicast'],
    ['255.255.255.255', 'broadcast'],
  ]
  it.each(blocked)('blocks %s (%s)', ip => {
    expect(isBlockedAddress(ip)).toBe(true)
  })

  // Every one of these sits one step outside a blocked range. Over-blocking is a
  // real bug too: an earlier version refused all of 192.0.0.0/16 when only the
  // /24 is reserved.
  const allowed: [string, string][] = [
    ['1.1.1.1', 'ordinary public'],
    ['11.0.0.1', 'just above 10/8'],
    ['172.32.0.1', 'just above 172.16/12'],
    ['172.15.255.255', 'just below 172.16/12'],
    ['100.63.255.255', 'just below CGNAT'],
    ['100.128.0.1', 'just above CGNAT'],
    ['192.0.1.1', 'just above the reserved /24'],
    ['192.169.0.1', 'just above 192.168/16'],
    ['223.255.255.255', 'just below multicast'],
  ]
  it.each(allowed)('allows %s (%s)', ip => {
    expect(isBlockedAddress(ip)).toBe(false)
  })
})

/**
 * IPv6 is where this went wrong once. WHATWG URL parsing rewrites
 * ::ffff:169.254.169.254 as ::ffff:a9fe:a9fe, so a rule that matched only the
 * dotted spelling let the metadata endpoint straight through.
 */
describe('IPv6 forms that carry an IPv4 address', () => {
  const blocked: [string, string][] = [
    ['::1', 'loopback'],
    ['::', 'unspecified'],
    ['::ffff:127.0.0.1', 'IPv4-mapped loopback, dotted'],
    ['::ffff:7f00:1', 'IPv4-mapped loopback, hex'],
    ['::ffff:169.254.169.254', 'IPv4-mapped metadata, dotted'],
    ['::ffff:a9fe:a9fe', 'IPv4-mapped metadata, hex — the form a URL produces'],
    ['::127.0.0.1', 'IPv4-compatible'],
    ['64:ff9b::7f00:1', 'NAT64 loopback'],
    ['64:ff9b::a9fe:a9fe', 'NAT64 metadata'],
    ['2002:7f00:1::', '6to4 loopback'],
    ['fd00::1', 'unique local'],
    ['fe80::1', 'link-local'],
    ['ff02::1', 'multicast'],
  ]
  it.each(blocked)('blocks %s (%s)', ip => {
    expect(isBlockedAddress(ip)).toBe(true)
  })

  it('allows a public IPv6 address', () => {
    expect(isBlockedAddress('2606:4700::1111')).toBe(false)
    expect(isBlockedAddress('2001:4860:4860::8888')).toBe(false)
  })

  it('fails closed on anything it cannot parse', () => {
    for (const junk of ['', 'not-an-ip', '1.2.3', '1.2.3.4.5', '999.1.1.1', 'gggg::1']) {
      expect(isBlockedAddress(junk)).toBe(true)
    }
  })
})

/** Shape rules, checked before any DNS lookup happens. */
describe('URL shape', () => {
  const cases: [string, RegExp][] = [
    ['http://example.com/', /Only https/],
    ['file:///etc/passwd', /Only https/],
    ['javascript:alert(1)', /Only https/],
    ['gopher://example.com/', /Only https/],
    ['https://example.com:8080/', /Only standard/],
    ['https://user:pw@example.com/', /credentials/],
    ['not a url', /does not look like/],
    ['', /Paste|does not look like/],
  ]
  it.each(cases)('refuses %s', async (url, message) => {
    await expect(safeFetchPage(url)).rejects.toThrow(UnsafeUrlError)
    await expect(safeFetchPage(url)).rejects.toThrow(message)
  })

  it('refuses a literal private address without resolving it', async () => {
    await expect(safeFetchPage('https://127.0.0.1/')).rejects.toThrow(/cannot be reached/)
    await expect(safeFetchPage('https://[::1]/')).rejects.toThrow(/cannot be reached/)
  })

  it('does not disclose why an address was refused', async () => {
    // A precise error turns this endpoint into a port scanner that reports what
    // is listening on the private network.
    await expect(safeFetchPage('https://10.0.0.5/')).rejects.toThrow(/^That address cannot be reached\.$/)
  })
})
