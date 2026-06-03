// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/impersonation.ts
// Brand-impersonation / look-alike domain detection. Catches typosquatting,
// homoglyph attacks, character swaps, missing/extra letters, separator
// insertion, wrong-TLD clones, and deceptive subdomains for a watched brand
// list. Pure / deterministic (no network). Works on domains, URLs, and emails.
// ─────────────────────────────────────────────────────────────────

export interface Brand { core: string; legit: string[] }
export const WATCHED_BRANDS: Brand[] = [
  { core: 'asquaresolution', legit: ['asquaresolution.com', 'scamcheck.asquaresolution.com', 'trustseal.asquaresolution.com', 'lab.asquaresolution.com'] },
  { core: 'hdfcbank', legit: ['hdfcbank.com', 'hdfc.com'] },
  { core: 'sbi', legit: ['sbi.co.in', 'onlinesbi.sbi', 'onlinesbi.com', 'sbicard.com'] },
  { core: 'icicibank', legit: ['icicibank.com'] },
  { core: 'axisbank', legit: ['axisbank.com'] },
  { core: 'paytm', legit: ['paytm.com', 'paytmbank.com'] },
  { core: 'phonepe', legit: ['phonepe.com'] },
]

export type Technique = 'typosquat' | 'homoglyph' | 'character-swap' | 'separator-insertion' | 'wrong-tld' | 'deceptive-subdomain' | 'brand-keyword-suspicious'
export interface ImpersonationResult {
  isImpersonation: boolean
  host: string
  brand: string | null
  legitDomain: string | null
  techniques: Technique[]
  severity: 'danger' | 'warn' | 'none'
  detail: string
}

const SUSPICIOUS_TLD = /\.(xyz|top|click|info|live|buzz|tk|ml|ga|cf|gq|rest|cam|sbs|fit|online|site|website|link)$/i

// Fold common homoglyphs + digit substitutions to ASCII for comparison.
const HOMO: Record<string, string> = {
  '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '$': 's', '@': 'a',
  'а': 'a', 'е': 'e', 'о': 'o', 'с': 'c', 'р': 'p', 'х': 'x', 'ѕ': 's', 'і': 'i', 'ӏ': 'l', 'ո': 'n', 'ⅼ': 'l', 'ǐ': 'i',
}
function fold(s: string): string {
  return Array.from(s.toLowerCase()).map((ch) => HOMO[ch] ?? ch).join('')
}
function hasNonAscii(s: string): boolean { return /[^\x00-\x7F]/.test(s) }
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (!m) return n; if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[n]
}

/** Extract a hostname from a domain, URL, or email. */
export function hostFrom(input: string): string {
  let s = input.trim().toLowerCase()
  if (s.includes('@') && !s.includes('/')) s = s.split('@').pop() || s   // email → domain
  s = s.replace(/^h(?:tt|xx)ps?:\/\//, '').replace(/^www\./, '').replace(/\[\.\]/g, '.')
  return s.split(/[/?#:]/)[0]
}

export function detectImpersonation(input: string): ImpersonationResult {
  const host = hostFrom(input)
  const none: ImpersonationResult = { isImpersonation: false, host, brand: null, legitDomain: null, techniques: [], severity: 'none', detail: '' }
  if (!host || !host.includes('.')) return none

  const labels = host.split('.')
  const sld = labels[labels.length - 2] || host
  const root = labels.slice(-2).join('.')
  const subLabels = labels.slice(0, -2)
  const foldedSld = fold(sld).replace(/[^a-z0-9]/g, '')
  const strippedSld = sld.replace(/[^a-z0-9]/g, '')

  let best: ImpersonationResult | null = null
  for (const b of WATCHED_BRANDS) {
    // Exact legitimate domain → trusted, never impersonation.
    if (b.legit.some((d) => host === d || host.endsWith('.' + d))) return none

    const tech = new Set<Technique>()
    const coreLen = b.core.length

    // Separator insertion / homoglyph that collapses to the exact core.
    if (strippedSld === b.core && sld !== b.core) tech.add('separator-insertion')
    if (foldedSld === b.core && strippedSld !== b.core) tech.add('homoglyph')
    if (hasNonAscii(host) || /xn--/.test(host)) { if (foldedSld === b.core || levenshtein(foldedSld, b.core) <= 2) tech.add('homoglyph') }

    // Exact SLD but wrong (non-official) TLD → wrong-tld clone.
    if (strippedSld === b.core && !b.legit.some((d) => root === d)) tech.add('wrong-tld')

    // Edit-distance typosquat (only for cores long enough to avoid FPs).
    if (coreLen >= 5) {
      const d = levenshtein(foldedSld, b.core)
      if (d >= 1 && d <= 2) { tech.add('typosquat'); if (d === 1) tech.add('character-swap') }
    }

    // Deceptive subdomain: brand appears as a subdomain label but the
    // registrable domain isn't the brand (e.g. sbi.verify-login.xyz).
    const subTokens = subLabels.flatMap((l) => fold(l).split(/[^a-z0-9]+/))
    if (subTokens.includes(b.core) && !b.legit.some((d) => root === d || host.endsWith('.' + d))) tech.add('deceptive-subdomain')

    // Brand keyword inside the SLD with a non-official / suspicious domain
    // (e.g. sbi-verify-login.xyz, paytm-cashback.top).
    const sldTokens = fold(sld).split(/[^a-z0-9]+/)
    if ((sldTokens.includes(b.core) || (coreLen >= 5 && foldedSld.includes(b.core))) && !b.legit.some((d) => root === d) && (SUSPICIOUS_TLD.test(host) || subLabels.length > 0 || sld !== b.core)) {
      tech.add('brand-keyword-suspicious')
    }

    if (tech.size > 0) {
      const techniques = Array.from(tech)
      const strong = techniques.some((t) => t === 'typosquat' || t === 'homoglyph' || t === 'separator-insertion' || t === 'wrong-tld' || t === 'deceptive-subdomain')
      const candidate: ImpersonationResult = {
        isImpersonation: true, host, brand: b.core, legitDomain: b.legit[0], techniques,
        severity: strong ? 'danger' : 'warn',
        detail: `Looks like "${b.core}" (official: ${b.legit[0]}) via ${techniques.join(', ')} — likely impersonation, not the real brand.`,
      }
      if (!best || (candidate.severity === 'danger' && best.severity !== 'danger') || candidate.techniques.length > best.techniques.length) best = candidate
    }
  }
  return best ?? none
}

/** Scan many domains/URLs/emails; return only the impersonation hits. */
export function detectImpersonations(values: string[]): ImpersonationResult[] {
  const seen = new Set<string>()
  const out: ImpersonationResult[] = []
  for (const v of values) {
    const r = detectImpersonation(v)
    if (r.isImpersonation && !seen.has(r.host)) { seen.add(r.host); out.push(r) }
  }
  return out
}
