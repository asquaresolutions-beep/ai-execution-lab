// eval/newsletter-welcome-reliability.test.mjs   (asq-welcome-fairness-v1)
//
// Offline regression tests for the review findings of 6 Nov 2026 on the welcome drip:
//   F1  fairness — blocked / invalid / no-consent / manual-review backlogs cannot starve new subscribers
//       (batched read-only pre-check; active 21-day window first; a guaranteed backlog share);
//   F2  unknown outcomes are isolated per recipient; only system-wide signals stop the run;
//   F3  reconciliation reads the verified provider event types (delivered / accepted / not delivered);
//   F6  no address survives in stored error text (quoted, URL-encoded, the recipient's own);
//   F7  duplicate-address records are counted, not silently dropped;
//   F11 manual-review counts are exact (state found vs records written vs writes failed);
// and that every existing consent / unsubscribe / suppression / bounce / complaint check still applies.
//
// Same harness as eval/newsletter-welcome-pagination.test.mjs: a store that imitates production Firestore
// (document-id order, server-side limit, the adapter re-applying the query, orderBy dropping documents
// without the field, 'in' limited to 30 values like Firestore), a stubbed provider (no I/O), a fake clock,
// and an optional per-call latency on that clock. Nothing leaves the machine.
//
// Run: node --test --import ./eval/hooks.mjs eval/newsletter-welcome-reliability.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

process.env.RESEND_API_KEY = 'test-key-not-a-real-secret'
delete process.env.PUBLIC_APP_URL
delete process.env.MAIL_PHYSICAL_ADDRESS
delete process.env.FIREBASE_PROJECT_ID
delete process.env.FIREBASE_API_KEY

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const imp = (p) => import(pathToFileURL(B + p).href)

// ── Provider stub ───────────────────────────────────────────────────────────
const RESEND_URL = 'https://api.resend.com/emails'
const provider = { requests: [], violations: [], respond: null, webhook: true, onRequest: null, eventTs: 0, clockNow: () => 0, real: null }
const resetProvider = () => Object.assign(provider, { requests: [], violations: [], respond: null, webhook: true, onRequest: null, eventTs: 0, clockNow: () => 0, real: null })
globalThis.fetch = async (url, init) => {
  const u = String(url), method = String(init?.method || 'GET').toUpperCase()
  if (u !== RESEND_URL || method !== 'POST') { provider.violations.push(`${method} ${u}`); return new Response('{}', { status: 500 }) }
  const body = JSON.parse(String(init?.body ?? '{}'))
  const to = Array.isArray(body.to) ? body.to[0] : body.to
  const req = { n: provider.requests.length + 1, to, key: (init?.headers || {})['Idempotency-Key'] ?? null, at: provider.clockNow() }
  provider.requests.push(req)
  if (provider.onRequest) await provider.onRequest(req)
  const res = provider.respond ? await provider.respond(req) : { status: 200 }
  if (res === 'throw') throw new Error('network down')
  const accepted = res.accepted ?? (res.status >= 200 && res.status < 300)
  if (accepted && provider.webhook && provider.real) await provider.real.set('email_events', null, { type: 'sent', email: String(to).toLowerCase(), ts: provider.eventTs, messageId: `msg_${req.n}`, campaignId: null })
  return new Response(JSON.stringify(res.status < 300 ? { id: `msg_${req.n}` } : { message: res.message || `refused ${res.status}` }), { status: res.status, headers: { 'content-type': 'application/json' } })
}

const { setStore, applyQuery } = await imp('lib/store/adapter.ts')
const { MemoryStore } = await imp('lib/store/memory-store.ts')
const { subscriberDocId } = await imp('lib/newsletter/subscribers.ts')
const { processWelcomeSequence, WELCOME_LIMITS } = await imp('lib/newsletter/welcome-sequence.ts')
const W = await imp('lib/newsletter/welcome-claims.ts')

const DAY = 86_400_000, MIN = 60_000, HOUR = 60 * MIN
const NOW = Date.parse('2026-11-10T07:00:00Z')
const LIST = 'newsletter', EVENTS = 'email_events', CLAIMS = W.WELCOME_SEND_CLAIMS, REVIEWS = W.WELCOME_SEND_REVIEWS
const WRITES = new Set(['set', 'create', 'update', 'delete', 'increment'])
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

