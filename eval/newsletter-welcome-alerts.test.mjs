// eval/newsletter-welcome-alerts.test.mjs   (asq-welcome-alerts-v1)
//
// Offline tests for the fixes made after the 9 Nov separate-agent reviews:
//   A1–A4  welcome F-01: a provider refusal of the ACCOUNT (401/403) is not an attempt for anyone and stops the
//          run; the same definite refusal twice in a row stops the run; subscriber-specific refusals still go on;
//          after the provider is fixed, everyone is sent normally and nobody was put in manual review;
//   A5–A6  the alert rules (welcomeAttention) and the cron route that raises them;
//   A7–A8  quota F-06: an unreadable shared budget is logged (no address), on both the drip and the campaign path.
//
// Same harness as eval/newsletter-daily-quota.test.mjs: an in-memory store with Firestore-like reads and one
// injectable fault, and a stubbed provider (no I/O; any other request is a violation). Synthetic addresses only.
//
// Run: node --test --import ./eval/hooks.mjs eval/newsletter-welcome-alerts.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'

process.env.RESEND_API_KEY = 'test-key-not-a-real-secret'
// The logger reads LOG_LEVEL at load. Production leaves it unset (default 'info', so warnings are written);
// pin it here so a runner that sets LOG_LEVEL=error cannot hide the warnings A7 checks.
process.env.LOG_LEVEL = 'info'
process.env.CAMPAIGN_SENDS_ENABLED = 'true'
process.env.VERCEL_ENV = 'production'
delete process.env.WEEKLY_DIGEST_ENABLED
delete process.env.PUBLIC_APP_URL
delete process.env.MAIL_PHYSICAL_ADDRESS
delete process.env.EMAIL_FROM
delete process.env.FIREBASE_PROJECT_ID
delete process.env.FIREBASE_API_KEY

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const imp = (p) => import(pathToFileURL(B + p).href)

const RESEND_URL = 'https://api.resend.com/emails'
const provider = { requests: [], violations: [], respond: null }
globalThis.fetch = async (url, init) => {
  const u = String(url), method = String(init?.method || 'GET').toUpperCase()
  if (u !== RESEND_URL || method !== 'POST') { provider.violations.push(`${method} ${u}`); return new Response('{}', { status: 500 }) }
  const body = JSON.parse(String(init?.body ?? '{}'))
  const req = { n: provider.requests.length + 1, to: Array.isArray(body.to) ? body.to[0] : body.to, key: (init?.headers || {})['Idempotency-Key'] ?? null }
  provider.requests.push(req)
  const status = provider.respond ? provider.respond(req) : 200
  return new Response(JSON.stringify(status < 300 ? { id: `msg_a_${req.n}` } : { message: `refused ${status}` }), { status, headers: { 'content-type': 'application/json' } })
}

const { setStore, applyQuery } = await imp('lib/store/adapter.ts')
const { MemoryStore } = await imp('lib/store/memory-store.ts')
const { subscriberDocId } = await imp('lib/newsletter/subscribers.ts')
const W = await imp('lib/newsletter/welcome-claims.ts')
const Q = await imp('lib/email/daily-quota.ts')
const C = await imp('lib/newsletter/campaigns.ts')
const { processWelcomeSequence, welcomeAttention } = await imp('lib/newsletter/welcome-sequence.ts')

const LIST = 'newsletter', CLAIMS = W.WELCOME_SEND_CLAIMS, REVIEWS = W.WELCOME_SEND_REVIEWS
const DAY = 86_400_000, MIN = 60_000
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

