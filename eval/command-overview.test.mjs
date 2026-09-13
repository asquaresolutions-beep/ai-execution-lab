// eval/command-overview.test.mjs
//
// Offline tests for the live Command Center:
//   • GET /api/trustseal/command/overview authorization (401 / 401 / 403 / 200)
//   • live vs preview mode decided from real server-side account state
//   • data isolation between accounts (claims, alerts, verification history)
//   • the browser cannot choose the account or domains
//   • read-only: no store writes, no outbound calls, no platform analytics
//   • view-model: metrics/network/search derive only from the loaded overview
//   • fixture honesty: sample UI uses fictional *.example.test names only
//
// The store is an in-memory store wrapped in a recorder, so isolation and
// read-only behaviour are asserted from OBSERVED access. fetch answers only the
// Google cert URL (for token verification); any other URL is a violation. Tokens
// are signed with a key generated per run. All identifiers are obvious fakes.
//
// Run: node --test --import ./eval/hooks.mjs eval/command-overview.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { generateKeyPairSync, createSign } from 'node:crypto'

process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project'
delete process.env.FIREBASE_PROJECT_ID
delete process.env.FIREBASE_API_KEY
delete process.env.TRUSTSEAL_SEAL_SECRET

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const imp = (p) => import(pathToFileURL(B + p).href)
const src = (p) => readFileSync(B + p, 'utf8')

// ── fetch stub: only Google's token-verification certs ─────────────
const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
const KID = 'test-kid'
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const violations = []
globalThis.fetch = async (url) => {
  if (String(url) === CERT_URL) return new Response(JSON.stringify({ [KID]: publicKey.export({ type: 'spki', format: 'pem' }) }), { status: 200, headers: { 'cache-control': 'max-age=3600' } })
  violations.push(String(url))
  return new Response('{}', { status: 500 })
}

// ── recording store ────────────────────────────────────────────────
const { setStore } = await imp('lib/store/adapter.ts')
const { MemoryStore } = await imp('lib/store/memory-store.ts')
const mem = new MemoryStore()
let recording = false
let ops = []
const rec = (op, collection, extra = {}) => { if (recording) ops.push({ op, collection, ...extra }) }
setStore({
  name: 'recording-memory',
  set: (c, id, d) => { rec('set', c, { id }); return mem.set(c, id, d) },
  update: (c, id, p) => { rec('update', c, { id }); return mem.update(c, id, p) },
  get: (c, id) => { rec('get', c, { id }); return mem.get(c, id) },
  query: (c, o) => { rec('query', c, { where: o?.where ?? [] }); return mem.query(c, o) },
  delete: (c, id) => { rec('delete', c, { id }); return mem.delete(c, id) },
  increment: (c, id, f, by) => { rec('increment', c, { id }); return mem.increment(c, id, f, by) },
})

const { claimDocId } = await imp('lib/trustseal/claim-policy.ts')
const { writeVerification } = await imp('lib/trustseal/verify/persistence.ts')
const { verifyDocId } = await imp('lib/trustseal/verify/normalize.ts')
const { writeAlert } = await imp('lib/trustseal/monitoring/alerts.ts')
const { certificateId } = await imp('lib/trustseal/certificate.ts')
const VM = await imp('lib/trustseal/command/view-model.ts')
const { GET } = await imp('app/api/trustseal/command/overview/route.ts')

// ── fixtures ───────────────────────────────────────────────────────
const NOW = Date.now()
const DAY = 86_400_000
const UID = { a: 'user-a-fake', b: 'user-b-fake', c: 'user-c-fake', d: 'user-d-fake', e: 'user-e-fake' }
const EMAIL = { a: 'a-person@example.test', b: 'b-person@example.test', c: 'c@example.test', d: 'd@example.test', e: 'e@example.test' }
const DOM = { a: 'alpha-owner.test', aPending: 'alpha-pending.test', b: 'beta-owner.test', e: 'epsilon-owner.test' }
const B_MARKER = 'B-ONLY-ALERT-MARKER'