function firestoreLike() {
  const real = new MemoryStore()
  const calls = []
  const ctl = { fault: null, get: null, query: null, lag: null }
  const wrap = (op, fn) => async (...args) => {
    const call = { op, collection: args[0], args }
    calls.push(call)
    if (ctl.lag) ctl.lag(call)
    if (ctl.fault) ctl.fault(call)
    return fn(...args)
  }
  const store = {
    name: 'firestore-like',
    set: wrap('set', (c, id, d) => real.set(c, id, d)),
    create: wrap('create', (c, id, d) => real.create(c, id, d)),
    update: wrap('update', (c, id, p) => real.update(c, id, p)),
    delete: wrap('delete', (c, id) => real.delete(c, id)),
    increment: wrap('increment', (c, id, f, by) => real.increment(c, id, f, by)),
    get: wrap('get', async (c, id) => { if (ctl.get) { const r = ctl.get(c, id); if (r !== undefined) return r } return real.get(c, id) }),
    query: wrap('query', async (collection, opts = {}) => {
      if (ctl.query) { const r = await ctl.query(collection, opts); if (r !== undefined) return r }
      for (const w of opts.where || []) if (w.op === 'in' && (!Array.isArray(w.value) || w.value.length > 30)) throw new Error("Firestore: 'IN' supports up to 30 comparison values")
      let rows = (await real.query(collection, {})).sort(byId)
      if (opts.orderBy) rows = rows.filter((r) => r.data[opts.orderBy.field] !== undefined)
      return applyQuery(applyQuery(rows, opts), opts)
    }),
  }
  setStore(store)
  provider.real = real
  return { real, store, calls, ctl }
}

function enable() { process.env.WELCOME_SEQUENCE_ENABLED = 'true'; process.env.WELCOME_SEQUENCE_SINCE = new Date(NOW - 365 * DAY).toISOString() }
function fakeTime() {
  const t = { now: 0, sleeps: [] }
  provider.clockNow = () => t.now
  return { t, opts: (limits = {}) => ({ limits, clock: () => t.now, sleep: async (ms) => { t.sleeps.push(ms); t.now += ms } }) }
}
function fresh() { resetProvider(); enable(); const h = firestoreLike(); const ft = fakeTime(); return { h, ft } }
async function run(h, ft, now = NOW, limits = {}) { provider.eventTs = now; return processWelcomeSequence(now, ft.opts(limits)) }

let n = 0
/** One subscriber, `daysOld` days old (seconds apart so oldest-first is observable). */
async function sub(h, daysOld, extra = {}, email) {
  n++
  const address = email || `s${String(n).padStart(5, '0')}@example.test`
  const id = subscriberDocId(address)
  await h.real.set(LIST, id, { email: address, createdAt: new Date(NOW - daysOld * DAY - n * 1000).toISOString(), consent: true, list: 'asquare-newsletter', ...extra })
  return { id, email: address, createdAtMs: NOW - daysOld * DAY - n * 1000 }
}
const ev = (h, email, type, ts, extra = {}) => h.real.set(EVENTS, null, { type, email: email.toLowerCase(), ts, campaignId: null, ...extra })
/** A subscriber-step with three failed attempts in the ledger (manual review). */
async function inReview(h, s, withRecord = true) {
  for (let seq = 1; seq <= 3; seq++) await h.real.create(CLAIMS, W.claimDocId(s.id, 1, seq), { recordId: s.id, step: 1, seq, keyGen: seq, runId: 'old', claimedAt: new Date(NOW - 5 * DAY).toISOString(), claimedAtMs: NOW - 5 * DAY, outcome: 'failed', status: 422 })
  if (withRecord) await W.recordManualReview(h.real, { recordId: s.id, step: 1, reason: 'max_attempts', attempts: 3, last: { outcome: 'failed', status: 422 }, now: NOW - 5 * DAY })
}
const stepOf = async (h, id) => (await h.real.get(LIST, id))?.data.welcomeStep
const reqTo = (email) => provider.requests.filter((q) => q.to === email)
const unlimitedDay = { dailyProviderLimit: 1_000_000 }

// ── F1 · Fairness ───────────────────────────────────────────────────────────
/** A permanently blocked subscriber of one of five kinds, still "due" because blocked steps never advance. */
async function blockedSub(h, k, daysOld) {
  const kind = k % 5
  if (kind === 0) return sub(h, daysOld, { consent: false })
  if (kind === 1) return sub(h, daysOld, {}, `bad..dots${k}@example.test`)
  const s = await sub(h, daysOld)
  if (kind === 2) await ev(h, s.email, 'complained', NOW - 10 * DAY)
  if (kind === 3) await ev(h, s.email, 'bounced', NOW - 10 * DAY, { bounceType: 'Permanent', bounceSubType: 'General' })
  if (kind === 4) await ev(h, s.email, 'suppressed', NOW - 10 * DAY)
  return s
}

