// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/url-intel.ts
// URL / domain threat intelligence (deterministic, no network/Vertex cost).
// Detects homoglyph + punycode domains, brand look-alikes (edit-distance vs
// known Indian banking/payment/courier brands), shorteners, suspicious TLDs,
// raw-IP URLs, excessive subdomains, and insecure http. (goal 6)
// ─────────────────────────────────────────────────────────────────

export type UrlRisk =
  | 'punycode' | 'non_ascii_homoglyph' | 'shortener' | 'suspicious_tld'
  | 'ip_url' | 'excessive_subdomains' | 'insecure_http' | 'digit_substitution'
  | `brand_lookalike:${string}`

export interface UrlFinding { url: string; host: string; risks: UrlRisk[]; severity: 'info' | 'warn' | 'danger' }

const SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 't.co', 't.me', 'wa.me', 'goo.gl', 'cutt.ly', 'rb.gy', 'is.gd', 'rebrand.ly'])
const SUSPICIOUS_TLD = /\.(xyz|top|click|info|live|buzz|tk|ml|ga|cf|gq|rest|cam|sbs|fit)$/i
// Brand → list of legitimate domains/cores. Look-alikes of the CORE that are
// NOT one of the legit domains are flagged.
const BRANDS: Array<{ core: string; legit: string[] }> = [
  { core: 'sbi', legit: ['sbi.co.in', 'onlinesbi.sbi', 'onlinesbi.com', 'sbi.bank.in'] },
  { core: 'hdfcbank', legit: ['hdfcbank.com', 'hdfc.com'] },
  { core: 'icicibank', legit: ['icicibank.com', 'icici.com'] },
  { core: 'axisbank', legit: ['axisbank.com'] },
  { core: 'paytm', legit: ['paytm.com', 'paytmbank.com'] },
  { core: 'phonepe', legit: ['phonepe.com'] },
  { core: 'amazon', legit: ['amazon.in', 'amazon.com'] },
  { core: 'flipkart', legit: ['flipkart.com'] },
  { core: 'indiapost', legit: ['indiapost.gov.in'] },
  { core: 'netflix', legit: ['netflix.com'] },
]

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (!m) return n; if (!n) return m
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)])
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  }
  return d[m][n]
}

function hostOf(url: string): string {
  let u = url.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  u = u.split(/[/?#]/)[0]
  return u.toLowerCase()
}

export function analyzeUrl(url: string): UrlFinding {
  const host = hostOf(url)
  const risks: UrlRisk[] = []
  const labels = host.split('.')
  const sld = labels.length >= 2 ? labels[labels.length - 2] : host

  if (/^https?:\/\//i.test(url) && url.toLowerCase().startsWith('http://')) risks.push('insecure_http')
  if (/xn--/i.test(host)) risks.push('punycode')
  if (/[^\x00-\x7F]/.test(host)) risks.push('non_ascii_homoglyph')
  if (SHORTENERS.has(host)) risks.push('shortener')
  if (SUSPICIOUS_TLD.test(host)) risks.push('suspicious_tld')
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) risks.push('ip_url')
  if (labels.length >= 5) risks.push('excessive_subdomains')
  // digit-for-letter substitution in the SLD (0->o, 1->l, 3->e, 5->s)
  if (/[013455]/.test(sld) && /[a-z]/.test(sld) && /\d/.test(sld)) risks.push('digit_substitution')

  // Brand look-alike: SLD close to a brand core but the full host isn't legit.
  const sldNorm = sld.replace(/[013455]/g, (c) => ({ '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's' }[c] || c))
  for (const b of BRANDS) {
    if (b.legit.includes(host)) break // exact legit domain — not a look-alike
    const dist = levenshtein(sldNorm, b.core)
    const contains = sldNorm.includes(b.core) || host.includes(b.core)
    if ((dist <= 2 || contains) && !b.legit.some((d) => host === d || host.endsWith('.' + d))) {
      risks.push(`brand_lookalike:${b.core}`)
    }
  }

  const severity: UrlFinding['severity'] = risks.some((r) => r === 'punycode' || r === 'non_ascii_homoglyph' || r.startsWith('brand_lookalike') || r === 'ip_url')
    ? 'danger'
    : risks.length ? 'warn' : 'info'
  return { url, host, risks: Array.from(new Set(risks)), severity }
}

export function analyzeUrls(urls: string[]): UrlFinding[] {
  return urls.map(analyzeUrl).filter((f) => f.risks.length > 0)
}
