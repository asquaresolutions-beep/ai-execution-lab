// eval/trustseal-reputation-policy.test.mjs
//
// Regression tests for the TrustSeal reputation policy after ScamCheck Fix 3/4
// (audit 2026-10-04).
//
// ScamCheck now trusts only EXACT official hosts (a link to sites.google.com or
// <x>.gov.in proves nothing). TrustSeal asks a different question — "is this
// registrable domain an official organisation's?" — and always passes the
// canonical registrable domain (normalizeDomain → eTLD+1). The products therefore
// share strict hostname parsing but keep separate trust policies:
//   - domainReputation()            → ScamCheck, exact host (or www.host)
//   - registrableDomainReputation() → TrustSeal, exact registrable domain, plus
//                                     organisation-level domains (google.com,
//                                     microsoft.com). NO blanket gov.in rule:
//                                     arbitrary <x>.gov.in stays unknown.
//
// Offline and side-effect free: real normalizeDomain, reputation collector and
// scoreVerification; every fetch fails the test; other categories use fixed
// synthetic signals (no DNS/TLS/RDAP/blocklist network calls).
//
// Run: node --test --import ./eval/hooks.mjs eval/trustseal-reputation-policy.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const imp = (p) => import(pathToFileURL(B + p).href)

const fetchCalls = []
globalThis.fetch = async (url) => { fetchCalls.push(String(url)); throw new Error(`network blocked in test: ${url}`) }

const { domainReputation, registrableDomainReputation } = await imp('lib/scam-intel/reputation.ts')
const { normalizeDomain } = await imp('lib/trustseal/verify/normalize.ts')
const { reputationCollector } = await imp('lib/trustseal/verify/collectors/reputation.ts')
const { scoreVerification } = await imp('lib/trustseal/verify/score.ts')

const now = Date.now()
async function repSignal(claimed) {
  const norm = normalizeDomain(claimed)
  assert.ok(norm, `normalizeDomain(${claimed}) returned null`)
  const out = await reputationCollector.collect({ domain: norm.canonical, now })
  return { canonical: norm.canonical, sig: out.signals[0] }
}
// Fixed synthetic "healthy domain" signals for every other category (no network).
const OTHER = [
  { id: 'whois.domain_age', category: 'whois', status: 'ok', score: 90, value: true },
  { id: 'ssl.valid', category: 'ssl', status: 'ok', score: 90, value: true },
  { id: 'dns.resolves', category: 'dns', status: 'ok', score: 90, value: true },
  { id: 'legit.x', category: 'legitimacy', status: 'ok', score: 80, value: true },
  { id: 'web.x', category: 'web', status: 'ok', score: 80, value: true },
  { id: 'impersonation.lookalike', category: 'impersonation', status: 'ok', score: 90, value: false },
]

// ── Policy separation (unit) ─────────────────────────────────────────────────
test('separation: organisation domains are trusted for TrustSeal but not for ScamCheck links', () => {
  for (const d of ['google.com', 'microsoft.com']) {
    assert.equal(registrableDomainReputation(d).reputation, 'trusted', `TrustSeal ${d}`)
    assert.equal(domainReputation(d).reputation, 'unknown', `ScamCheck ${d}`)
  }
})
test('separation: Google-hosted pages are never trusted by the ScamCheck policy', () => {
  for (const h of ['sites.google.com', 'docs.google.com', 'https://sites.google.com/view/x']) assert.equal(domainReputation(h).reputation, 'unknown', h)
})
test('separation: TrustSeal policy is exact on the registrable domain (no subdomain or gov.in wildcard)', () => {
  for (const d of ['example.gov.in', 'gov.in', 'sites.google.com', 'evil.google.com', 'learn.microsoft.com', 'google.com.evil.example'])
    assert.notEqual(registrableDomainReputation(d).reputation, 'trusted', d)
})
test('separation: shared strict parsing — ambiguous input is never trusted by either policy', () => {
  for (const d of ['https://user@google.com', 'google.com:8443', 'evil.example\\.google.com', 'ftp://google.com'])
    assert.notEqual(registrableDomainReputation(d).reputation, 'trusted', d)
})
test('both policies trust the explicit official list (incl. the three reporting/regulator sites)', () => {
  for (const d of ['sbi.co.in', 'hdfcbank.com', 'incometax.gov.in', 'uidai.gov.in', 'indiapost.gov.in', 'cybercrime.gov.in', 'sancharsaathi.gov.in', 'sebi.gov.in', 'asquaresolution.com']) {
    assert.equal(registrableDomainReputation(d).reputation, 'trusted', `TrustSeal ${d}`)
    assert.equal(domainReputation(d).reputation, 'trusted', `ScamCheck ${d}`)
  }
})

// ── TrustSeal collector: score + user-visible evidence per claimed domain ─────
const EXPECT = [
  // [claimed input, canonical, score, evidence]
  ['https://google.com', 'google.com', 92, 'official/verified domain'],
  ['sites.google.com', 'google.com', 92, 'official/verified domain'],          // registrable domain is Google's own
  ['learn.microsoft.com', 'microsoft.com', 92, 'official/verified domain'],
  ['incometax.gov.in', 'incometax.gov.in', 92, 'official/verified domain'],
  ['www.uidai.gov.in', 'uidai.gov.in', 92, 'official/verified domain'],
  ['indiapost.gov.in', 'indiapost.gov.in', 92, 'official/verified domain'],
  ['https://netbanking.hdfcbank.com/x', 'hdfcbank.com', 92, 'official/verified domain'],
  ['trustseal.asquaresolution.com', 'asquaresolution.com', 92, 'A Square Solutions first-party domain'],
  ['compromised.example.gov.in', 'example.gov.in', 55, 'no reputation data'],  // no blanket gov.in trust
  ['randomshop-deals.com', 'randomshop-deals.com', 55, 'no reputation data'],
]
for (const [claimed, canonical, score, evidence] of EXPECT) {
  test(`collector: ${claimed} → ${canonical} scores ${score} ("${evidence}")`, async () => {
    const { canonical: c, sig } = await repSignal(claimed)
    assert.equal(c, canonical)
    assert.equal(sig.id, 'reputation.intel_graph'); assert.equal(sig.status, 'ok')
    assert.equal(sig.score, score); assert.equal(sig.evidence, evidence)
  })
}

// ── TrustSeal overall band with otherwise-healthy signals ────────────────────
test('band: google.com / microsoft.com keep their pre-Fix-4 result (87, verified)', async () => {
  for (const d of ['google.com', 'microsoft.com']) {
    const { sig } = await repSignal(d)
    const s = scoreVerification({ signals: [sig, ...OTHER] })
    assert.equal(s.score, 87, d); assert.equal(s.band, 'verified', d)
  }
})
test('band: arbitrary example.gov.in is not lifted by a gov.in rule (78, established)', async () => {
  const { sig } = await repSignal('compromised.example.gov.in')
  const s = scoreVerification({ signals: [sig, ...OTHER] })
  assert.equal(s.score, 78); assert.equal(s.band, 'established')
})

test('collector still imports from the shared scam-intel reputation module', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(B + 'lib/trustseal/verify/collectors/reputation.ts', 'utf8')
  assert.match(src, /import \{ registrableDomainReputation \} from '@\/lib\/scam-intel\/reputation'/)
})

test('no network calls were attempted', () => {
  assert.deepEqual(fetchCalls, [])
})