function harness() {
  const real = new MemoryStore()
  const ctl = { fault: null }
  const wrap = (op, fn) => async (...args) => { if (ctl.fault) ctl.fault({ op, collection: args[0], args }); return fn(...args) }
  setStore({
    name: 'firestore-like',
    set: wrap('set', (c, id, d) => real.set(c, id, d)),
    create: wrap('create', (c, id, d) => real.create(c, id, d)),
    update: wrap('update', (c, id, p) => real.update(c, id, p)),
    delete: wrap('delete', (c, id) => real.delete(c, id)),
    increment: wrap('increment', (c, id, f, by) => real.increment(c, id, f, by)),
    get: wrap('get', (c, id) => real.get(c, id)),
    query: wrap('query', async (collection, opts = {}) => {
      let rows = (await real.query(collection, {})).sort(byId)
      if (opts.orderBy) rows = rows.filter((r) => r.data[opts.orderBy.field] !== undefined)
      return applyQuery(applyQuery(rows, opts), opts)
    }),
  })
  Object.assign(provider, { requests: [], violations: [], respond: null })
  return { real, ctl }
}

const T0 = Date.parse('2026-11-12T07:00:00Z')
/** `n` subscribers due for step 1 on day T0 (signed up 3 days before, a minute apart: oldest first is index 0). */
async function due(h, n) {
  process.env.WELCOME_SEQUENCE_ENABLED = 'true'
  process.env.WELCOME_SEQUENCE_SINCE = new Date(T0 - 365 * DAY).toISOString()
  const out = []
  for (let i = 0; i < n; i++) {
    const email = `alert${i}@example.test`, id = subscriberDocId(email)
    await h.real.set(LIST, id, { id, email, createdAt: new Date(T0 - 3 * DAY - (n - i) * MIN).toISOString(), consent: true, list: 'asquare-newsletter' })
    out.push({ id, email })
  }
  return out
}
const opts = () => { let t = 0; return { clock: () => t, sleep: async (ms) => { t += ms } } }
const run = (day = 0) => processWelcomeSequence(T0 + day * DAY + 1000, opts())
const reviews = async (h) => (await h.real.query(REVIEWS, {})).length
const stepOf = async (h, id) => (await h.real.get(LIST, id))?.data.welcomeStep ?? 0
const claimsOf = async (h) => (await h.real.query(CLAIMS, {})).map((r) => r.data)

/** Capture console.warn lines (the logger writes warnings there). */
async function captureWarn(fn) {
  const lines = [], orig = console.warn
  console.warn = (...a) => { lines.push(a.map(String).join(' ')) }
  try { return { result: await fn(), lines } } finally { console.warn = orig }
}

// ════════════════════════════════════════════════════════════════════════════════
for (const status of [401, 403]) {
  test(`A1 an account refusal (${status}) is not an attempt and stops the run; 3 days of it put nobody in review; once fixed, everyone is sent`, async () => {
    const h = harness()
    const subs = await due(h, 5)
    provider.respond = () => status
    for (let d = 0; d < 3; d++) {
      const before = provider.requests.length
      const r = await run(d)
      assert.equal(r.stopped, 'provider_refused', `day ${d}`)
      assert.equal(provider.requests.length - before, 1, `day ${d}: one provider call, then stop`)
      assert.equal(r.failed, 0, `day ${d}: not a definite refusal of the subscriber`)
      assert.ok(welcomeAttention(r)?.includes('provider_refused'), `day ${d}: alert raised`)
    }
    assert.equal(await reviews(h), 0, 'nobody in manual review')
    assert.ok((await claimsOf(h)).every((c) => c.outcome === 'deferred'), 'every refused claim is recorded as deferred (not an attempt)')
    provider.respond = () => 200
    const r = await run(3)
    assert.equal(r.sent, 5); assert.equal(r.stopped, undefined)
    for (const s of subs) assert.equal(await stepOf(h, s.id), 1)
    assert.equal(welcomeAttention(r), null)
    assert.equal(provider.violations.length, 0)
  })
}

