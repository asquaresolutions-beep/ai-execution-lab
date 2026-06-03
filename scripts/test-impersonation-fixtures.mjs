#!/usr/bin/env node
// Fixtures for brand-impersonation detection — mirrors lib/scam-intel/impersonation.ts
// (keep in sync). Verifies look-alikes flag and legitimate domains do not.
// Run: node scripts/test-impersonation-fixtures.mjs

const BRANDS = [
  { core: 'asquaresolution', legit: ['asquaresolution.com', 'scamcheck.asquaresolution.com', 'trustseal.asquaresolution.com'] },
  { core: 'hdfcbank', legit: ['hdfcbank.com', 'hdfc.com'] },
  { core: 'sbi', legit: ['sbi.co.in', 'onlinesbi.sbi', 'sbicard.com'] },
  { core: 'icicibank', legit: ['icicibank.com'] },
  { core: 'axisbank', legit: ['axisbank.com'] },
  { core: 'paytm', legit: ['paytm.com'] },
  { core: 'phonepe', legit: ['phonepe.com'] },
]
const SUS_TLD = /\.(xyz|top|click|info|live|buzz|tk|ml|ga|online|site)$/i
const HOMO = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '$': 's', 'а': 'a', 'е': 'e', 'о': 'o', 'ѕ': 's', 'і': 'i' }
const fold = (s) => Array.from(s.toLowerCase()).map((c) => HOMO[c] ?? c).join('')
function lev(a, b) { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let p = [...Array(n + 1).keys()]; for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c } return p[n] }
function hostFrom(input) { let s = input.trim().toLowerCase(); if (s.includes('@') && !s.includes('/')) s = s.split('@').pop(); s = s.replace(/^h(?:tt|xx)ps?:\/\//, '').replace(/^www\./, '').replace(/\[\.\]/g, '.'); return s.split(/[/?#:]/)[0] }
function detect(input) {
  const host = hostFrom(input); if (!host.includes('.')) return { imp: false }
  const labels = host.split('.'); const sld = labels[labels.length - 2] || host; const root = labels.slice(-2).join('.'); const sub = labels.slice(0, -2)
  const foldedSld = fold(sld).replace(/[^a-z0-9]/g, ''); const strippedSld = sld.replace(/[^a-z0-9]/g, '')
  for (const b of BRANDS) {
    if (b.legit.some((d) => host === d || host.endsWith('.' + d))) return { imp: false }
    const t = new Set()
    if (strippedSld === b.core && sld !== b.core) t.add('separator-insertion')
    if (foldedSld === b.core && strippedSld !== b.core) t.add('homoglyph')
    if (strippedSld === b.core && !b.legit.some((d) => root === d)) t.add('wrong-tld')
    if (b.core.length >= 5) { const d = lev(foldedSld, b.core); if (d >= 1 && d <= 2) t.add('typosquat') }
    const subTokens = sub.flatMap((l) => fold(l).split(/[^a-z0-9]+/))
    if (subTokens.includes(b.core) && !b.legit.some((d) => root === d)) t.add('deceptive-subdomain')
    const sldTokens = fold(sld).split(/[^a-z0-9]+/)
    if ((sldTokens.includes(b.core) || (b.core.length >= 5 && foldedSld.includes(b.core))) && !b.legit.some((d) => root === d) && (SUS_TLD.test(host) || sub.length > 0 || sld !== b.core)) t.add('brand-keyword-suspicious')
    if (t.size) return { imp: true, brand: b.core, techniques: [...t] }
  }
  return { imp: false }
}

const FIX = [
  { v: 'support@asquaresolutlon.com', imp: true },   // typosquat (i→l)
  { v: 'support@asquare-solution.com', imp: true },   // separator insertion
  { v: 'sbi-verify-login.xyz', imp: true },           // brand keyword + suspicious tld
  { v: 'hdfcbank.secure-login.top', imp: true },      // deceptive subdomain
  { v: 'phonepe-rewards.top', imp: true },            // brand keyword + suspicious tld
  { v: 'scamcheck-asquaresolution.com.xyz', imp: true }, // deceptive multi-label + suspicious tld
  { v: 'pаytm.com', imp: true },                      // homoglyph (cyrillic а)
  { v: 'support@asquaresolution.com', imp: false },   // legit
  { v: 'alerts@hdfcbank.com', imp: false },           // legit
  { v: 'https://sbi.co.in/login', imp: false },       // legit
  { v: 'https://www.icicibank.com', imp: false },     // legit
]
let fail = 0
for (const f of FIX) {
  const r = detect(f.v); const ok = r.imp === f.imp
  if (!ok) fail++
  console.log(`${ok ? '✓' : '✗'} ${f.v.padEnd(34)} ${r.imp ? `IMPERSONATION (${r.brand}: ${r.techniques.join(',')})` : 'clean'}`)
}
console.log(`\n${FIX.length - fail}/${FIX.length} passed${fail ? ' — FAILURES' : ''}`)
process.exit(fail ? 1 : 0)