async function seedClaim(uid, domain, status, createdAt, verifiedAt) {
  await mem.set('ts_claims', claimDocId(domain), { id: claimDocId(domain), domain, accountId: uid, method: 'dns', token: 'fake-token-' + domain, status, createdAt, ...(verifiedAt ? { verifiedAt } : {}), attempts: 1 })
}
async function seedSub(uid, plan) {
  await mem.set('ts_subscriptions', uid, { id: uid, accountId: uid, plan, interval: 'monthly', status: 'active', razorpayCustomerId: null, razorpaySubscriptionId: null, razorpayPlanId: null, currentStart: NOW - 10 * DAY, currentEnd: NOW + 20 * DAY, cancelAtCycleEnd: false, scheduledChange: null, lastEventId: null, lastEventAt: null, updatedAt: NOW })
}
function result(domain, checkedAt, score, band, whoisStatus = 'ok') {
  const signals = [
    { id: 'dns.resolves', category: 'dns', status: 'ok', score: 100, value: 2, evidence: '2 A record(s)', source: 'dns', observedAt: checkedAt },
    { id: 'ssl.valid', category: 'ssl', status: 'ok', score: 80, value: true, source: 'tls', observedAt: checkedAt },
    { id: 'whois.domain_age', category: 'whois', status: whoisStatus, score: 0, source: 'rdap', observedAt: checkedAt },
    { id: 'impersonation.lookalike', category: 'impersonation', status: 'ok', score: 90, value: false, source: 'impersonation', observedAt: checkedAt },
  ]
  const categories = ['reputation', 'legitimacy', 'dns', 'ssl', 'whois', 'web', 'impersonation'].map((c) => ({ category: c, weight: 10, subScore: c === 'dns' ? 100 : c === 'ssl' ? 80 : c === 'impersonation' ? 90 : 50, covered: ['dns', 'ssl', 'impersonation'].includes(c), signalCount: 1 }))
  return { score, baseScore: score, band, confidence: 0.55, categories, caps: [], badges: [], opacity: false, id: verifyDocId(domain), domain, inputDomain: domain, signals, tier: 'mvp', partial: whoisStatus !== 'ok', checkedAt, ttlSeconds: 7200, signalSchemaVersion: '1', weightsVersion: '1' }
}

// A: Pro, 1 verified domain (3 checks, 1 alert) + 1 pending claim
await seedSub(UID.a, 'pro')
await seedClaim(UID.a, DOM.a, 'verified', NOW - 90 * DAY, NOW - 89 * DAY)
await seedClaim(UID.a, DOM.aPending, 'pending', NOW - 2 * DAY)
await writeVerification(result(DOM.a, NOW - 3 * DAY, 74, 'established'), NOW - 3 * DAY)
await writeVerification(result(DOM.a, NOW - 2 * DAY, 69, 'established', 'error'), NOW - 2 * DAY)
await writeVerification(result(DOM.a, NOW - 1 * DAY, 69, 'established', 'error'), NOW - 1 * DAY)
await writeAlert({ accountId: UID.a, domain: DOM.a, kind: 'reverify_due', severity: 'warning', detail: 'Verification is overdue for re-check.', createdAt: NOW - 1 * DAY })
// B: Business, 1 verified domain with a distinctive alert
await seedSub(UID.b, 'business')
await seedClaim(UID.b, DOM.b, 'verified', NOW - 30 * DAY, NOW - 29 * DAY)
await writeVerification(result(DOM.b, NOW - 1 * DAY, 88, 'verified'), NOW - 1 * DAY)
await writeAlert({ accountId: UID.b, domain: DOM.b, kind: 'band_down', severity: 'critical', detail: B_MARKER, from: 'verified', to: 'caution', createdAt: NOW - 5 * 3600_000 })
// C: Pro, no claims · D: no subscription · E: Pro, pending claim only
await seedSub(UID.c, 'pro')
await seedSub(UID.e, 'pro')
await seedClaim(UID.e, DOM.e, 'pending', NOW - 1 * DAY)

