#!/usr/bin/env node
// TrustSeal Phase 2 — Badge V2 (5 bands), Explainable Trust Score, Public Trust API.
// Static-source assertions (these modules use @/ imports → not node-loadable; tsc
// + next build are the compile proof). Run: node scripts/test-trustseal-phase2.mjs
import fs from 'node:fs'
let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const exists = (p) => fs.existsSync(new URL('../' + p, import.meta.url))

// ── Badge V2: shared band meta (Part 1) ───────────────────────────
const band = read('lib/trustseal/band.ts')
for (const b of ['verified', 'established', 'limited', 'caution', 'high_risk']) {
  ok(`band: '${b}' has color + icon + labelKey`, new RegExp(`${b}:\\s*\\{[^}]*color:[^}]*icon:[^}]*labelKey:`).test(band))
}
ok('band: 5 distinct colors (green/blue/purple/amber/red)', ['#34d399','#22d3ee','#a78bfa','#fbbf24','#f87171'].every((c) => band.includes(c)))
ok('band: bandMeta() + BANDS_ORDERED exported', /export function bandMeta/.test(band) && /BANDS_ORDERED/.test(band))

// badge.js loader renders all bands (color + icon + wording)
const badge = read('app/api/trustseal/badge.js/route.ts')
ok('badge.js: band-driven color/icon/wording (all 5)', ['verified','established','limited','caution','high_risk'].every((b) => badge.includes(b + ':')))
ok('badge.js: colors per band + data-band attribute', /data-band/.test(badge) && /var band=/.test(badge))

// seal page renders band chip + icon via bandMeta
const seal = read('components/trustseal/seal-view.tsx')
ok('seal: uses bandMeta for color/icon chip', /bandMeta/.test(seal) && /meta\.color/.test(seal) && /meta\.icon/.test(seal))

// ── Explainable trust score (Part 3) ──────────────────────────────
ok('explain: seal renders score breakdown (categories + subScore bars)', /seal\.scoreBreakdown/.test(seal) && /c\.subScore/.test(seal) && /c\.covered/.test(seal))
ok('explain: seal renders reasoning (per-signal evidence)', /seal\.reasoning/.test(seal) && /s\.evidence/.test(seal))
ok('explain: seal shows confidence level', /seal\.confidence/.test(seal))
for (const f of ['en', 'hi', 'es', 'ar']) {
  const src = read(`lib/trustseal/messages/${f}.ts`)
  ok(`explain: ${f} has scoreBreakdown/reasoning/confidenceLevel keys`, /scoreBreakdown:/.test(src) && /reasoning:/.test(src) && /confidenceLevel:/.test(src))
}

// ── Public Trust API (Part 4) ─────────────────────────────────────
ok('api: GET /api/trust/[domain] route exists', exists('app/api/trust/[domain]/route.ts'))
const api = read('app/api/trust/[domain]/route.ts')
ok('api: reuses getSealData (SSRF-free)', /getSealData/.test(api) && !/node:dns/.test(api))
ok('api: returns status/trustLevel/score/sealUrl + breakdown', /trustLevel/.test(api) && /score/.test(api) && /sealUrl/.test(api) && /breakdown/.test(api))
ok('api: CORS + cache headers', /access-control-allow-origin/.test(api) && /s-maxage/.test(api))
ok('api: rate limited (429 + headers)', /rateLimit/.test(api) && /429/.test(api) && /x-ratelimit-limit/.test(api))
ok('api: unverified domain → 200 unverified (not 404 leak)', /verified: false/.test(api) && /'unverified'/.test(api))
const rl = read('lib/trustseal/rate-limit.ts')
ok('api: rate-limit util (fixed window + clientIp)', /export function rateLimit/.test(rl) && /export function clientIp/.test(rl))

// docs document the live API
const docs = read('lib/trustseal/content/docs.ts')
ok('api: documented in docs (GET /api/trust/{domain})', /\/api\/trust\/\{domain\}/.test(docs))

console.log(`\nPhase-2 tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
