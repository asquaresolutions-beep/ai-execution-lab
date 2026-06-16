#!/usr/bin/env node
// TrustSeal Phase 3 — certificates, trust-history timeline, Trust Center.
// buildTimeline is pure → runtime-tested; the rest are static-source assertions
// (tsc + next build are the compile proof). Run: node --experimental-strip-types scripts/test-trustseal-phase3.mjs
import fs from 'node:fs'
import { buildTimeline } from '../lib/trustseal/timeline.ts'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const exists = (p) => fs.existsSync(new URL('../' + p, import.meta.url))

// ── Trust history timeline: pure derivation (Part 2) ──────────────
const V = 1_000_000_000_000
const sig = (ssl, dns) => [{ id: 'ssl.valid', status: ssl }, { id: 'dns.resolves', status: dns }]
const rows = [
  { checkedAt: V, band: 'verified', score: 80, signals: sig('ok', 'ok') },           // coincides with verifiedAt → no dup
  { checkedAt: V + 86400000, band: 'verified', score: 85, signals: sig('ok', 'ok') }, // score change
  { checkedAt: V + 2 * 86400000, band: 'established', score: 85, signals: sig('ok', 'ok') }, // band change
  { checkedAt: V + 3 * 86400000, band: 'established', score: 85, signals: sig('expired', 'ok') }, // ssl change
]
const ev = buildTimeline(V, rows)
ok('timeline: newest-first', ev.length >= 2 && ev[0].at >= ev[ev.length - 1].at)
ok('timeline: starts from ownership "verified" event', ev.some((e) => e.kind === 'verified' && e.at === V))
ok('timeline: detects score change', ev.some((e) => e.kind === 'score' && e.from === '80' && e.to === '85'))
ok('timeline: detects band change', ev.some((e) => e.kind === 'band' && e.from === 'verified' && e.to === 'established'))
ok('timeline: detects ssl change', ev.some((e) => e.kind === 'ssl' && e.to === 'expired'))
ok('timeline: no duplicate reverified at the ownership instant', !ev.some((e) => e.kind === 'reverified' && e.at === V))
ok('timeline: empty history → single ownership event', buildTimeline(V, []).length === 1)

// seal exposes getSealTimeline; page passes it; view renders it
ok('timeline: getSealTimeline read path (store-only)', /export async function getSealTimeline/.test(read('lib/trustseal/seal.ts')) && /readVerificationHistory/.test(read('lib/trustseal/seal.ts')))
const persistence = read('lib/trustseal/verify/persistence.ts')
ok('timeline: persistence exposes public history read', /export async function readVerificationHistory/.test(persistence))
// Regression guard: readVerificationHistory must NOT use where+orderBy (needs a
// composite index that isn't provisioned → would throw on the public seal page).
ok('timeline: history read is equality-only (no composite-index orderBy)', (() => {
  const m = persistence.match(/export async function readVerificationHistory[\s\S]*?\n}/)
  return m && !/orderBy/.test(m[0]) && /\.sort\(/.test(m[0])
})())
ok('timeline: getSealTimeline is fail-safe (try/catch → [])', /try \{[\s\S]*readVerificationHistory[\s\S]*\} catch/.test(read('lib/trustseal/seal.ts')))
const sv = read('components/trustseal/seal-view.tsx')
ok('timeline: seal page renders timeline section', /timeline\.heading/.test(sv) && /timeline\?: TimelineEvent/.test(sv))
for (const f of ['en','hi','es','ar']) ok(`timeline: ${f} has timeline namespace`, /\btimeline:\s*\{/.test(read(`lib/trustseal/messages/${f}.ts`)))

// ── Verification certificates (Part 1) ────────────────────────────
ok('cert: certificate builder exists', exists('lib/trustseal/certificate.ts'))
const cert = read('lib/trustseal/certificate.ts')
ok('cert: deterministic Certificate ID', /export function certificateId/.test(cert) && /TS-/.test(cert))
ok('cert: tamper-evident fingerprint (sha256) + signature', /createHash\('sha256'\)/.test(cert) && /fingerprint/.test(cert) && /signSeal/.test(cert))
ok('cert: QR of the verification URL', /qrEncode/.test(cert) && /qrSvg/.test(cert))
ok('cert: reverification due date computed', /reverifyDue/.test(cert))
ok('cert: route exists + dynamic', exists('app/trustseal/[locale]/certificate/[domain]/page.tsx') && /force-dynamic/.test(read('app/trustseal/[locale]/certificate/[domain]/page.tsx')))
const cv = read('components/trustseal/certificate/certificate-view.tsx')
ok('cert: view renders ID/dates/score/level/QR/URL/signature/fingerprint', ['cert.certificateId','cert.verifiedOn','cert.reverifyDue','cert.trustScore','cert.trustLevel','cert.verificationUrl','cert.fingerprint','cert.issuedBy'].every((k) => cv.includes(k)) && /qrSvg/.test(cv))
ok('cert: A Square Solutions signature block', /A Square Solutions/.test(cv))
ok('cert: print CSS hides chrome (download → PDF)', /@media print/.test(cv) && /window\.print/.test(read('components/trustseal/certificate/print-button.tsx')))
ok('cert: Download button on seal page + dashboard', /cert\.downloadCertificate/.test(sv) && /cert\.downloadCertificate/.test(read('components/trustseal/claims-list.tsx')))
for (const f of ['en','hi','es','ar']) ok(`cert: ${f} has cert namespace`, /\bcert:\s*\{/.test(read(`lib/trustseal/messages/${f}.ts`)))

// ── Trust Center authority (Part 5) ───────────────────────────────
ok('trust-center: route exists + indexable', exists('app/trustseal/[locale]/trust-center/page.tsx') && /index: true/.test(read('app/trustseal/[locale]/trust-center/page.tsx')))
const tc = read('lib/trustseal/content/trust-center.ts')
ok('trust-center: methodology/standards/framework/signal library covered', /[Mm]ethodology|पद्धति|metodología|منهجية/.test(tc) && /[Ss]ignal library|सिग्नल|señales|الإشارات/.test(tc))
ok('trust-center: all 4 locales', /\ben:\s*\{/.test(tc) && /\bhi:\s*\{/.test(tc) && /\bes:\s*\{/.test(tc) && /\bar:\s*\{/.test(tc))
ok('trust-center: linked internally (footer)', /nav\.trustCenter/.test(read('components/trustseal/site-footer.tsx')))

console.log(`\nPhase-3 tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