// ── helpers ────────────────────────────────────────────────────────
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function token(who, claims = {}) {
  const now = Math.floor(Date.now() / 1000)
  const h = b64u({ alg: 'RS256', kid: KID, typ: 'JWT' })
  const p = b64u({ iss: 'https://securetoken.google.com/test-project', aud: 'test-project', sub: UID[who], email: EMAIL[who], iat: now, exp: now + 3600, ...claims })
  return `${h}.${p}.${createSign('RSA-SHA256').update(`${h}.${p}`).sign(privateKey).toString('base64url')}`
}
async function call(tok, { query = '', headers = {} } = {}) {
  const res = await GET(new Request(`https://trustseal.asquaresolution.com/api/trustseal/command/overview${query}`, {
    headers: { ...(tok ? { authorization: `Bearer ${tok}` } : {}), 'x-forwarded-for': '203.0.113.7', ...headers },
  }))
  const text = await res.text()
  return { status: res.status, cache: res.headers.get('cache-control'), text, body: JSON.parse(text) }
}
async function recorded(fn) {
  ops = []; recording = true
  try { return await fn() } finally { recording = false }
}

// ── 1–3. authorization ─────────────────────────────────────────────
test('auth: no token → 401', async () => {
  const r = await call(null)
  assert.equal(r.status, 401)
  assert.deepEqual(r.body, { error: 'unauthorized' })
  assert.match(r.cache, /no-store/)
})

test('auth: invalid, expired and wrong-audience tokens → 401', async () => {
  for (const t of ['not.a.token', token('a', { exp: Math.floor(Date.now() / 1000) - 60 }), token('a', { aud: 'other-project' })]) {
    const r = await call(t)
    assert.equal(r.status, 401)
    assert.equal(r.body.domains, undefined)
  }
})

test('auth: valid user without Command Center entitlement → 403, no data', async () => {
  const r = await call(token('d'))
  assert.equal(r.status, 403)
  assert.deepEqual(r.body, { entitled: false, error: 'pro_required' })
})

// ── 4–5. mode ─────────────────────────────────────────────────────
test('mode: entitled user with zero domains → preview with honest empty data', async () => {
  const r = await call(token('c'))
  assert.equal(r.status, 200)
  assert.equal(r.body.mode, 'preview')
  assert.deepEqual(r.body.domains, [])
  assert.deepEqual(r.body.network, [])
  assert.deepEqual(r.body.timeline, [])
  assert.equal(r.body.summary.verifiedDomains, 0)
  assert.equal(r.body.entitlement.plan, 'pro')
})

test('mode: a pending claim alone is still preview; the claim is real, with no score or certificate', async () => {
  const r = await call(token('e'))
  assert.equal(r.body.mode, 'preview')
  assert.equal(r.body.domains.length, 1)
  assert.equal(r.body.domains[0].domain, DOM.e)
  assert.equal(r.body.domains[0].status, 'pending')
  assert.equal(r.body.domains[0].report, null)
  assert.equal(r.body.domains[0].certificate, null)
  assert.equal(r.body.summary.pendingClaims, 1)
  assert.deepEqual(r.body.timeline.map((e) => e.kind), ['claim_started'])
})

