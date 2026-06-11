// ─────────────────────────────────────────────────────────────────
// lib/trustseal/verify/normalize.ts  (asq-trustseal-c1b · hardened)
// Pure domain canonicalization → registrable domain (eTLD+1) using the REAL
// Public Suffix List (vendored ./public_suffix_list.dat, ICANN + PRIVATE).
// Imports only node builtins (crypto/fs/url) → loadable under
// node --experimental-strip-types (no relative runtime imports).
// The .dat is parsed once at module load; if it cannot be read the lookup
// degrades safely to the last-two-labels heuristic (psLen = 1 default rule).
// ─────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { domainToASCII } from 'node:url'

// ── Public Suffix List ───────────────────────────────────────────
interface PslRules { normal: Set<string>; wildcard: Set<string>; exception: Set<string> }

/** Convert a (possibly unicode) PSL rule to ASCII/punycode, label by label. '*' is preserved. */
function toAsciiRule(rule: string): string | null {
  const labels = rule.split('.').map((l) => (l === '*' ? '*' : domainToASCII(l) || ''))
  if (labels.some((l) => l === '')) return null // a label failed to convert → skip rule
  return labels.join('.').toLowerCase()
}

function loadPsl(): PslRules {
  const normal = new Set<string>()
  const wildcard = new Set<string>()
  const exception = new Set<string>()
  try {
    const raw = readFileSync(new URL('./public_suffix_list.dat', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('//')) continue // comments + blank lines
      let rule = t
      let isException = false
      if (rule.startsWith('!')) { isException = true; rule = rule.slice(1) }
      const ascii = toAsciiRule(rule)
      if (!ascii) continue
      if (isException) exception.add(ascii)              // !www.ck
      else if (ascii.startsWith('*.')) wildcard.add(ascii.slice(2)) // *.ck → base 'ck'
      else normal.add(ascii)                             // co.uk, com, github.io …
    }
  } catch {
    /* .dat unavailable → empty sets → default '*' rule (last-two-labels) below */
  }
  return { normal, wildcard, exception }
}

const PSL = loadPsl()

/**
 * Registrable domain (eTLD+1) for an ASCII/punycode host per the PSL algorithm
 * (https://publicsuffix.org/list/): exceptions win, else longest matching rule,
 * else the implicit `*` rule. Returns null if the host IS a public suffix
 * (no registrable part) — e.g. "co.uk".
 */
function registrableDomain(labels: string[]): string | null {
  let psLen = 1            // implicit '*' rule → eTLD is the final label
  let exceptionLen = -1
  for (let i = 0; i < labels.length; i++) {
    const suffix = labels.slice(i)          // suffix.length = labels.length - i
    const candidate = suffix.join('.')
    const rest = labels.slice(i + 1).join('.') // suffix minus its leftmost label
    if (PSL.exception.has(candidate)) exceptionLen = Math.max(exceptionLen, suffix.length - 1)
    if (PSL.normal.has(candidate)) psLen = Math.max(psLen, suffix.length)
    if (rest && PSL.wildcard.has(rest)) psLen = Math.max(psLen, suffix.length)
  }
  const effLen = exceptionLen >= 0 ? exceptionLen : psLen // exceptions take priority
  if (labels.length <= effLen) return null                // host is itself a public suffix
  return labels.slice(labels.length - effLen - 1).join('.')
}

// Reject IPs (apex policy is for domains, never bare addresses).
const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$|:/

export interface NormalizedDomain { input: string; canonical: string }

/** Canonicalize arbitrary input to a registrable domain (eTLD+1), or null if invalid/non-public. */
export function normalizeDomain(raw: string | null | undefined): NormalizedDomain | null {
  if (!raw) return null
  let s = String(raw).trim().toLowerCase()
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '') // scheme
  s = s.replace(/[/?#].*$/, '')                // path/query/fragment
  s = s.replace(/^[^@]*@/, '')                 // userinfo
  s = s.replace(/:\d+$/, '')                   // port
  s = s.replace(/\.+$/, '')                    // one-or-more trailing dots
  s = s.replace(/^www\./, '')                  // leading www
  let host: string
  try { host = new URL(`http://${s}`).hostname } catch { return null } // IDN → punycode
  if (!host || IP_RE.test(host)) return null
  const labels = host.split('.').filter(Boolean)
  if (labels.length < 2) return null
  if (labels.some((l) => l.length === 0 || l.length > 63 || /[^a-z0-9-]/.test(l))) return null
  const canonical = registrableDomain(labels)
  return canonical ? { input: String(raw).trim().toLowerCase(), canonical } : null
}

/** Deterministic verification doc id (mirrors subscriberDocId pattern). */
export function verifyDocId(canonical: string): string {
  return 'vs_' + createHash('sha1').update(canonical).digest('hex').slice(0, 32)
}
