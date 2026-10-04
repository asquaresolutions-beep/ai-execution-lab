// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/reputation.ts
// Lightweight reputation layer for domains, email senders, UPI IDs, and phone
// numbers. Recognizes trusted/official entities (incl. A Square Solutions and
// major Indian banks/wallets/couriers) so legitimate messages aren't flagged —
// UNLESS strong fraud signals are present (OTP-sharing, look-alike domain, etc.).
// Pure / deterministic. (Trust + Reputation)
// ─────────────────────────────────────────────────────────────────

export type Reputation = 'trusted' | 'known' | 'suspicious' | 'unknown'
export interface ReputationResult { reputation: Reputation; reason: string; entity: string; kind: 'domain' | 'email' | 'upi' | 'phone' }

// First-party (A Square Solutions) — always trusted absent strong fraud signals.
const FIRST_PARTY_DOMAINS = ['asquaresolution.com', 'scamcheck.asquaresolution.com', 'trustseal.asquaresolution.com', 'lab.asquaresolution.com']
// Exact official email addresses — incl. free-mail addresses that are official
// (their domain alone isn't trusted, so the full address must be allow-listed).
const FIRST_PARTY_EMAILS = new Set(['support@asquaresolution.com', 'asquaresolutions@hotmail.com'])
export function isFirstPartyEmail(email: string): boolean { return FIRST_PARTY_EMAILS.has(email.toLowerCase().trim()) }
// Well-known legitimate orgs — EXACT official hosts. Trust matches the host itself
// or its `www.` form only, never arbitrary subdomains: a deep/nested name cannot be
// confirmed as the official site, and umbrella domains that host third-party
// content (gov.in, google.com, microsoft.com) are deliberately absent. Hosts that
// cannot be confirmed fall through to `unknown` (quick-check `unclear`).
const TRUSTED_DOMAINS = new Set<string>([
  ...FIRST_PARTY_DOMAINS,
  'sbi.co.in', 'onlinesbi.sbi', 'hdfcbank.com', 'icicibank.com', 'axisbank.com', 'kotak.com', 'pnbindia.in',
  'paytm.com', 'phonepe.com', 'amazon.in', 'amazon.com', 'flipkart.com', 'indiapost.gov.in', 'irctc.co.in',
  'rbi.org.in', 'npci.org.in', 'uidai.gov.in', 'incometax.gov.in',
  // Reporting / regulator sites the app itself points users to (exact hosts only).
  'cybercrime.gov.in', 'sancharsaathi.gov.in', 'sebi.gov.in',
])
// TrustSeal-only: organisations whose REGISTRABLE domain is official even though
// their subdomains host third-party content or redirects — so a ScamCheck LINK to
// them proves nothing, while a TrustSeal verification of the registrable domain
// itself does. Exact registrable domains only; deliberately no gov.in rule.
const TRUSTSEAL_ORG_DOMAINS = new Set<string>(['google.com', 'microsoft.com'])
// Official UPI handle suffixes for real PSPs (the handle bank, not the name).
const TRUSTED_UPI_SUFFIX = ['@oksbi', '@okhdfcbank', '@okicici', '@okaxis', '@ybl', '@paytm', '@apl', '@ibl', '@upi']

// Lenient form — display and the suspicious-TLD/punycode heuristic only, never trust.
function rootDomain(host: string): string {
  const h = host.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0]
  return h
}

/**
 * Hostname for TRUST decisions, parsed with the WHATWG URL parser (what browsers
 * use) from an http(s) URL or a bare host. Returns null — never trusted — for
 * anything ambiguous: backslash/whitespace, non-http(s) scheme, credentials,
 * non-default port, IP literal, empty label or unparseable input. A single
 * trailing dot (absolute FQDN) is the same host and is removed.
 */
export function strictHostname(input: string): string | null {
  const raw = String(input ?? '').trim()
  if (!raw || /[\s\\]/.test(raw)) return null
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw)
  if (hasScheme && !/^https?:\/\//i.test(raw)) return null
  let url: URL
  try { url = new URL(hasScheme ? raw : `https://${raw}`) } catch { return null }
  if (url.username || url.password || url.port) return null
  let host = url.hostname.toLowerCase()
  if (host.endsWith('.')) host = host.slice(0, -1)
  if (!host.includes('.') || host.startsWith('.') || host.endsWith('.') || host.includes('..')) return null
  if (host.startsWith('[') || /^\d+(\.\d+){3}$/.test(host)) return null
  return host
}
function matchesExactHost(host: string, list: Iterable<string>): boolean {
  const bare = host.startsWith('www.') ? host.slice(4) : host
  for (const d of list) if (host === d || bare === d) return true
  return false
}
function isTrustedDomain(host: string): boolean {
  const h = strictHostname(host)
  return h !== null && matchesExactHost(h, TRUSTED_DOMAINS)
}
export function isFirstParty(host: string): boolean {
  const h = strictHostname(host)
  return h !== null && matchesExactHost(h, FIRST_PARTY_DOMAINS)
}