test('mode: entitled user with a verified domain → live, every value from stored data', async () => {
  const r = await call(token('a'))
  const o = r.body
  assert.equal(r.status, 200)
  assert.equal(o.mode, 'live')
  const alpha = o.domains.find((d) => d.domain === DOM.a)
  assert.equal(alpha.status, 'verified')
  assert.equal(alpha.report.score, 69)
  assert.equal(alpha.report.band, 'established')
  assert.equal(alpha.report.checkedAt, NOW - 1 * DAY)
  assert.equal(alpha.report.partial, true)
  assert.equal(alpha.certificate.id, certificateId(DOM.a, NOW - 89 * DAY))
  const pending = o.domains.find((d) => d.domain === DOM.aPending)
  assert.equal(pending.report, null)
  assert.equal(pending.certificate, null)
  assert.deepEqual(o.verifications.map((v) => v.score), [69, 69, 74], 'history newest-first, real scores')
  assert.deepEqual(o.summary, { verifiedDomains: 1, pendingClaims: 1, certificatesAvailable: 1, monitoredDomains: 1, alerts: { total: 1, unread: 1, critical: 0, warning: 1, info: 0 }, lastCheckedAt: NOW - 1 * DAY })
  assert.equal(o.risk.alerts.length, 1)
  assert.equal(o.risk.alerts[0].kind, 'reverify_due')
  assert.deepEqual(o.risk.signals.map((s) => `${s.id}:${s.status}`), ['whois.domain_age:error'])
  const kinds = o.timeline.map((e) => e.kind)
  for (const k of ['claim_started', 'verified', 'reverified', 'score', 'alert']) assert.ok(kinds.includes(k), k)
  assert.equal(o.network.length, 1)
  assert.equal(o.network[0].domain, DOM.a)
  assert.equal(o.network[0].categories.length, 7)
  assert.equal(o.entitlement.plan, 'pro')
  assert.equal(o.entitlement.monitoring, true)
})

test('mode: Business plan is reported as business (not a hard-coded Pro)', async () => {
  const r = await call(token('b'))
  assert.equal(r.body.mode, 'live')
  assert.equal(r.body.entitlement.plan, 'business')
})

// ── 6–9. isolation ────────────────────────────────────────────────
test('isolation: user A never receives user B claims, alerts or history (and vice versa)', async () => {
  const a = await call(token('a'))
  const b = await call(token('b'))
  for (const leak of [DOM.b, B_MARKER, UID.b, EMAIL.b]) assert.ok(!a.text.includes(leak), `A response leaks ${leak}`)
  for (const leak of [DOM.a, DOM.aPending, UID.a, EMAIL.a, 'overdue for re-check']) assert.ok(!b.text.includes(leak), `B response leaks ${leak}`)
  assert.ok(a.body.verifications.every((v) => v.domain === DOM.a))
  assert.ok(a.body.risk.alerts.every((x) => x.domain === DOM.a))
  assert.ok(b.body.verifications.every((v) => v.domain === DOM.b))
})

test('isolation: the browser cannot choose the account, uid or domains', async () => {
  const plain = await call(token('a'))
  const tampered = await call(token('a'), {
    query: `?uid=${UID.b}&accountId=${UID.b}&domain=${DOM.b}&domains=${DOM.b}&workspace=${UID.b}`,
    headers: { 'x-uid': UID.b, 'x-account-id': UID.b, 'x-domain': DOM.b, 'x-workspace': UID.b },
  })
  const strip = (o) => ({ ...o, generatedAt: 0 })
  assert.deepEqual(strip(tampered.body), strip(plain.body))
  assert.ok(!tampered.text.includes(DOM.b))
  const route = src('app/api/trustseal/command/overview/route.ts').replace(/\/\/.*$/gm, '')
  assert.ok(!/searchParams|req\.url|nextUrl|req\.json|headers\.get/.test(route), 'route reads no client-supplied selector')
  assert.match(route, /buildCommandOverview\(user\.uid\)/, 'account comes from the verified token')
})

test('isolation: the response carries no ids, emails, tokens or alert ids', async () => {
  const a = await call(token('a'))
  for (const s of [UID.a, EMAIL.a, `${UID.a}__`, 'fake-token-', '"accountId"', '"token"', '"uid"', '"email"', 'apiKey', 'tsk_']) assert.ok(!a.text.includes(s), s)
})