test('F1: 300 permanently blocked subscribers (inside and outside the active window) cannot starve 10 new ones, even at 100 ms per store call', async () => {
  const { h, ft } = fresh()
  for (let k = 0; k < 300; k++) await blockedSub(h, k, 3 + (k % 58))   // 3–60 days old: many inside the 21-day window
  const fresh10 = []; for (let i = 0; i < 10; i++) fresh10.push(await sub(h, 2.5))
  h.ctl.lag = () => { ft.t.now += 100 }
  h.calls.length = 0
  const r = await run(h, ft, NOW, unlimitedDay)
  assert.equal(r.sent, 10, 'every new subscriber is served in the first run'); assert.equal(r.stopped, undefined)
  assert.equal(r.blocked, 300)
  assert.deepEqual(r.blockedBy, { no_consent: 60, invalid_address: 60, complained: 60, permanent_bounce: 60, provider_suppressed: 60 })
  // The blocked ones cost only their share of batch reads: no per-subscriber read was made for any of them.
  const freshIds = new Set(fresh10.map((s) => s.id))
  assert.ok(h.calls.filter((c) => c.op === 'get' && c.collection === LIST).every((c) => freshIds.has(c.args[1])))
  assert.ok(r.precheckReads <= 2 * Math.ceil(310 / 30) + 1, `pre-check reads ${r.precheckReads}`)
  assert.deepEqual(h.calls.filter((c) => WRITES.has(c.op) && !freshIds.has(String(c.args[1]).slice(0, 35))), [], 'nothing written for any blocked subscriber')
})

test('F1: 60 subscribers in manual review are skipped at the cost of the batch reads; new ones are served', async () => {
  const { h, ft } = fresh()
  for (let i = 0; i < 60; i++) await inReview(h, await sub(h, 5 + (i % 30)))
  const fresh5 = []; for (let i = 0; i < 5; i++) fresh5.push(await sub(h, 3))
  h.ctl.lag = () => { ft.t.now += 100 }
  h.calls.length = 0
  const r = await run(h, ft, NOW, unlimitedDay)
  assert.equal(r.sent, 5); assert.equal(r.manualReview, 60); assert.equal(r.reviewRecorded, 0); assert.equal(r.reviewWriteFailed, 0)
  const freshIds = new Set(fresh5.map((s) => s.id))
  assert.ok(h.calls.filter((c) => c.op === 'get' && c.collection === CLAIMS).every((c) => freshIds.has(String(c.args[1]).slice(0, 35))), 'no per-subscriber ledger read for subscribers in review')
})

test('F1: the active 21-day window is served first, oldest first; the backlog keeps a share of 2 sends', async () => {
  const { h, ft } = fresh()
  const active = []; for (let i = 0; i < 30; i++) active.push(await sub(h, 3))
  const backlog = []; for (let i = 0; i < 5; i++) backlog.push(await sub(h, 30 + i))
  const r1 = await run(h, ft, NOW, unlimitedDay)
  assert.equal(r1.sent, 20); assert.equal(r1.activeCandidates, 30); assert.equal(r1.backlogCandidates, 5); assert.equal(r1.stopped, 'send_cap')
  const activeOldestFirst = [...active].sort((a, b) => a.createdAtMs - b.createdAtMs).map((s) => s.email)
  const backlogOldestFirst = [...backlog].sort((a, b) => a.createdAtMs - b.createdAtMs).map((s) => s.email)
  assert.deepEqual(provider.requests.slice(0, 18).map((q) => q.to), activeOldestFirst.slice(0, 18), 'active first, oldest first')
  assert.deepEqual(provider.requests.slice(18, 20).map((q) => q.to), backlogOldestFirst.slice(0, 2), 'then the backlog share')
  const r2 = await run(h, ft, NOW, unlimitedDay)
  // 12 active + 3 backlog step-1 sends, plus step 2 for the 2 backlog subscribers served in run 1 (30+ days old,
  // so step 2 is due at once: one step per run, as before this change).
  assert.equal(r2.sent, 17); assert.equal(r2.stopped, undefined)
  assert.equal(new Set(provider.requests.map((q) => q.to)).size, 35, 'everyone reached in two runs')
  const step1 = provider.requests.filter((q) => q.key.endsWith('-step1'))
  assert.equal(step1.length, 35); assert.equal(new Set(step1.map((q) => q.to)).size, 35, 'step 1 exactly once each')
})

test('F1: with a slow active phase, the backlog still gets its time reserve (no send starts after 18 s)', async () => {
  const { h, ft } = fresh()
  for (let i = 0; i < 30; i++) await sub(h, 3)
  const backlog = []; for (let i = 0; i < 3; i++) backlog.push(await sub(h, 40 + i))
  provider.onRequest = async () => { ft.t.now += 1500 }
  const r = await run(h, ft, NOW, unlimitedDay)
  const bl = new Set(backlog.map((s) => s.email))
  assert.equal(provider.requests.filter((q) => bl.has(q.to)).length, 2, 'the backlog share is honoured even when time runs short')
  assert.ok(provider.requests.every((q) => q.at <= 18_000)); assert.equal(r.stopped, 'time_budget')
})