export function domainReputation(host: string): ReputationResult {
  const strict = strictHostname(host)
  const h = strict ? strict.replace(/^www\./, '') : rootDomain(host)
  if (isFirstParty(host)) return { reputation: 'trusted', reason: 'A Square Solutions first-party domain', entity: h, kind: 'domain' }
  if (isTrustedDomain(host)) return { reputation: 'trusted', reason: 'official/verified domain', entity: h, kind: 'domain' }
  // Suspicious TLD or punycode.
  if (/xn--/.test(h) || /\.(xyz|top|click|info|live|buzz|tk|ml|ga)$/.test(h)) return { reputation: 'suspicious', reason: 'high-risk TLD / punycode', entity: h, kind: 'domain' }
  if (!strict) return { reputation: 'unknown', reason: 'ambiguous or malformed host — not trusted', entity: h, kind: 'domain' }
  return { reputation: 'unknown', reason: 'no reputation data', entity: h, kind: 'domain' }
}

/**
 * TrustSeal policy: reputation of a canonical REGISTRABLE domain (eTLD+1, as
 * produced by trustseal normalizeDomain). Same strict parsing and official list
 * as domainReputation, plus organisation-level domains (TRUSTSEAL_ORG_DOMAINS)
 * matched exactly. Not for ScamCheck links — use domainReputation there.
 */
export function registrableDomainReputation(domain: string): ReputationResult {
  const strict = strictHostname(domain)
  if (strict) {
    const bare = strict.replace(/^www\./, '')
    if (TRUSTSEAL_ORG_DOMAINS.has(bare)) return { reputation: 'trusted', reason: 'official/verified domain', entity: bare, kind: 'domain' }
  }
  return domainReputation(domain)
}

export function emailReputation(email: string): ReputationResult {
  const e = email.toLowerCase().trim()
  if (isFirstPartyEmail(e)) return { reputation: 'trusted', reason: 'official A Square Solutions email (allow-listed)', entity: e, kind: 'email' }
  const domain = e.split('@')[1] || ''
  const d = domainReputation(domain)
  return { reputation: d.reputation, reason: d.reason, entity: e, kind: 'email' }
}

export function upiReputation(upi: string): ReputationResult {
  const u = upi.toLowerCase().trim()
  const suffix = u.slice(u.indexOf('@'))
  if (TRUSTED_UPI_SUFFIX.includes(suffix)) return { reputation: 'known', reason: 'recognized UPI PSP handle (verify the payee name)', entity: u, kind: 'upi' }
  return { reputation: 'unknown', reason: 'unrecognized UPI handle', entity: u, kind: 'upi' }
}

export function phoneReputation(phone: string): ReputationResult {
  const p = phone.replace(/[\s-]/g, '')
  // Indian official short codes / toll-free patterns are lower-risk; 10-digit
  // personal mobiles soliciting action are higher-risk (handled by detectors).
  if (/^1800\d{6,7}$/.test(p) || /^1930$/.test(p)) return { reputation: 'known', reason: 'official short/toll-free number', entity: p, kind: 'phone' }
  return { reputation: 'unknown', reason: 'unverified number', entity: p, kind: 'phone' }
}

/** Risk at/above which quick-check reports `suspicious` (app/api/scam-intel/quick-check/route.ts). */
const SUSPICIOUS_RISK = 35

/**
 * Adjust a raw risk score using reputation. Trusted entities get a strong
 * reduction UNLESS strong fraud signals are present (then trust is overridden,
 * because look-alikes/compromise exist) or the raw risk is already at the
 * suspicious threshold (trust may confirm low risk, never erase high risk).
 * Returns the adjusted risk + note.
 */
export function applyReputation(rawRisk: number, opts: { domains?: string[]; emails?: string[]; upiIds?: string[]; strongFraudSignal?: boolean }): { risk: number; trusted: boolean; notes: string[] } {
  const notes: string[] = []
  let trusted = false
  const checkTrusted = (results: ReputationResult[]) => results.some((r) => r.reputation === 'trusted')
  const domReps = (opts.domains ?? []).map(domainReputation)
  const emailReps = (opts.emails ?? []).map(emailReputation)
  const anyTrusted = checkTrusted(domReps) || checkTrusted(emailReps)
  const anySuspiciousDomain = domReps.some((r) => r.reputation === 'suspicious')
  // A trusted mention never lowers an already-suspicious score: naming an official
  // domain is trivial for a scammer. Must match the quick-check `suspicious` threshold.
  const alreadyRisky = rawRisk >= SUSPICIOUS_RISK

  if (anyTrusted && alreadyRisky && !opts.strongFraudSignal && !anySuspiciousDomain) {
    notes.push('Mentions an official domain, but the message itself shows risk signals — naming a real brand does not make it safe.')
    return { risk: rawRisk, trusted, notes }
  }
  if (anyTrusted && !opts.strongFraudSignal && !anySuspiciousDomain) {
    trusted = true
    notes.push('Matched a verified/first-party entity with no strong fraud signals — treated as likely legitimate.')
    return { risk: Math.min(rawRisk, 15), trusted, notes }
  }
  if (anyTrusted && (opts.strongFraudSignal || anySuspiciousDomain)) {
    notes.push('References a trusted brand BUT shows fraud signals / look-alike domain — likely impersonation, not the real brand.')
  }
  return { risk: rawRisk, trusted, notes }
}
