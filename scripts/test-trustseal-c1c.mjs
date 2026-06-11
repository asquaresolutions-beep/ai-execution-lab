#!/usr/bin/env node
// C1C tests. Runtime-tests the PURE persistence-policy core (policy.ts — only
// `import type`, loadable standalone) and static-asserts the store/route/config
// wiring (which chains @/-alias imports the node harness can't resolve; the
// next build is the integration proof for those).
// Run: node --experimental-strip-types scripts/test-trustseal-c1c.mjs
import fs from 'node:fs'
import {
  resultTtlSeconds, RESULT_TTL_RISK_SECONDS, RESULT_TTL_CLEAN_SECONDS,
  isExpired, isReusable, engineVersion,
  selectHistoryToPrune, HISTORY_MAX, HISTORY_MAX_AGE_MS,
  publicReport,
} from '../lib/trustseal/verify/policy.ts'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')

// ── asymmetric TTL (freeze §7) ──
ok('high_risk → long TTL (24h)', resultTtlSeconds('high_risk') === RESULT_TTL_RISK_SECONDS && RESULT_TTL_RISK_SECONDS === 86_400)
ok('caution → long TTL (24h)', resultTtlSeconds('caution') === RESULT_TTL_RISK_SECONDS)
ok('verified → short TTL (2h)', resultTtlSeconds('verified') === RESULT_TTL_CLEAN_SECONDS && RESULT_TTL_CLEAN_SECONDS === 7_200)
ok('established → short TTL', resultTtlSeconds('established') === RESULT_TTL_CLEAN_SECONDS)
ok('limited → short TTL (clean-side, re-check soon)', resultTtlSeconds('limited') === RESULT_TTL_CLEAN_SECONDS)
ok('clean TTL strictly shorter than risk TTL (anti-masking)', RESULT_TTL_CLEAN_SECONDS < RESULT_TTL_RISK_SECONDS)

// ── engine versioning / staleness (freeze §11) ──
const now = 1_000_000_000_000
ok('isExpired: past = expired', isExpired(now - 1, now) && !isExpired(now + 1, now))
ok('engineVersion format', engineVersion('1', '1') === 's1-w1')
const fresh = { expiresAt: now + 1000, signalSchemaVersion: '1', weightsVersion: '1' }
ok('reusable: fresh + current engine', isReusable(fresh, '1', '1', now))
ok('not reusable: expired', !isReusable({ ...fresh, expiresAt: now - 1 }, '1', '1', now))
ok('not reusable: signal-schema bump (silent re-baseline)', !isReusable(fresh, '2', '1', now))
ok('not reusable: weights bump', !isReusable(fresh, '1', '2', now))

// ── history retention (freeze §9) ──
const mkRows = (bands, stepMs = 1000) => bands.map((band, i) => ({ id: `r${i}`, checkedAt: now - i * stepMs, band }))
ok('retention: <30 recent rows → prune none', selectHistoryToPrune(mkRows(Array(10).fill('verified')), now).length === 0)
const over = selectHistoryToPrune(mkRows(Array(35).fill('verified')), now)
ok('retention: 35 same-band recent → prune 5 (keep newest 30)', over.length === 5 && over.every((id) => ['r30', 'r31', 'r32', 'r33', 'r34'].includes(id)))
ok('retention: band changes beyond window are kept', selectHistoryToPrune(mkRows([...Array(30).fill('verified'), 'high_risk', 'verified']), now).length === 0)
// older than 180d: non-change pruned, change kept
const oldStep = HISTORY_MAX_AGE_MS + 1000 // 2nd row lands >180d old
ok('retention: >180d non-change pruned', selectHistoryToPrune(mkRows(['verified', 'verified'], oldStep), now).length === 1)
ok('retention: >180d band-change retained', selectHistoryToPrune(mkRows(['verified', 'high_risk'], oldStep), now).length === 0)
ok('HISTORY_MAX = 30 and 180d window', HISTORY_MAX === 30 && HISTORY_MAX_AGE_MS === 180 * 86_400_000)

// ── public projection ──
const vr = {
  id: 'vs_x', domain: 'acme.com', inputDomain: 'www.acme.com', inputName: 'Secret Co', country: 'US',
  band: 'verified', score: 88, baseScore: 88, confidence: 0.9, tier: 'mvp', partial: false,
  checkedAt: now, ttlSeconds: 7200, signalSchemaVersion: '1', weightsVersion: '1',
  opacity: false, caps: [{ rule: 'blocklist', cappedAt: 15, firedBy: 'x' }], badges: ['ssl_verified'],
  categories: [{ category: 'dns', weight: 6, subScore: 100, covered: true, signalCount: 3 }],
  signals: [{ id: 'dns.mx', category: 'dns', status: 'ok', score: 100, value: true, evidence: '1 MX', source: 'dns', observedAt: now }],
}
const pub = publicReport(vr)
ok('publicReport: keeps verdict + score + confidence', pub.band === 'verified' && pub.score === 88 && pub.confidence === 0.9)
ok('publicReport: omits caller input (inputName/country/inputDomain)', !('inputName' in pub) && !('country' in pub) && !('inputDomain' in pub))
ok('publicReport: omits scoring internals (baseScore/caps/opacity)', !('baseScore' in pub) && !('caps' in pub) && !('opacity' in pub))
ok('publicReport: projects per-signal proof', pub.signals[0].id === 'dns.mx' && pub.signals[0].evidence === '1 MX' && pub.categories[0].subScore === 100)

