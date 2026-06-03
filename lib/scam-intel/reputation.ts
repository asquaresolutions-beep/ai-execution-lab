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
// Well-known legitimate orgs (official domains only).
const TRUSTED_DOMAINS = new Set<string>([
  ...FIRST_PARTY_DOMAINS,
  'sbi.co.in', 'onlinesbi.sbi', 'hdfcbank.com', 'icicibank.com', 'axisbank.com', 'kotak.com', 'pnbindia.in',
  'paytm.com', 'phonepe.com', 'amazon.in', 'amazon.com', 'flipkart.com', 'indiapost.gov.in', 'irctc.co.in',
  'rbi.org.in', 'npci.org.in', 'uidai.gov.in', 'incometax.gov.in', 'gov.in', 'google.com', 'microsoft.com',
])
// Official UPI handle suffixes for real PSPs (the handle bank, not the name).
const TRUSTED_UPI_SUFFIX = ['@oksbi', '@okhdfcbank', '@okicici', '@okaxis', '@ybl', '@paytm', '@apl', '@ibl', '@upi']

function rootDomain(host: string): string {
  const h = host.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0]
  return h
}
function isTrustedDomain(host: string): boolean {
  const h = rootDomain(host)
  return Array.from(TRUSTED_DOMAINS).some((d) => h === d || h.endsWith('.' + d))
}
export function isFirstParty(host: string): boolean {
  const h = rootDomain(host)
  return FIRST_PARTY_DOMAINS.some((d) => h === d || h.endsWith('.' + d))
}

export function domainReputation(host: string): ReputationResult {
  const h = rootDomain(host)
  if (isFirstParty(h)) return { reputation: 'trusted', reason: 'A Square Solutions first-party domain', entity: h, kind: 'domain' }
  if (isTrustedDomain(h)) return { reputation: 'trusted', reason: 'official/verified domain', entity: h, kind: 'domain' }
  // Suspicious TLD or punycode.
  if (/xn--/.test(h) || /\.(xyz|top|click|info|live|buzz|tk|ml|ga)$/.test(h)) return { reputation: 'suspicious', reason: 'high-risk TLD / punycode', entity: h, kind: 'domain' }
  return { reputation: 'unknown', reason: 'no reputation data', entity: h, kind: 'domain' }
}

export function emailReputation(email: string): ReputationResult {
  const e = email.toLowerCase().trim()
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

/**
 * Adjust a raw risk score using reputation. Trusted entities get a strong
 * reduction UNLESS strong fraud signals are present (then trust is overridden,
 * because look-alikes/compromise exist). Returns the adjusted risk + note.
 */
export function applyReputation(rawRisk: number, opts: { domains?: string[]; emails?: string[]; upiIds?: string[]; strongFraudSignal?: boolean }): { risk: number; trusted: boolean; notes: string[] } {
  const notes: string[] = []
  let trusted = false
  const checkTrusted = (results: ReputationResult[]) => results.some((r) => r.reputation === 'trusted')
  const domReps = (opts.domains ?? []).map(domainReputation)
  const emailReps = (opts.emails ?? []).map(emailReputation)
  const anyTrusted = checkTrusted(domReps) || checkTrusted(emailReps)
  const anySuspiciousDomain = domReps.some((r) => r.reputation === 'suspicious')

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