test('A2 the same definite refusal twice in a row stops the run (at most 2 attempts used per run); a fixed provider then sends everyone else', async () => {
  const h = harness()
  const subs = await due(h, 6)
  provider.respond = () => 422
  for (let d = 0; d < 3; d++) {
    const before = provider.requests.length
    const r = await run(d)
    assert.equal(r.stopped, 'repeated_refusal', `day ${d}`)
    assert.equal(provider.requests.length - before, 2, `day ${d}: two refusals, then stop`)
    assert.ok(welcomeAttention(r)?.includes('repeated_refusal'))
  }
  // First attempts go before retries, so each day two DIFFERENT subscribers are tried: over 3 days each of the six
  // uses one attempt at most, and nobody comes near manual review (3 attempts).
  assert.equal(await reviews(h), 0, 'nobody in manual review')
  const per = provider.requests.reduce((m, x) => m.set(x.to, (m.get(x.to) || 0) + 1), new Map())
  assert.equal(per.size, 6); for (const n of per.values()) assert.equal(n, 1, 'one attempt each')
  provider.respond = () => 200
  const r = await run(3)
  assert.equal(r.sent, 6, 'once the provider accepts again, all six are sent')
  for (const s of subs) assert.equal(await stepOf(h, s.id), 1)
})

test('A3 refusals with different statuses are per-subscriber: the run goes on (behaviour unchanged)', async () => {
  const h = harness()
  await due(h, 4)
  const plan = [422, 400, 422, 200]
  provider.respond = (q) => plan[q.n - 1]
  const r = await run(0)
  assert.equal(provider.requests.length, 4); assert.equal(r.failed, 3); assert.equal(r.sent, 1); assert.equal(r.stopped, undefined)
})

test('A4 a refusal, then a send, then the same refusal: not "in a row", the run goes on', async () => {
  const h = harness()
  await due(h, 4)
  const plan = [422, 200, 422, 200]
  provider.respond = (q) => plan[q.n - 1]
  const r = await run(0)
  assert.equal(provider.requests.length, 4); assert.equal(r.stopped, undefined); assert.equal(r.sent, 2)
})

test('A5 welcomeAttention: what raises an alert and what does not', () => {
  const base = { stopped: undefined, reviewRecorded: 0, reviewWriteFailed: 0, failed: 0, unknown: 0 }
  assert.equal(welcomeAttention(base), null)
  for (const s of ['time_budget', 'send_cap', 'quota_exhausted', 'rate_limited']) assert.equal(welcomeAttention({ ...base, stopped: s }), null, s)
  // R-01 (review of the fixes, 9 Nov): unknown outcomes are later reconciled and can use attempts, so they alert too.
  for (const s of ['provider_refused', 'repeated_refusal', 'repeated_unknown', 'quota_unknown', 'scan_failed', 'cursor_stalled', 'page_cap', 'scan_incomplete']) assert.match(welcomeAttention({ ...base, stopped: s }), new RegExp(s), s)
  assert.match(welcomeAttention({ ...base, reviewRecorded: 1 }), /new manual review/)
  assert.match(welcomeAttention({ ...base, reviewWriteFailed: 1 }), /not written/)
  assert.equal(welcomeAttention({ ...base, failed: 1 }), null)
  assert.match(welcomeAttention({ ...base, failed: 2 }), /2 definite refusals/)
  assert.equal(welcomeAttention({ ...base, unknown: 1 }), null)
  assert.match(welcomeAttention({ ...base, unknown: 2 }), /2 unknown send outcomes/)
  assert.ok(!/@/.test(welcomeAttention({ stopped: 'quota_unknown', reviewRecorded: 2, reviewWriteFailed: 1, failed: 3, unknown: 4 })), 'no address in the alert')
})

test('A10 persistent unknown outcomes (HTTP 500) alert on the FIRST day, before any attempt has been reconciled away', async () => {
  const h = harness()
  await due(h, 10)
  provider.respond = () => 500
  const r = await run(0)
  assert.equal(r.stopped, 'repeated_unknown')
  assert.ok(r.unknown >= 2)
  assert.equal(await reviews(h), 0, 'no damage yet')
  assert.match(welcomeAttention(r), /repeated_unknown/)
  assert.match(welcomeAttention(r), /unknown send outcomes/)
  delete process.env.WELCOME_SEQUENCE_ENABLED; delete process.env.WELCOME_SEQUENCE_SINCE
})