test('F1: no eligible subscriber is skipped for ever — a backlog subscriber whose block clears is served on the next run', async () => {
  const { h, ft } = fresh()
  const s = await sub(h, 40)
  await ev(h, s.email, 'bounced', NOW - 5 * DAY); await ev(h, s.email, 'bounced', NOW - 4 * DAY)
  const r1 = await run(h, ft)
  assert.deepEqual(r1.blockedBy, { repeated_bounce: 1 }); assert.equal(reqTo(s.email).length, 0)
  await ev(h, s.email, 'delivered', NOW - 1 * DAY)   // a later delivery clears repeated bounces (deliverability.ts)
  const r2 = await run(h, ft, NOW + DAY)
  assert.equal(r2.sent, 1); assert.equal(await stepOf(h, s.id), 1)
})

test('F1: pre-check reads are batched — Firestore never receives an IN with more than 30 values', async () => {
  const { h, ft } = fresh()
  for (let i = 0; i < 500; i++) await sub(h, 3)
  h.calls.length = 0
  const r = await run(h, ft, NOW, unlimitedDay)
  const ins = h.calls.filter((c) => c.op === 'query' && c.args[1]?.where?.some((w) => w.op === 'in'))
  assert.ok(ins.length > 0 && ins.every((c) => c.args[1].where[0].value.length <= 30))
  assert.equal(ins.length, 2 * Math.ceil(500 / 30)); assert.equal(r.sent, 20); assert.equal(WELCOME_LIMITS.prefetchBatch, 30)
})

test('F1: a failed pre-check read leaves subscribers unclassified — they get the full check, blocked ones are still blocked', async () => {
  const { h, ft } = fresh()
  const ok = await sub(h, 3)
  const bad = await sub(h, 3); await ev(h, bad.email, 'complained', NOW - DAY)
  h.ctl.fault = (c) => { if (c.op === 'query' && c.args[1]?.where?.some((w) => w.op === 'in')) throw new Error('store down') }
  const r = await run(h, ft)
  assert.equal(r.unclassified, 2); assert.equal(r.sent, 1); assert.deepEqual(r.blockedBy, { complained: 1 })
  assert.deepEqual(provider.requests.map((q) => q.to), [ok.email])
})

test('F1: a subscriber waiting for reconciliation is skipped by the pre-check without per-subscriber reads', async () => {
  const { h, ft } = fresh()
  const s = await sub(h, 3)
  await h.real.create(CLAIMS, W.claimDocId(s.id, 1, 1), { recordId: s.id, step: 1, seq: 1, keyGen: 1, runId: 'live', claimedAt: new Date(NOW - 5 * MIN).toISOString(), claimedAtMs: NOW - 5 * MIN, outcome: 'unknown' })
  h.calls.length = 0
  const r = await run(h, ft)
  assert.equal(r.held, 1); assert.equal(provider.requests.length, 0)
  assert.equal(h.calls.filter((c) => c.op === 'get').length, 0)
})

// ── F2 · Unknown outcomes isolated per recipient ────────────────────────────
test('F2: one recipient with a persistent unknown outcome no longer stalls the others (multi-day); a day later it goes to manual review, not to a second send', async () => {
  const { h, ft } = fresh()
  const stuck = await sub(h, 8)                       // oldest → first in the order
  const others = []; for (let i = 0; i < 8; i++) others.push(await sub(h, 3))
  provider.respond = (q) => (q.to === stuck.email ? { status: 409, message: 'invalid_idempotent_request' } : { status: 200 })
  const days = []
  for (let d = 0; d < 5; d++) { const r = await run(h, ft, NOW + d * DAY); days.push([r.sent, r.unknown, r.manualReview, r.stopped ?? '-']) }
  assert.deepEqual(days[0], [8, 1, 0, '-'], 'day 0: the 8 others are served despite the stuck recipient')
  assert.equal(reqTo(stuck.email).length, 1, 'one attempt only: 24 h later the same key no longer protects against a second send')
  assert.deepEqual(days[1].slice(2, 3), [1], 'day 1: manual review')
  const review = (await h.real.get(REVIEWS, W.reviewDocId(stuck.id, 1)))?.data
  assert.equal(review.state, 'manual_review'); assert.equal(review.reason, 'key_window_expired')
  for (const d of days.slice(1)) assert.deepEqual(d.slice(2), [1, '-'], 'counted once a run, the run is not stopped')
  // The others get step 1 once on day 0 (and, being 5 days old by day 2, step 2 once: one step per run).
  for (const o of others) {
    assert.equal(provider.requests.filter((q) => q.key === `welcome-${o.id}-step1`).length, 1)
    assert.ok(provider.requests.filter((q) => q.key === `welcome-${o.id}-step1`)[0].n <= 9, 'served on day 0')
  }
})