// ── 10. read-only, scoped reads, no analytics, no outbound ─────────
test('read-only: overview performs no writes and only account-scoped reads; never platform analytics', async () => {
  await recorded(() => call(token('a')))
  const writes = ops.filter((o) => ['set', 'update', 'delete', 'increment'].includes(o.op))
  assert.deepEqual(writes, [], 'no store writes')
  for (const o of ops) {
    assert.ok(!['ts_api_usage', 'ts_accounts', 'ts_api_keys', 'ts_billing_events', '_errors'].includes(o.collection), `unexpected access to ${o.collection}`)
    if (o.collection === 'ts_claims' && o.op === 'query') assert.deepEqual(o.where.map((w) => [w.field, w.op, w.value]), [['accountId', '==', UID.a]])
    if (o.collection === 'ts_claims' && o.op === 'get') assert.equal(o.id, claimDocId(DOM.a), 'claim reads only for A’s verified domain')
    if (o.collection === 'ts_alerts') assert.deepEqual(o.where.map((w) => [w.field, w.op, w.value]), [['accountId', '==', UID.a]])
    if (o.collection === 'ts_verification_history') assert.deepEqual(o.where.map((w) => [w.field, w.value]), [['domain', DOM.a]])
    if (o.collection === 'ts_verifications') assert.equal(o.id, verifyDocId(DOM.a))
    if (o.collection === 'ts_subscriptions') { assert.equal(o.op, 'get'); assert.equal(o.id, UID.a) }
  }
  assert.ok(ops.some((o) => o.collection === 'ts_claims'), 'reads the existing claims source')
  assert.deepEqual(violations, [], 'no outbound calls besides token-verification certs')
  for (const f of ['lib/trustseal/command/overview.ts', 'app/api/trustseal/command/overview/route.ts']) {
    const s = src(f).replace(/\/\/.*$/gm, '')
    assert.ok(!/analytics|getPlatformAnalytics|ts_api_usage/.test(s), `${f} must not use platform analytics`)
    assert.ok(!/verify\/service|getVerification|verify\/registry|trustseal\/verify'|reportError/.test(s), `${f} must not run verification or write error records`)
  }
})

test('failure: a store outage returns 500 without sample data or writes', async () => {
  const failing = { ...mem, name: 'failing', query: async () => { throw new Error('store down') }, get: (c, id) => mem.get(c, id), set: () => { throw new Error('write attempted') } }
  setStore(failing)
  try {
    const r = await call(token('a'))
    assert.equal(r.status, 500)
    assert.deepEqual(r.body, { error: 'overview_unavailable' })
  } finally {
    setStore({ name: 'recording-memory', set: (c, id, d) => { rec('set', c, { id }); return mem.set(c, id, d) }, update: (c, id, p) => mem.update(c, id, p), get: (c, id) => { rec('get', c, { id }); return mem.get(c, id) }, query: (c, o) => { rec('query', c, { where: o?.where ?? [] }); return mem.query(c, o) }, delete: (c, id) => mem.delete(c, id), increment: (c, id, f, by) => mem.increment(c, id, f, by) })
  }
})

// ── view-model ─────────────────────────────────────────────────────
test('view-model: mode, metrics and network derive only from the overview', async () => {
  assert.equal(VM.commandMode(0), 'preview')
  assert.equal(VM.commandMode(1), 'live')
  const o = (await call(token('a'))).body
  const m = VM.liveMetrics(o)
  assert.deepEqual(m.map((x) => [x.k, x.v]), [['Verified', '1'], ['Pending claims', '1'], ['Monitored', '1'], ['Unread alerts', '1']])
  assert.ok(m.every((x) => !('delta' in x) && !('spark' in x)), 'no invented deltas or sparklines')
  assert.deepEqual(VM.liveMetrics({ ...o, entitlement: { ...o.entitlement, monitoring: false } })[2], { k: 'Monitored', v: '—', unit: 'not in plan', tone: 'dim' })
  const d = VM.primaryDomain(o)
  assert.equal(d.domain, DOM.a)
  const nodes = VM.categoryNodes(d)
  assert.deepEqual(nodes.map((n) => n.category), d.report.categories.map((c) => c.category), 'nodes are exactly the domain’s categories')
  assert.ok(nodes.every((n) => !/\.(test|com|net|io)/.test(n.id)), 'no domain nodes are invented')
  assert.equal(nodes.find((n) => n.category === 'whois').id, 'WHOIS n/a')
  assert.deepEqual(VM.categoryNodes(null), [])
})

test('view-model: search covers domains, statuses, alerts, signals and timeline — only loaded data', async () => {
  const o = (await call(token('a'))).body
  assert.equal(VM.searchOverview(o, '').total, 0)
  assert.equal(VM.searchOverview(o, DOM.a.split('-')[0]).domains.length, 2)
  assert.equal(VM.searchOverview(o, 'pending').domains[0].domain, DOM.aPending)
  assert.equal(VM.searchOverview(o, 'overdue').alerts.length, 1)
  assert.equal(VM.searchOverview(o, 'whois').signals.length, 1)
  assert.ok(VM.searchOverview(o, 'ownership verified').timeline.length >= 1)
  assert.equal(VM.searchOverview(o, 'established 74').verifications.length, 1)
  assert.equal(VM.searchOverview(o, DOM.b).total, 0)
})

// ── fixture honesty / UI wiring (static) ───────────────────────────
test('fixtures: sample UI uses fictional *.example.test names only; no operational claims', () => {
  const dir = 'components/trustseal/command/'
  for (const f of readdirSync(B + dir).filter((x) => /\.tsx?$/.test(x))) {
    const s = src(dir + f)
    const names = [...s.matchAll(/['"`]([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|dev|app|gg|co|sh|top|in|ai|xyz|test))['"`]/g)].map((m) => m[1])
    for (const n of names) assert.ok(n === 'example.test' || n.endsWith('.example.test'), `${f}: non-reserved domain "${n}"`)
    assert.ok(!/OPERATIONAL|uplink stable/.test(s), `${f}: operational wording`)
  }
})

test('UI wiring: SAMPLE badge, preview banner and sample overview render only in preview mode', () => {
  const cc = src('components/trustseal/command/command-center.tsx')
  assert.match(cc, /\{preview && <LiveDot label="SAMPLE" \/>\}/)
  assert.match(cc, /\{preview && \(\s*<div[^>]*>[\s\S]*?Preview · sample data/)
  assert.match(cc, /active === 'Overview' && \(live\s*\?\s*<LiveOverview[\s\S]*?:\s*<PreviewOverview/)
  assert.match(cc, /useCommandOverview\(user\?\.idToken\)/)
  assert.ok(!/<input readOnly/.test(cc), 'search is no longer a read-only placeholder')
  const live = cc.slice(cc.indexOf('function LiveOverview'), cc.indexOf('export function CommandCenter'))
  assert.ok(!/SAMPLE_|sample\.feed|sample topology|<RiskPanel|score=\{94\}/.test(live), 'live overview uses no sample fixtures')
  const search = src('components/trustseal/command/command-search.tsx')
  assert.ok(!/fetch\(|\/api\//.test(search), 'search makes no requests')
  assert.match(search, /e\.key === 'Enter'\) e\.preventDefault\(\)/)
  const menu = src('components/trustseal/command/account-menu.tsx')
  assert.ok(!/user\?\.email|\.email\b/.test(menu), 'account menu never renders the email')
  assert.match(menu, /signOut\(\)/)
  const sections = src('components/trustseal/command/command-sections.tsx')
  assert.ok(!/v="Pro"|v="Owner"|Managed in account/.test(sections), 'settings not hard-coded')
})