// ── static: persistence.ts ──
const p = read('lib/trustseal/verify/persistence.ts')
ok('persistence: both collections', p.includes("'ts_verifications'") && p.includes("'ts_verification_history'"))
ok('persistence: single-flight WRITE guard (no clobber of newer)', /existing\.checkedAt >= result\.checkedAt/.test(p) && /sameEngine/.test(p))
ok('persistence: history stores per-signal values + statuses', /result\.signals\.map\(/.test(p) && /status: s\.status/.test(p) && /value: s\.value/.test(p))
ok('persistence: retention via selectHistoryToPrune', /selectHistoryToPrune/.test(p))
ok('persistence: gated read uses isReusable', /isReusable\(env/.test(p))
ok('persistence: negative-event purge primitive', /export async function purgeVerification/.test(p) && /\.delete\(VERIFICATIONS/.test(p))
ok('persistence: asymmetric TTL via resultTtlSeconds', /resultTtlSeconds\(result\.band\)/.test(p))
ok('persistence: history TTL field for Firestore TTL', /expiresAt: result\.checkedAt \+ HISTORY_MAX_AGE_MS/.test(p))

// ── static: service.ts ──
const s = read('lib/trustseal/verify/service.ts')
ok('service: read-through cache (readVerification)', /readVerification\(id, now\)/.test(s) && /fromCache: true/.test(s))
ok('service: service-level single-flight map', /inflight = new Map/.test(s) && /inflight\.get\(key\)/.test(s) && /inflight\.delete\(key\)/.test(s))
ok('service: runs verifyBusiness with MVP_COLLECTORS', /verifyBusiness\(rawDomain, \{ collectors: MVP_COLLECTORS \}/.test(s))
ok('service: stamps asymmetric TTL then persists', /resultTtlSeconds\(result\.band\)/.test(s) && /writeVerification\(stamped, now\)/.test(s))
ok('service: getStoredReport for the live seal/report', /export async function getStoredReport/.test(s) && /readEnvelope\(/.test(s) && /stale:/.test(s))
ok('service: InvalidDomainError on bad domain', /throw new InvalidDomainError/.test(s))

// ── static: POST /api/trustseal/verify ──
const rv = read('app/api/trustseal/verify/route.ts')
ok('verify route: POST handler, dynamic', /export async function POST/.test(rv) && /force-dynamic/.test(rv))
ok('verify route: IP rate-limit', /enforceRateLimit\(\{ key: `trustseal:verify:\$\{ip\}`/.test(rv))
ok('verify route: 429 on RateLimitError + retry-after', /instanceof RateLimitError/.test(rv) && /status: 429/.test(rv) && /'retry-after'/.test(rv))
ok('verify route: 400 on InvalidDomainError', /instanceof InvalidDomainError/.test(rv) && /status: 400/.test(rv))
ok('verify route: returns public projection only', /publicReport\(outcome\)/.test(rv))
ok('verify route: reports unexpected errors', /reportError\('api\.trustseal\.verify'/.test(rv))

// ── static: GET /api/trustseal/report/[domain] ──
const rr = read('app/api/trustseal/report/[domain]/route.ts')
ok('report route: GET handler', /export async function GET/.test(rr))
ok('report route: reads persisted (no recompute) via getStoredReport', /getStoredReport\(/.test(rr) && !/verifyBusiness/.test(rr))
ok('report route: 404 when never verified', /status: 404/.test(rr) && /not_found/.test(rr))
ok('report route: public projection + stale flag', /publicReport\(found\.report\)/.test(rr) && /stale: found\.stale/.test(rr))
ok('report route: Next 15 async params', /params: Promise<\{ domain: string \}>/.test(rr) && /await params/.test(rr))

// ── static: config + indexes ──
const idx = read('firestore.indexes.json')
ok('firestore index: ts_verification_history (domain ASC, checkedAt DESC)', /ts_verification_history/.test(idx) && /"fieldPath": "domain"[\s\S]*"fieldPath": "checkedAt"[\s\S]*"DESCENDING"/.test(idx))
const cfg = read('next.config.mjs')
ok('next.config: traces the PSL .dat into the trustseal functions', /'\/api\/trustseal\/\*\*': \['\.\/lib\/trustseal\/verify\/public_suffix_list\.dat'\]/.test(cfg))

console.log(`\ntrustseal-c1c: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