test('F2: a system-wide failure (every first attempt unknown) stops the run after 2 in a row', async () => {
  const { h, ft } = fresh()
  for (let i = 0; i < 10; i++) await sub(h, 3)
  provider.respond = () => ({ status: 503 })
  const r = await run(h, ft)
  assert.equal(r.stopped, 'repeated_unknown'); assert.equal(r.unknown, 2); assert.equal(provider.requests.length, 2); assert.equal(r.notReached, 8)
})

test('F2: scattered unknowns among successes: the run continues until 5 unknowns in total', async () => {
  const { h, ft } = fresh()
  for (let i = 0; i < 16; i++) await sub(h, 3)
  provider.respond = (q) => (q.n % 2 === 1 ? { status: 500 } : { status: 200 })
  const r = await run(h, ft)
  assert.equal(r.unknown, 5); assert.equal(r.sent, 4); assert.equal(r.stopped, 'repeated_unknown')
})

test('F2: unknown outcomes on retries never stop the run; after 3, the remaining retries wait and first attempts go on', async () => {
  const { h, ft } = fresh()
  // The retries are OLDER signups than the first attempts, so only the ordering rule can put the first attempts first.
  const firsts = []; for (let i = 0; i < 5; i++) firsts.push(await sub(h, 3))
  const retries = []
  for (let i = 0; i < 5; i++) {
    const s = await sub(h, 4); retries.push(s)
    await h.real.create(CLAIMS, W.claimDocId(s.id, 1, 1), { recordId: s.id, step: 1, seq: 1, keyGen: 1, runId: 'old', claimedAt: new Date(NOW - 2 * HOUR).toISOString(), claimedAtMs: NOW - 2 * HOUR, outcome: 'unknown' })
  }
  const retryAddr = new Set(retries.map((s) => s.email))
  provider.respond = (q) => (retryAddr.has(q.to) ? { status: 500 } : { status: 200 })
  const r = await run(h, ft)
  assert.equal(r.sent, 5, 'first attempts first, all served'); assert.equal(r.unknown, 3); assert.equal(r.retriesPostponed, 2); assert.equal(r.stopped, undefined)
  assert.deepEqual(provider.requests.slice(0, 5).map((q) => q.to).sort(), firsts.map((s) => s.email).sort(), 'first attempts are ordered before retries')
})

test('F2: recovery after a provider incident — next run reconciles the unknowns and serves everyone exactly once', async () => {
  const { h, ft } = fresh()
  const subs = []; for (let i = 0; i < 10; i++) subs.push(await sub(h, 3))
  provider.respond = () => ({ status: 503 })
  const r1 = await run(h, ft)
  assert.equal(r1.stopped, 'repeated_unknown')
  provider.respond = null
  const r2 = await run(h, ft, NOW + 40 * MIN)
  assert.equal(r2.sent, 10)
  for (const s of subs) assert.equal(await stepOf(h, s.id), 1)
  const ok = provider.requests.slice(2)
  assert.equal(new Set(ok.map((q) => q.to)).size, 10, 'one successful request per subscriber')
  for (const q of provider.requests.slice(0, 2)) assert.equal(ok.filter((x) => x.to === q.to)[0].key, q.key, 'the retry reuses the key of the unknown attempt')
})

test('F2: overlapping runs with unknown outcomes keep claim ownership — no recipient is requested twice in a run pair', async () => {
  const { h, ft } = fresh()
  for (let i = 0; i < 30; i++) await sub(h, 3)
  provider.respond = (q) => (q.n % 7 === 0 ? { status: 500 } : { status: 200 })
  await Promise.all([run(h, ft, NOW, unlimitedDay), run(h, ft, NOW, unlimitedDay)])
  const per = new Map(); for (const q of provider.requests) per.set(q.to, (per.get(q.to) || 0) + 1)
  assert.ok([...per.values()].every((v) => v === 1))
})

// ── F3 · Verified provider event types in reconciliation ────────────────────
async function unknownThen(h, ft, eventType, at, extra = {}, secondRunAt = NOW + DAY) {
  const s = await sub(h, 3)
  provider.webhook = false
  provider.respond = () => ({ status: 504 })
  await run(h, ft)
  if (eventType) await ev(h, s.email, eventType, at, extra)
  provider.respond = null; provider.webhook = true
  const r = await run(h, ft, secondRunAt)
  return { s, r }
}

