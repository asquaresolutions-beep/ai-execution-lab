// ─────────────────────────────────────────────────────────────────
// lib/trustseal/verify/ssrf.ts  (asq-trustseal-c1b)
// SSRF egress guard (freeze §1). Pure IP classification — collectors that connect
// to the target resolve DNS first and refuse non-public IPs. No imports → testable.
// ─────────────────────────────────────────────────────────────────

/** True only for globally-routable public IPs. Blocks private/loopback/link-local/CGNAT/metadata/ULA. */
export function isPublicIp(ip: string): boolean {
  if (!ip) return false
  if (ip.includes(':')) return isPublicIpv6(ip.toLowerCase())
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  const o = m.slice(1).map(Number)
  if (o.some((n) => n > 255)) return false
  const [a, b] = o
  if (a === 0 || a === 127) return false                 // this-network / loopback
  if (a === 10) return false                              // RFC1918
  if (a === 172 && b >= 16 && b <= 31) return false       // RFC1918
  if (a === 192 && b === 168) return false                // RFC1918
  if (a === 169 && b === 254) return false                // link-local + metadata (169.254.169.254)
  if (a === 100 && b >= 64 && b <= 127) return false      // CGNAT
  if (a >= 224) return false                              // multicast / reserved
  if (a === 192 && b === 0) return false                  // 192.0.0.0/24, 192.0.2.0/24 (test)
  return true
}

function isPublicIpv6(ip: string): boolean {
  if (ip === '::1' || ip === '::') return false           // loopback / unspecified
  if (ip.startsWith('fe80') || ip.startsWith('fc') || ip.startsWith('fd')) return false // link-local / ULA
  if (ip.startsWith('::ffff:')) return isPublicIp(ip.slice(7)) // IPv4-mapped
  return true
}

/** Reject any resolved address set that contains a non-public IP (no partial trust). */
export function allResolvedPublic(addresses: string[]): boolean {
  return addresses.length > 0 && addresses.every(isPublicIp)
}