test('A6 the daily cron raises the alert as a warning after the drip, inside the drip\'s try/catch', () => {
  const src = readFileSync(B + 'app/api/cron/drain-queue/route.ts', 'utf8')
  const i = src.indexOf('await processWelcomeSequence()'), a = src.indexOf('welcomeAttention(welcome)'), e = src.indexOf("reportError('cron.welcome_attention'"), c = src.indexOf("reportError('cron.welcome_sequence'")
  assert.ok(i > 0 && i < a && a < e && e < c, 'drip → attention → report, before the existing catch')
  assert.match(src.slice(e, e + 300), /severity: 'warning'/)
})

test('A7 an unreadable shared budget is logged with no address, on the drip path and the campaign path', async () => {
  const secret = 'leaky.person@example.test'
  // Drip.
  const h = harness()
  await due(h, 1)
  h.ctl.fault = (call) => { if (call.op === 'query' && call.collection === Q.CAMPAIGN_CLAIMS_COLLECTION) throw new Error(`index missing for ${secret} (${encodeURIComponent(secret)})`) }
  const d = await captureWarn(() => run(0))
  h.ctl.fault = null
  assert.equal(d.result.stopped, 'quota_unknown'); assert.equal(provider.requests.length, 0)
  const dl = d.lines.filter((l) => l.includes('welcome.quota_unreadable'))
  assert.equal(dl.length, 1, 'one warning line')
  assert.ok(!dl[0].includes(secret) && !dl[0].includes(encodeURIComponent(secret)) && dl[0].includes('[address]'), 'address removed')
  assert.ok(welcomeAttention(d.result)?.includes('quota_unknown'), 'and the cron alerts')
  // Campaign.
  const h2 = harness()
  await h2.real.set('campaigns', 'c1', { id: 'c1', brand: 'scamcheck', status: 'approved', subject: 'S', title: 'T', bodyHtml: '<p>B</p>', createdAt: '2026-10-01T00:00:00.000Z', approvedAt: '2026-10-02T00:00:00.000Z' })
  await h2.real.set(LIST, subscriberDocId('reader@example.test'), { email: 'reader@example.test', unsubscribed: false, source: 'test-seed' })
  const p = await C.previewRecipients('c1'); await C.enqueueCampaign('c1', undefined, p.binding)
  h2.ctl.fault = (call) => { if (call.op === 'query' && call.collection === 'email_events' && call.args[1]?.where?.some((w) => w.field === 'ts')) throw new Error(`denied: ${secret}`) }
  const c = await captureWarn(() => C.drainCampaign('c1'))
  h2.ctl.fault = null
  assert.equal(c.result.stopped, 'quota_unknown'); assert.equal(provider.requests.length, 0)
  const cl = c.lines.filter((l) => l.includes('campaign.quota_unreadable'))
  assert.equal(cl.length, 1); assert.ok(!cl[0].includes(secret) && cl[0].includes('[address]'))
  delete process.env.WELCOME_SEQUENCE_ENABLED; delete process.env.WELCOME_SEQUENCE_SINCE
})

test('A8 quotaErrorText: class and message, addresses removed, 200 characters at most', () => {
  assert.equal(Q.quotaErrorText(new TypeError('boom')), 'TypeError: boom')
  assert.equal(Q.quotaErrorText('plain'), 'plain')
  assert.equal(Q.quotaErrorText(new Error('for a.b@example.test and a%40example.test')), 'Error: for [address] and [address]')
  assert.equal(Q.quotaErrorText(new Error('x'.repeat(500))).length, 200)
})

test('A9 classifySendResult: 401/403 are deferred (not an attempt); other 4xx unchanged', () => {
  assert.equal(W.classifySendResult({ ok: false, status: 401 }), 'deferred')
  assert.equal(W.classifySendResult({ ok: false, status: 403 }), 'deferred')
  assert.equal(W.classifySendResult({ ok: false, status: 429 }), 'deferred')
  assert.equal(W.classifySendResult({ ok: false, status: 422 }), 'failed')
  assert.equal(W.classifySendResult({ ok: false, status: 400 }), 'failed')
  assert.equal(W.classifySendResult({ ok: false, status: 409 }), 'unknown')
  assert.equal(W.classifySendResult({ ok: false, status: 500 }), 'unknown')
})