test('F3: a "delivered" event up to 6 h after the attempt proves delivery (the "sent" event was lost) — no resend', async () => {
  const { h, ft } = fresh()
  const { s, r } = await unknownThen(h, ft, 'delivered', NOW + 2 * HOUR)
  assert.equal(r.reconciled, 1); assert.equal(reqTo(s.email).length, 1); assert.equal(await stepOf(h, s.id), 1)
  const c = (await h.real.get(CLAIMS, W.claimDocId(s.id, 1, 1))).data
  assert.deepEqual([c.outcome, c.reconciled, c.evidenceType], ['sent', 'provider_event', 'delivered'])
})

test('F3: a "bounced" (temporary) event means taken but NOT delivered — never recorded as sent; one attempt used; retried with a NEW key', async () => {
  const { h, ft } = fresh()
  const { s } = await unknownThen(h, ft, 'bounced', NOW + 30_000, { bounceType: 'Temporary' })
  const c1 = (await h.real.get(CLAIMS, W.claimDocId(s.id, 1, 1))).data
  assert.deepEqual([c1.outcome, c1.reconciled, c1.evidenceType], ['not_sent', 'provider_not_delivered', 'bounced'])
  assert.deepEqual(reqTo(s.email).map((q) => q.key), [`welcome-${s.id}-step1`, `welcome-${s.id}-step1-k2`])
  assert.equal(await stepOf(h, s.id), 1, 'advanced only by the real second send')
})

test('F3: a "suppressed" event (or a permanent bounce) stops the subscriber at the deliverability check — never retried', async () => {
  for (const [type, extra] of [['suppressed', {}], ['bounced', { bounceType: 'Permanent', bounceSubType: 'General' }]]) {
    const { h, ft } = fresh()
    const { s, r } = await unknownThen(h, ft, type, NOW + 20_000, extra)
    assert.equal(reqTo(s.email).length, 1, type); assert.equal(r.blocked, 1, type); assert.equal(await stepOf(h, s.id), undefined, type)
  }
})

test('F3: "opened" / "clicked" / "complained" are not read as evidence for an attempt (they can belong to any earlier email)', async () => {
  for (const type of ['opened', 'clicked']) {
    const { h, ft } = fresh()
    const { s } = await unknownThen(h, ft, type, NOW + 60_000, {}, NOW + 3 * HOUR)
    assert.deepEqual(reqTo(s.email).map((q) => q.key), [`welcome-${s.id}-step1`, `welcome-${s.id}-step1`], `${type}: no evidence → same-key retry`)
  }
  const { h, ft } = fresh()
  const { s, r } = await unknownThen(h, ft, 'complained', NOW + 60_000)
  assert.equal(r.blockedBy.complained, 1); assert.equal(reqTo(s.email).length, 1, 'a complaint blocks at the check')
})

test('F3: evidence windows and priority (pure)', () => {
  const at = NOW, k = (evs) => W.classifyDeliveryEvidence(evs, at).kind
  assert.equal(k([{ type: 'sent', ts: at + 14 * MIN }]), 'accepted')
  assert.equal(k([{ type: 'sent', ts: at + 16 * MIN }]), 'none')
  assert.equal(k([{ type: 'delivered', ts: at + 5 * HOUR }]), 'delivered')
  assert.equal(k([{ type: 'delivered', ts: at + 7 * HOUR }]), 'none')
  assert.equal(k([{ type: 'delivery_delayed', ts: at + 3 * HOUR }]), 'accepted')
  assert.equal(k([{ type: 'bounced', ts: at + 2 * HOUR }]), 'not_delivered')
  assert.equal(k([{ type: 'suppressed', ts: at + 5 * MIN }]), 'not_delivered')
  assert.equal(k([{ type: 'sent', ts: at + 1000 }, { type: 'bounced', ts: at + 9000 }]), 'not_delivered', 'taken then bounced is not delivered')
  assert.equal(k([{ type: 'bounced', ts: at + 9000 }, { type: 'delivered', ts: at + 5000 }]), 'delivered')
  assert.equal(k([{ type: 'delivered', ts: at + 5000, campaignId: 'c1' }]), 'none', 'campaign mail is never evidence')
  assert.equal(k([{ type: 'opened', ts: at + 5000 }, { type: 'clicked', ts: at + 6000 }, { type: 'complained', ts: at + 7000 }]), 'none')
  assert.equal(k([{ type: 'sent', ts: at - 2 * MIN }]), 'none', 'before the attempt')
})

