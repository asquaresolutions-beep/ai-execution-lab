// ─────────────────────────────────────────────────────────────────
// lib/trustseal/verify/normalize.ts  (asq-trustseal-c1b)
// Pure domain canonicalization → eTLD+1 (apex policy, freeze §5/§6). No imports
// beyond node:crypto → node --experimental-strip-types testable. PSL upgrade is a
// Phase-2 dependency; a built-in multi-part-suffix set covers the common cases.
// ─────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto'

// Common multi-part public suffixes (NOT exhaustive — PSL is the Phase-2 upgrade).
const MULTI_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'gov.uk', 'ac.uk', 'co.in', 'net.in', 'org.in', 'gov.in', 'co.jp',
  'com.au', 'net.au', 'org.au', 'com.br', 'com.mx', 'com.sg', 'com.hk', 'co.nz', 'co.za',
  'com.tr', 'com.sa', 'com.ar', 'com.co', 'co.id', 'com.pk', 'com.ng', 'com.eg',
])
const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$|:/   // IPv4 or any colon (IPv6)

export interface NormalizedDomain { input: string; canonical: string }

/** Canonicalize arbitrary input to a registrable domain (eTLD+1), or null if invalid/non-public. */
export function normalizeDomain(raw: string | null | undefined): NormalizedDomain | null {
  if (!raw) return null
  let s = String(raw).trim().toLowerCase()
  // strip scheme + everything after host
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
  s = s.replace(/[/?#].*$/, '')          // path/query/fragment
  s = s.replace(/^[^@]*@/, '')           // userinfo
  s = s.replace(/:\d+$/, '')             // port
  s = s.replace(/\.$/, '')               // trailing dot
  s = s.replace(/^www\./, '')            // leading www
  let host: string
  try { host = new URL(`http://${s}`).hostname } catch { return null }   // IDN→punycode
  if (!host || IP_RE.test(host)) return null          // reject IPs (apex policy is for domains)
  const labels = host.split('.').filter(Boolean)
  if (labels.length < 2) return null                  // need a dot
  if (labels.some((l) => l.length === 0 || l.length > 63 || /[^a-z0-9-]/.test(l))) return null
  const canonical = registrable(labels)
  return canonical ? { input: String(raw).trim().toLowerCase(), canonical } : null
}

function registrable(labels: string[]): string | null {
  const last2 = labels.slice(-2).join('.')
  const last3 = labels.slice(-3).join('.')
  if (labels.length >= 3 && MULTI_SUFFIXES.has(last2)) return last3   // e.g. acme.co.uk
  return last2                                                       // e.g. acme.com
}

/** Deterministic verification doc id (mirrors subscriberDocId pattern). */
export function verifyDocId(canonical: string): string {
  return 'vs_' + createHash('sha1').update(canonical).digest('hex').slice(0, 32)
}