// ── F6 · Redaction ──────────────────────────────────────────────────────────
test('F6: stored error text holds no address — quoted local parts, URL-encoded forms, the recipient in any case', () => {
  const r = 'First.Last+tag@Example.test'
  const cases = [
    `Invalid \`to\`: ${r}`, `Invalid \`to\`: ${r.toLowerCase()}`, `"First Last"@example.test is not allowed`, `mailto:${encodeURIComponent(r)}`,
    'to=first.last%40example.test', 'TO=FIRST.LAST%40EXAMPLE.TEST', '["a@b.co","c@d.co"]', '<x.y@z.co.uk>', 'Ünïcode@exämple.de.',
  ]
  for (const c of cases) {
    const out = W.ledgerError(c, r)
    assert.ok(!out.includes('@') && !/%40/i.test(out), `${c} → ${out}`)
    assert.ok(!out.toLowerCase().includes('first.last'), `${c} → ${out}`)
  }
  assert.equal(W.ledgerError('x'.repeat(500)).length, 200)
})

test('F6: claim and review records keep no address even when the provider error quotes it', async () => {
  const { h, ft } = fresh()
  const s = await sub(h, 3, {}, 'quoted.person@example.test')
  provider.respond = (q) => ({ status: 422, message: `"Quoted Person"@example.test / ${encodeURIComponent(q.to)} / ${q.to.toUpperCase()} rejected` })
  for (let k = 0; k < 3; k++) await run(h, ft)
  const docs = [...(await h.real.query(CLAIMS, {})), ...(await h.real.query(REVIEWS, {}))]
  assert.equal(docs.length, 4)
  for (const d of docs) { const j = JSON.stringify(d.data); assert.ok(!j.includes('@') && !/%40/i.test(j) && !j.toLowerCase().includes('quoted.person'), j) }
  assert.equal(reqTo(s.email).length, 3)
})

// ── F7 · Duplicate-address records ──────────────────────────────────────────
test('F7: a second record with the same address is counted (duplicateAddress), not silently dropped', async () => {
  const { h, ft } = fresh()
  await h.real.set(LIST, 'nl_aaaa', { email: 'Dup@Example.test', createdAt: new Date(NOW - 3 * DAY).toISOString() })
  await h.real.set(LIST, 'nl_bbbb', { email: 'dup@example.test', createdAt: new Date(NOW - 3 * DAY).toISOString() })
  const r = await run(h, ft)
  assert.equal(r.duplicateAddress, 1); assert.equal(r.due, 1); assert.equal(r.sent, 1)
})

// ── F11 · Manual-review counts ──────────────────────────────────────────────
test('F11: a failed review write is counted as such and retried; the state is counted once per run', async () => {
  const { h, ft } = fresh()
  const s = await sub(h, 3)
  provider.respond = () => ({ status: 422 })
  await run(h, ft); await run(h, ft)
  h.ctl.fault = (c) => { if (c.op === 'create' && c.collection === REVIEWS) throw new Error('store down') }
  const r3 = await run(h, ft)
  assert.deepEqual([r3.failed, r3.manualReview, r3.reviewRecorded, r3.reviewWriteFailed], [1, 1, 0, 1])
  h.ctl.fault = null
  const r4 = await run(h, ft)
  assert.deepEqual([r4.manualReview, r4.reviewRecorded, r4.reviewWriteFailed], [1, 1, 0], 'the missing record is written by the pre-check, once')
  const r5 = await run(h, ft)
  assert.deepEqual([r5.manualReview, r5.reviewRecorded, r5.reviewWriteFailed], [1, 0, 0])
  assert.equal(reqTo(s.email).length, 3); assert.equal((await h.real.query(REVIEWS, {})).length, 1)
  assert.equal(await stepOf(h, s.id), undefined, 'manual review never advances the step')
})

// ── Existing checks, through the new pre-check ──────────────────────────────
test('checks preserved: the pre-check and the check before the send together stop every blocked kind; nothing is written for any of them', async () => {
  const { h, ft } = fresh()
  const ok = await sub(h, 3)
  const noConsent = await sub(h, 3, { consent: false })
  const unsubAfterRead = await sub(h, 3)
  const deleted = await sub(h, 3)
  const kinds = { complained: ['complained', {}], permanent_bounce: ['bounced', { bounceType: 'Permanent', bounceSubType: 'General' }], provider_suppressed: ['suppressed', {}] }
  const blocked = {}
  for (const [k, [type, extra]] of Object.entries(kinds)) { blocked[k] = await sub(h, 3); await ev(h, blocked[k].email, type, NOW - DAY, extra) }
  const rep = await sub(h, 3); await ev(h, rep.email, 'bounced', NOW - 2 * DAY); await ev(h, rep.email, 'bounced', NOW - DAY)
  const invalid = await sub(h, 3, {}, 'x..y@example.test')
  h.ctl.get = (c, id) => {
    if (c === LIST && id === unsubAfterRead.id) return { id, data: { email: unsubAfterRead.email, createdAt: new Date(unsubAfterRead.createdAtMs).toISOString(), unsubscribed: true } }
    if (c === LIST && id === deleted.id) return null
    return undefined
  }
  h.calls.length = 0
  const r = await run(h, ft)
  assert.deepEqual(r.blockedBy, { no_consent: 1, unsubscribed: 1, not_subscribed: 1, complained: 1, permanent_bounce: 1, provider_suppressed: 1, repeated_bounce: 1, invalid_address: 1 })
  assert.deepEqual(provider.requests.map((q) => q.to), [ok.email])
  const writes = h.calls.filter((c) => WRITES.has(c.op))
  assert.ok(writes.every((c) => String(c.args[1]).startsWith(ok.id) || c.collection === EVENTS), 'only the sendable subscriber caused writes')
  void noConsent; void invalid; void rep
})

// ── Review of PR #129 (13 Nov 2026) ──────────────────────────────────────────
test('review 8: when the open-review read fails, a missing manual-review record is still written (create is atomic)', async () => {
  const { h, ft } = fresh()
  const s = await sub(h, 3)
  provider.respond = () => ({ status: 422 })
  await run(h, ft); await run(h, ft)
  h.ctl.fault = (c) => { if (c.op === 'create' && c.collection === REVIEWS) throw new Error('store down') }
  const r3 = await run(h, ft)
  assert.deepEqual([r3.manualReview, r3.reviewRecorded, r3.reviewWriteFailed], [1, 0, 1])
  // Now the review QUERY fails instead: before the fix the record was skipped for as long as that read failed.
  h.ctl.fault = (c) => { if (c.op === 'query' && c.collection === REVIEWS) throw new Error('store down') }
  const r4 = await run(h, ft)
  assert.deepEqual([r4.manualReview, r4.reviewRecorded, r4.reviewWriteFailed], [1, 1, 0])
  assert.equal((await h.real.get(REVIEWS, W.reviewDocId(s.id, 1)))?.data.state, 'manual_review')
  // Still failing: the record exists, so the atomic create changes nothing and nothing is counted twice.
  const r5 = await run(h, ft)
  assert.deepEqual([r5.manualReview, r5.reviewRecorded, r5.reviewWriteFailed], [1, 0, 0])
  h.ctl.fault = null
  assert.equal(reqTo(s.email).length, 3, 'no further send to a subscriber in manual review')
})

test('review 5: inside the key window an unknown outcome is retried with the SAME key, up to 3 attempts, then manual review', async () => {
  const { h, ft } = fresh()
  const stuck = await sub(h, 8)
  provider.webhook = false
  provider.respond = () => ({ status: 504 })
  const runs = []
  for (let k = 0; k < 5; k++) { const r = await run(h, ft, NOW + k * 2 * HOUR); runs.push([r.unknown, r.manualReview]) }
  assert.equal(reqTo(stuck.email).length, 3, 'three attempts, each only after reconciliation')
  assert.ok(reqTo(stuck.email).every((q) => q.key === `welcome-${stuck.id}-step1`), 'same key every time')
  assert.deepEqual(runs.map((x) => x[1]), [0, 0, 0, 1, 1])
  assert.equal((await h.real.get(REVIEWS, W.reviewDocId(stuck.id, 1)))?.data.reason, 'max_attempts')
  provider.respond = null; provider.webhook = true
})

test('review 5: the cut-off is the claim age, 23 h — just inside retries, at the cut-off it does not; nothing is written, so the decision repeats', async () => {
  for (const [age, expectSends, expectReview] of [[W.KEY_WINDOW_MS - MIN, 2, false], [W.KEY_WINDOW_MS, 1, true]]) {
    const { h, ft } = fresh()
    const { s, r } = await unknownThen(h, ft, null, 0, {}, NOW + age)
    assert.equal(reqTo(s.email).length, expectSends, `age ${age}`)
    assert.equal(r.manualReview, expectReview ? 1 : 0, `age ${age}`)
    if (expectReview) {
      const claim = (await h.real.get(CLAIMS, W.claimDocId(s.id, 1, 1))).data
      assert.equal(claim.outcome, 'unknown', 'the claim is left as it was'); assert.equal(claim.reconciled, undefined)
      const again = await run(h, ft, NOW + age + DAY)
      assert.equal(again.manualReview, 1); assert.equal(again.reviewRecorded, 0); assert.equal(reqTo(s.email).length, 1, 'still no second send')
    }
  }
})

test('review 5: evidence still wins over the age check — a delivered event a day later is read as sent, with no review', async () => {
  const { h, ft } = fresh()
  const { s, r } = await unknownThen(h, ft, 'delivered', NOW + 2 * HOUR)   // second run at NOW + 1 day
  assert.equal(reqTo(s.email).length, 1); assert.equal(r.manualReview, 0); assert.equal(await stepOf(h, s.id), 1)
})
