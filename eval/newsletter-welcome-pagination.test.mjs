// eval/newsletter-welcome-pagination.test.mjs   (asq-welcome-pagination-v1)
//
// Offline tests for the welcome drip at list sizes past the old 200-record read:
// keyset pagination (201 / 500 / 1,000 records, page boundaries), the per-run cap,
// oldest-first order, the daily quota guard (re-read before every send), spacing and
// the run budget, the claim ledger (overlapping runs, interruption, retries, manual
// review), and unknown send outcomes reconciled against the provider's events.
//
// The store imitates PRODUCTION Firestore, not the in-memory store's insertion order:
// unordered reads come back in document-id order (as Firestore returns them), the
// server applies where/orderBy/limit and the adapter then re-applies them in-process
// (lib/store/firestore-adapter.ts query()), and an orderBy excludes documents that lack
// the field. It records every data call and can be told to fail one.
// The provider request is stubbed: no I/O; any request other than a POST to the
// provider's send endpoint is a violation. An accepted send can also write the event
// the provider's webhook would store. Nothing leaves the machine.
//
// Run: node --test --import ./eval/hooks.mjs eval/newsletter-welcome-pagination.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

process.env.RESEND_API_KEY = 'test-key-not-a-real-secret'
delete process.env.PUBLIC_APP_URL
delete process.env.MAIL_PHYSICAL_ADDRESS
delete process.env.FIREBASE_PROJECT_ID   // never the production store
delete process.env.FIREBASE_API_KEY

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const imp = (p) => import(pathToFileURL(B + p).href)

// ── Provider stub ───────────────────────────────────────────────────────────
const RESEND_URL = 'https://api.resend.com/emails'
const provider = {
  requests: [], violations: [],
  /** (req) => { status, accepted? } | 'throw' | 'hang'. Default: 200. */
  respond: null,
  /** Write the 'sent' event the provider's webhook would store, for accepted sends. */
  webhook: true,
  /** Extra hook per request (e.g. advance the fake clock, add other traffic). */
  onRequest: null,
  eventTs: 0, clockNow: () => 0, real: null,
}
function resetProvider() {
  Object.assign(provider, { requests: [], violations: [], respond: null, webhook: true, onRequest: null, eventTs: 0, clockNow: () => 0, real: null })
}
globalThis.fetch = async (url, init) => {
  const u = String(url)
  const method = String(init?.method || 'GET').toUpperCase()
  if (u !== RESEND_URL || method !== 'POST') { provider.violations.push(`${method} ${u}`); return new Response('{}', { status: 500 }) }
  const body = JSON.parse(String(init?.body ?? '{}'))
  const to = Array.isArray(body.to) ? body.to[0] : body.to
  const req = { n: provider.requests.length + 1, to, key: (init?.headers || {})['Idempotency-Key'] ?? null, at: provider.clockNow(), tags: body.tags }
  provider.requests.push(req)
  if (provider.onRequest) await provider.onRequest(req)
  const res = provider.respond ? await provider.respond(req) : { status: 200 }
  if (res === 'throw') throw new Error('network down')
  if (res === 'hang') return new Promise(() => {})
  const accepted = res.accepted ?? (res.status >= 200 && res.status < 300)
  if (accepted && provider.webhook && provider.real) {
    await provider.real.set('email_events', null, { type: 'sent', email: String(to).toLowerCase(), ts: provider.eventTs, messageId: `msg_${req.n}`, campaignId: null })
  }
  const payload = res.status < 300 ? { id: `msg_${req.n}` } : { message: res.message || `refused ${res.status}` }
  return new Response(JSON.stringify(payload), { status: res.status, headers: { 'content-type': 'application/json' } })
}

const { setStore, applyQuery } = await imp('lib/store/adapter.ts')
const { MemoryStore } = await imp('lib/store/memory-store.ts')
const { subscriberDocId } = await imp('lib/newsletter/subscribers.ts')
const { processWelcomeSequence, WELCOME_LIMITS } = await imp('lib/newsletter/welcome-sequence.ts')
const W = await imp('lib/newsletter/welcome-claims.ts')
const { readFileSync } = await import('node:fs')

const DAY = 86_400_000, MIN = 60_000
const NOW = Date.parse('2026-11-10T07:00:00Z')   // the daily cron's hour
const LIST = 'newsletter', EVENTS = 'email_events', CLAIMS = W.WELCOME_SEND_CLAIMS, REVIEWS = W.WELCOME_SEND_REVIEWS
const WRITES = new Set(['set', 'create', 'update', 'delete', 'increment'])
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

// ── Firestore-like store ────────────────────────────────────────────────────
function firestoreLike() {
  const real = new MemoryStore()
  const calls = []
  const ctl = { fault: null, get: null, query: null }
  const wrap = (op, fn) => async (...args) => {
    const call = { op, collection: args[0], args }
    calls.push(call)
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
    get: wrap('get', async (c, id) => {
      if (ctl.get) { const r = ctl.get(c, id); if (r !== undefined) return r }
      return real.get(c, id)
    }),
    query: wrap('query', async (collection, opts = {}) => {
      if (ctl.query) { const r = await ctl.query(collection, opts); if (r !== undefined) return r }
      // Firestore returns documents in document-name order; an orderBy leaves out documents
      // without that field; the server applies the query and the adapter re-applies it.
      let rows = (await real.query(collection, {})).sort(byId)
      if (opts.orderBy) rows = rows.filter((r) => r.data[opts.orderBy.field] !== undefined)
      return applyQuery(applyQuery(rows, opts), opts)
    }),
  }
  setStore(store)
  provider.real = real
  return { real, store, calls, ctl }
}

// ── Fixtures ────────────────────────────────────────────────────────────────
let seed = 1
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

function enable() {
  process.env.WELCOME_SEQUENCE_ENABLED = 'true'
  process.env.WELCOME_SEQUENCE_SINCE = new Date(NOW - 365 * DAY).toISOString()
}

/**
 * `n` subscribers with real-shaped ids (nl_ + sha1 of the address), inserted in random
 * order. `dueAt(index)` — index in id order — makes that record due for step 1 (3 days
 * old, a few minutes apart so oldest-first is observable). Everyone else has finished the
 * series. Returns the records in id order.
 */
async function seedList(h, n, dueAt, extra = () => ({})) {
  seed = 7 + n
  const rows = Array.from({ length: n }, (_, i) => { const email = `user${String(i).padStart(4, '0')}@example.test`; return { id: subscriberDocId(email), email } }).sort(byId)
  rows.forEach((r, idx) => { r.idx = idx; r.due = !!dueAt(idx, r); r.createdAtMs = r.due ? NOW - 3 * DAY - Math.floor(rand() * 600) * MIN : NOW - 40 * DAY })
  for (const r of shuffle([...rows])) {
    const data = r.due
      ? { email: r.email, createdAt: new Date(r.createdAtMs).toISOString(), consent: true, list: 'asquare-newsletter' }
      : { email: r.email, createdAt: new Date(r.createdAtMs).toISOString(), consent: true, list: 'asquare-newsletter', welcomeStep: 3 }
    await h.real.set(LIST, r.id, { ...data, ...extra(r) })
  }
  return rows
}

/** A fake clock and sleep, so spacing and the run budget are observable without waiting. */
function fakeTime() {
  const t = { now: 0, sleeps: [] }
  provider.clockNow = () => t.now
  return {
    t,
    opts: (limits = {}) => ({ limits, clock: () => t.now, sleep: async (ms) => { t.sleeps.push(ms); t.now += ms } }),
  }
}

async function run(h, ft, now = NOW, limits = {}) {
  provider.eventTs = now
  return processWelcomeSequence(now, ft.opts(limits))
}

const keyCounts = () => provider.requests.reduce((m, r) => m.set(r.key, (m.get(r.key) || 0) + 1), new Map())
const assertNoDuplicateKeys = () => {
  for (const [k, n] of keyCounts()) assert.equal(n, 1, `idempotency key ${k} sent ${n} times`)
}
const assertNoDuplicateRecipients = () => {
  const seen = new Map(); for (const r of provider.requests) seen.set(r.to, (seen.get(r.to) || 0) + 1)
  for (const [to, n] of seen) assert.equal(n, 1, `${to} received ${n} requests`)
}
const stepOf = async (h, id) => (await h.real.get(LIST, id))?.data.welcomeStep
const claimsOf = async (h) => (await h.real.query(CLAIMS, {})).map((c) => c.data)
const sentEventsToday = async (h, now = NOW) => (await h.real.query(EVENTS, {})).filter((e) => e.data.type === 'sent' && e.data.ts >= W.utcDayStart(now)).length
const unlimitedDay = { dailyProviderLimit: 1_000_000 }

function fresh() { resetProvider(); enable(); const h = firestoreLike(); const ft = fakeTime(); return { h, ft } }

// ── 1 · Scale and pagination ────────────────────────────────────────────────
test('201 records: the due subscriber whose id sorts LAST is sent (the old 200-record read missed it)', async () => {
  const { h, ft } = fresh()
  const rows = await seedList(h, 201, (i) => i === 200)
  const r = await run(h, ft)
  assert.equal(r.scanned, 201); assert.equal(r.pages, 2); assert.equal(r.due, 1); assert.equal(r.sent, 1)
  assert.deepEqual(provider.requests.map((q) => q.to), [rows[200].email])
  assert.equal(await stepOf(h, rows[200].id), 1)
  assert.equal(provider.violations.length, 0)
})

test('201 records: every due subscriber on both pages is sent exactly once, step advanced', async () => {
  const { h, ft } = fresh()
  const dueIdx = new Set([0, 7, 50, 120, 198, 199, 200])
  const rows = await seedList(h, 201, (i) => dueIdx.has(i))
  const r = await run(h, ft)
  assert.equal(r.due, 7); assert.equal(r.sent, 7); assert.equal(r.stopped, undefined)
  assertNoDuplicateRecipients()
  for (const row of rows) assert.equal(await stepOf(h, row.id), row.due ? 1 : 3)
})

test('500 records, 60 due: 20 per run, oldest signup first, each exactly once, then nothing left', async () => {
  const { h, ft } = fresh()
  const rows = await seedList(h, 500, (i) => i % 8 === 3 && i < 480)
  const due = rows.filter((x) => x.due).sort((a, b) => a.createdAtMs - b.createdAtMs || byId(a, b))
  assert.equal(due.length, 60)
  const sentPerRun = []
  for (let k = 0; k < 4; k++) { const before = provider.requests.length; const r = await run(h, ft, NOW, unlimitedDay); sentPerRun.push(r.sent); if (k < 2) assert.equal(r.stopped, 'send_cap'); assert.equal(provider.requests.length - before, r.sent) }
  assert.deepEqual(sentPerRun, [20, 20, 20, 0])
  assert.deepEqual(provider.requests.map((q) => q.to), due.map((d) => d.email), 'sent in oldest-signup order across runs')
  assertNoDuplicateRecipients(); assertNoDuplicateKeys()
})

test('1,000 records, 100 due across every page: 5 runs × 20, all reached, 0 duplicates, page query shape', async () => {
  const { h, ft, } = fresh()
  const rows = await seedList(h, 1000, (i) => i % 10 === 9)
  h.calls.length = 0
  const results = []
  for (let k = 0; k < 6; k++) results.push(await run(h, ft, NOW, unlimitedDay))
  assert.deepEqual(results.map((r) => r.sent), [20, 20, 20, 20, 20, 0])
  for (const r of results) { assert.equal(r.scanned, 1000); assert.equal(r.pages, 6) }   // 5 full pages + the empty one that ends the scan
  assert.equal(provider.requests.length, 100)
  assertNoDuplicateRecipients(); assertNoDuplicateKeys()
  for (const row of rows) assert.equal(await stepOf(h, row.id), row.due ? 1 : 3)
  const claims = await claimsOf(h)
  assert.equal(claims.length, 100); assert.ok(claims.every((c) => c.outcome === 'sent' && c.seq === 1))
  // Every list read is the verified keyset query: id > cursor, ordered by id, 200 a page, never an offset.
  const allListReads = h.calls.filter((c) => c.op === 'query' && c.collection === LIST)
  const listReads = allListReads.filter((c) => c.args[1]?.where)
  assert.ok(listReads.length >= 36)
  // Plus one completeness read per run: no filter, no order, bounded at scanned + one page.
  const completeness = allListReads.filter((c) => !c.args[1]?.where)
  assert.equal(completeness.length, 6)
  for (const c of completeness) assert.deepEqual(c.args[1], { limit: 1000 + 200 })
  for (const c of listReads) {
    const o = c.args[1]
    assert.deepEqual({ where: o.where.map((w) => [w.field, w.op]), orderBy: o.orderBy, limit: o.limit, offset: o.offset }, { where: [['id', '>']], orderBy: { field: 'id', dir: 'asc' }, limit: 200, offset: undefined })
  }
})

test('page boundaries: due records at id positions 199, 200, 201, 399, 400, 401 (of 450) are each sent once', async () => {
  const { h, ft } = fresh()
  const at = new Set([198, 199, 200, 398, 399, 400])   // 0-based = positions 199…401
  const rows = await seedList(h, 450, (i) => at.has(i))
  const r = await run(h, ft)
  assert.equal(r.pages, 3); assert.equal(r.sent, 6)
  assert.deepEqual(provider.requests.map((q) => q.to).sort(), rows.filter((x) => x.due).map((x) => x.email).sort())
  assertNoDuplicateRecipients()
})

test('small pages (7) over 50 records: the cursor strictly advances and no record is read twice', async () => {
  const { h, ft } = fresh()
  await seedList(h, 50, (i) => i % 5 === 0)
  const r = await run(h, ft, NOW, { pageSize: 7 })
  assert.equal(r.scanned, 50); assert.equal(r.pages, 8); assert.equal(r.sent, 10); assert.equal(r.stopped, undefined)
  const cursors = h.calls.filter((c) => c.op === 'query' && c.collection === LIST && c.args[1]?.where).map((c) => c.args[1].where[0].value)
  for (let i = 1; i < cursors.length; i++) assert.ok(cursors[i] > cursors[i - 1], 'cursor must increase')
})

// ── 2 · Overlapping runs and interruption ───────────────────────────────────
test('overlapping runs: two runs started together send each due subscriber exactly once', async () => {
  const { h, ft } = fresh()
  const rows = await seedList(h, 500, (i) => i % 17 === 0)   // 30 due
  const [a, b] = await Promise.all([run(h, ft, NOW, unlimitedDay), run(h, ft, NOW, unlimitedDay)])
  const c = await run(h, ft, NOW, unlimitedDay)
  assert.ok(a.sent + b.sent <= 30)
  assert.equal(a.sent + b.sent + c.sent, 30)
  assert.equal(provider.requests.length, 30, 'one provider request per subscriber-step, however the runs interleave')
  assertNoDuplicateRecipients(); assertNoDuplicateKeys()
  for (const row of rows) assert.equal(await stepOf(h, row.id), row.due ? 1 : 3)
})

test('run budget: no send starts after 18 s (25 s − 5 s timeout − 2 s writes); the next run carries on, no duplicates', async () => {
  const { h, ft } = fresh()
  await seedList(h, 300, (i) => i % 10 === 0)   // 30 due
  provider.onRequest = async () => { ft.t.now += 1500 }   // each provider call takes 1.5 s
  const r1 = await run(h, ft, NOW, unlimitedDay)
  assert.equal(r1.stopped, 'time_budget'); assert.ok(r1.sent > 0 && r1.sent < 20)
  assert.ok(provider.requests.every((q) => q.at <= 18_000), 'every send started within 18 s of the run start')
  assert.equal(r1.notReached, 30 - r1.sent)
  ft.t.now = 0
  const r2 = await run(h, ft, NOW, unlimitedDay)
  assert.ok(r2.sent > 0)
  assertNoDuplicateRecipients(); assertNoDuplicateKeys()
})

test('interrupted after the provider accepted (no outcome written, step not advanced): held under 30 min, then reconciled from the provider event — never sent twice', async () => {
  const { h, ft } = fresh()
  const rows = await seedList(h, 210, (i) => i === 205)
  // The run "dies" right after the provider call: every later write fails.
  h.ctl.fault = (c) => { if (WRITES.has(c.op) && (c.collection === CLAIMS || c.collection === LIST) && c.op === 'update') throw new Error('process killed') }
  const r1 = await run(h, ft)
  assert.equal(r1.sent, 1); assert.equal(provider.requests.length, 1)
  h.ctl.fault = null
  assert.equal(await stepOf(h, rows[205].id), undefined)
  assert.equal((await claimsOf(h))[0].outcome, undefined)
  const r2 = await run(h, ft, NOW + 10 * MIN)
  assert.equal(r2.held, 1); assert.equal(provider.requests.length, 1, 'not retried while the outcome may still arrive')
  const r3 = await run(h, ft, NOW + 31 * MIN)
  assert.equal(r3.reconciled, 1); assert.equal(r3.sent, 0); assert.equal(provider.requests.length, 1)
  assert.equal(await stepOf(h, rows[205].id), 1)
  const c = (await claimsOf(h))[0]
  assert.deepEqual([c.outcome, c.reconciled], ['sent', 'provider_event'])
})

test('interrupted before the provider call (claim, no outcome, no event): after 30 min recorded not_sent and retried once with the SAME key', async () => {
  const { h, ft } = fresh()
  const rows = await seedList(h, 40, (i) => i === 3)
  const id = rows[3].id
  await h.real.create(CLAIMS, W.claimDocId(id, 1, 1), { recordId: id, step: 1, seq: 1, keyGen: 1, runId: 'dead-run', claimedAt: new Date(NOW - 40 * MIN).toISOString(), claimedAtMs: NOW - 40 * MIN })
  const r = await run(h, ft)
  assert.equal(r.sent, 1)
  assert.deepEqual(provider.requests.map((q) => q.key), [`welcome-${id}-step1`])
  const claims = (await claimsOf(h)).sort((a, b) => a.seq - b.seq)
  assert.deepEqual(claims.map((c) => [c.seq, c.outcome]), [[1, 'not_sent'], [2, 'sent']])
})

test('a recorded send whose step was never advanced is repaired without a request', async () => {
  const { h, ft } = fresh()
  const rows = await seedList(h, 30, (i) => i === 12)
  const id = rows[12].id
  await h.real.create(CLAIMS, W.claimDocId(id, 1, 1), { recordId: id, step: 1, seq: 1, keyGen: 1, runId: 'earlier', claimedAt: new Date(NOW - DAY).toISOString(), claimedAtMs: NOW - DAY, outcome: 'sent' })
  const r = await run(h, ft)
  assert.equal(r.repaired, 1); assert.equal(r.sent, 0); assert.equal(provider.requests.length, 0)
  assert.equal(await stepOf(h, id), 1)
})

test('another run already advanced the step (re-read record): nothing is sent', async () => {
  const { h, ft } = fresh()
  const rows = await seedList(h, 30, (i) => i === 5)
  h.ctl.get = (c, id) => (c === LIST && id === rows[5].id ? { id, data: { email: rows[5].email, createdAt: new Date(rows[5].createdAtMs).toISOString(), consent: true, welcomeStep: 1 } } : undefined)
  const r = await run(h, ft)
  assert.equal(r.alreadyAdvanced, 1); assert.equal(provider.requests.length, 0)
})

// ── 3 · Unknown outcomes ────────────────────────────────────────────────────
test('unknown outcome (HTTP 500) for one recipient: the run goes on to the others; that recipient is not retried before reconciliation; then retried with the same key when the provider shows no send', async () => {
  // Expectation changed by F2 (asq-welcome-fairness-v1): one recipient's unknown outcome no longer stops the run.
  const { h, ft } = fresh()
  const rows = await seedList(h, 60, (i) => i === 10 || i === 20 || i === 30)
  const first = rows.filter((x) => x.due).sort((a, b) => a.createdAtMs - b.createdAtMs || byId(a, b))[0]
  provider.respond = (q) => (q.to === first.email ? { status: 500 } : { status: 200 })
  const r1 = await run(h, ft)
  assert.equal(r1.unknown, 1); assert.equal(r1.stopped, undefined); assert.equal(r1.sent, 2); assert.equal(r1.notReached, 0)
  assert.equal(await stepOf(h, first.id), undefined)
  const r2 = await run(h, ft, NOW + 10 * MIN)
  assert.equal(r2.held, 1); assert.equal(r2.sent, 0)
  assert.equal(provider.requests.filter((q) => q.to === first.email).length, 1, 'no retry inside the reconciliation window')
  provider.respond = null
  const r3 = await run(h, ft, NOW + 31 * MIN)
  assert.equal(r3.sent, 1)
  const keys = provider.requests.filter((q) => q.to === first.email).map((q) => q.key)
  assert.deepEqual(keys, [`welcome-${first.id}-step1`, `welcome-${first.id}-step1`], 'same key: a provider that did take it answers instead of sending twice')
  const cl = (await claimsOf(h)).filter((c) => c.recordId === first.id).sort((a, b) => a.seq - b.seq)
  assert.deepEqual(cl.map((c) => [c.outcome, c.reconciled]), [['not_sent', 'no_provider_event'], ['sent', undefined]])
})

test('unknown outcome but the provider DID send (its event arrives): reconciled as sent, no second request', async () => {
  const { h, ft } = fresh()
  const rows = await seedList(h, 50, (i) => i === 44)
  provider.respond = () => ({ status: 502, accepted: true })   // the answer is lost, the message went out
  const r1 = await run(h, ft)
  assert.equal(r1.unknown, 1)
  provider.respond = null
  const r2 = await run(h, ft, NOW + 45 * MIN)
  assert.equal(r2.reconciled, 1); assert.equal(r2.sent, 0); assert.equal(provider.requests.length, 1)
  assert.equal(await stepOf(h, rows[44].id), 1)
})

test('network failure and a hanging provider are unknown outcomes (cut off by the send timeout), never failures; two in a row stop the run', async () => {
  // Expectation changed by F2: the run stops on two unknown first attempts in a row (a system-wide signal), not on the first.
  for (const mode of ['throw', 'hang']) {
    const { h, ft } = fresh()
    await seedList(h, 20, (i) => i === 2 || i === 9)
    provider.respond = () => mode
    const r = await run(h, ft, NOW, { sendTimeoutMs: 30 })
    assert.equal(r.unknown, 2, mode); assert.equal(r.failed, 0, mode); assert.equal(r.stopped, 'repeated_unknown', mode)
    assert.ok((await claimsOf(h)).every((c) => c.outcome === 'unknown'), mode)
  }
})

test('three unknown outcomes with no provider evidence: manual review, never marked sent, step never advanced', async () => {
  const { h, ft } = fresh()
  const rows = await seedList(h, 25, (i) => i === 4)
  const id = rows[4].id
  provider.respond = () => ({ status: 500 })
  for (let k = 0; k < 5; k++) await run(h, ft, NOW + k * 31 * MIN)
  assert.equal(provider.requests.length, 3, 'three attempts, then no more')
  assert.ok(provider.requests.every((q) => q.key === `welcome-${id}-step1`))
  const review = await h.real.get(REVIEWS, W.reviewDocId(id, 1))
  assert.equal(review.data.state, 'manual_review'); assert.equal(review.data.reason, 'max_attempts'); assert.equal(review.data.attempts, 3)
  assert.equal(await stepOf(h, id), undefined)
  assert.ok((await claimsOf(h)).every((c) => c.outcome !== 'sent'))
})

// ── 4 · Definite refusals and rate limits ───────────────────────────────────
test('definite refusals (422): three attempts with new keys, then manual review; the record is preserved, never marked sent', async () => {
  const { h, ft } = fresh()
  const rows = await seedList(h, 30, (i) => i === 8)
  const id = rows[8].id
  const before = structuredClone((await h.real.get(LIST, id)).data)
  provider.respond = () => ({ status: 422, message: 'Invalid `to` field' })
  const rs = []
  for (let k = 0; k < 4; k++) rs.push(await run(h, ft))
  assert.deepEqual(rs.map((r) => r.failed), [1, 1, 1, 0])
  assert.deepEqual(rs.map((r) => r.manualReview), [0, 0, 1, 1])
  assert.deepEqual(provider.requests.map((q) => q.key), [`welcome-${id}-step1`, `welcome-${id}-step1-k2`, `welcome-${id}-step1-k3`])
  const review = await h.real.get(REVIEWS, W.reviewDocId(id, 1))
  assert.deepEqual([review.data.state, review.data.reason, review.data.attempts, review.data.lastStatus], ['manual_review', 'max_attempts', 3, 422])
  assert.deepEqual((await h.real.get(LIST, id)).data, before, 'the subscriber record is untouched')
  assert.ok((await claimsOf(h)).every((c) => c.outcome === 'failed'))
})

test('HTTP 429: the run stops at once, the attempt is not counted, the next run uses a new key', async () => {
  const { h, ft } = fresh()
  const rows = await seedList(h, 40, (i) => i === 1 || i === 2 || i === 3)
  let n = 0
  provider.respond = () => (++n === 1 ? { status: 429 } : { status: 200 })
  const r1 = await run(h, ft)
  assert.equal(r1.rateLimited, 1); assert.equal(r1.stopped, 'rate_limited'); assert.equal(r1.sent, 0); assert.equal(r1.notReached, 2)
  const r2 = await run(h, ft)
  assert.equal(r2.sent, 3)
  const firstTo = provider.requests[0].to
  const id = rows.find((x) => x.email === firstTo).id
  assert.deepEqual(provider.requests.filter((q) => q.to === firstTo).map((q) => q.key), [`welcome-${id}-step1`, `welcome-${id}-step1-k2`])
  // 429s never count toward the three attempts.
  const cl = (await claimsOf(h)).filter((c) => c.recordId === id).sort((a, b) => a.seq - b.seq)
  assert.deepEqual(cl.map((c) => c.outcome), ['deferred', 'sent'])
})

test('429s do not use up attempts; three refusals after them still lead to manual review', async () => {
  const { h, ft } = fresh()
  const rows = await seedList(h, 20, (i) => i === 0)
  let n = 0
  provider.respond = () => (++n <= 2 ? { status: 429 } : { status: 400 })
  for (let k = 0; k < 6; k++) await run(h, ft)
  assert.equal(provider.requests.length, 5)
  const review = await h.real.get(REVIEWS, W.reviewDocId(rows[0].id, 1))
  assert.equal(review.data.attempts, 3)
})

// ── 5 · Daily quota ─────────────────────────────────────────────────────────
async function otherTraffic(h, count, now = NOW) {
  for (let i = 0; i < count; i++) await h.real.set(EVENTS, null, { type: 'sent', email: `other${i}@example.test`, ts: now - 2 * 60 * MIN + i, messageId: `other_${now}_${i}`, campaignId: null })
}

test('quota: 55 provider sends already today leaves 5 (100 − 40 reserve − 55) — exactly 5 drip sends, then quota_exhausted', async () => {
  const { h, ft } = fresh()
  await seedList(h, 80, (i) => i % 4 === 0)   // 20 due
  await otherTraffic(h, 55)
  provider.webhook = false   // the provider's events lag: the guard must still count this run's sends (its claims)
  const r = await run(h, ft)
  assert.equal(r.sent, 5); assert.equal(r.stopped, 'quota_exhausted')
  assert.equal(r.quota.remaining, 0); assert.equal(r.quota.providerSendsToday, 55); assert.equal(r.quota.dripAttemptsToday, 5)
})

test('quota: with the webhook live the guard double-counts drip sends — it stops early, never late (total ≤ 60)', async () => {
  const { h, ft } = fresh()
  await seedList(h, 80, (i) => i % 4 === 0)
  await otherTraffic(h, 55)
  const r = await run(h, ft)
  assert.ok(r.sent >= 1 && r.sent <= 5); assert.equal(r.stopped, 'quota_exhausted')
  assert.ok(await sentEventsToday(h) <= 60, 'the day never passes 100 − 40')
})

test('quota: at the limit nothing is sent; an unreadable count sends nothing (quota_unknown)', async () => {
  {
    const { h, ft } = fresh()
    await seedList(h, 30, (i) => i < 5)
    await otherTraffic(h, 60)
    const r = await run(h, ft)
    assert.equal(r.sent, 0); assert.equal(r.stopped, 'quota_exhausted'); assert.equal(provider.requests.length, 0)
    assert.equal((await claimsOf(h)).length, 0, 'no claim is taken when there is no quota')
  }
  {
    const { h, ft } = fresh()
    await seedList(h, 30, (i) => i < 5)
    h.ctl.fault = (c) => { if (c.op === 'query' && c.collection === EVENTS && c.args[1]?.where?.[0]?.field === 'ts') throw new Error('store down') }
    const r = await run(h, ft)
    assert.equal(r.sent, 0); assert.equal(r.stopped, 'quota_unknown'); assert.equal(provider.requests.length, 0)
  }
})

test('quota is recalculated before EVERY send: other traffic arriving mid-run is counted', async () => {
  const { h, ft } = fresh()
  await seedList(h, 100, (i) => i % 5 === 0)   // 20 due
  await otherTraffic(h, 40)
  let k = 0
  provider.onRequest = async () => { await otherTraffic(h, 3, NOW + 1000 * ++k) }   // 3 signup/notification mails per drip send
  const r = await run(h, ft)
  assert.equal(r.stopped, 'quota_exhausted')
  const quotaReads = h.calls.filter((c) => c.op === 'query' && c.collection === EVENTS && c.args[1]?.where?.[0]?.field === 'ts').length
  assert.equal(quotaReads, r.sent + 1, 'one fresh reading per send, plus the one that stopped the run')
  assert.ok(await sentEventsToday(h) <= 60)
})

test('cap: never more than 20 drip emails in one run, whatever is due', async () => {
  const { h, ft } = fresh()
  await seedList(h, 400, (i) => i % 4 === 1)   // 100 due
  const r = await run(h, ft, NOW, unlimitedDay)
  assert.equal(r.sent, 20); assert.equal(WELCOME_LIMITS.maxSendsPerRun, 20); assert.equal(r.stopped, 'send_cap'); assert.equal(r.notReached, 80)
})

test('spacing: at least 600 ms between provider calls', async () => {
  const { h, ft } = fresh()
  await seedList(h, 60, (i) => i % 6 === 0)   // 10 due
  await run(h, ft)
  const at = provider.requests.map((q) => q.at)
  for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] >= 600, `gap ${at[i] - at[i - 1]} ms`)
  assert.equal(provider.requests.length, 10)
})

// ── 6 · Consent, suppression and the other checks, on later pages ───────────
test('consent: explicit false blocks (nothing written); missing or true is sent — on page 3 of 450', async () => {
  const { h, ft } = fresh()
  const rows = await seedList(h, 450, (i) => i === 410 || i === 420 || i === 430, (r) => (r.idx === 410 ? { consent: false } : {}))
  await h.real.update(LIST, rows[420].id, { consent: undefined })   // a record without a consent value
  h.calls.length = 0
  const r = await run(h, ft)
  assert.deepEqual(r.blockedBy, { no_consent: 1 }); assert.equal(r.sent, 2)
  assert.ok(!provider.requests.some((q) => q.to === rows[410].email))
  assert.equal(h.calls.filter((c) => WRITES.has(c.op) && c.args[1] && String(c.args[1]).startsWith(rows[410].id)).length, 0, 'nothing written for the blocked subscriber')
})

test('invalid address: never sent to, never claimed, never retried across runs', async () => {
  const { h, ft } = fresh()
  const rows = await seedList(h, 30, (i) => i === 6)
  await h.real.update(LIST, rows[6].id, { email: 'bad..dots@example.test' })
  for (let k = 0; k < 3; k++) { const r = await run(h, ft, NOW + k * DAY); assert.deepEqual(r.blockedBy, { invalid_address: 1 }) }
  assert.equal(provider.requests.length, 0); assert.equal((await claimsOf(h)).length, 0)
})

test('every existing check still applies on later pages: unsubscribed after the read, deleted, permanent bounce, suppression, complaint, repeated bounces', async () => {
  const { h, ft } = fresh()
  const idx = [400, 405, 410, 415, 420, 425, 430]
  const rows = await seedList(h, 450, (i) => idx.includes(i))
  const [late, gone, perm, supp, comp, rep, ok] = idx.map((i) => rows[i])
  const ev = (e, type, extra = {}) => h.real.set(EVENTS, null, { type, email: e.email, ts: NOW - 2 * DAY, campaignId: null, ...extra })
  await ev(perm, 'bounced', { bounceType: 'Permanent', bounceSubType: 'General' })
  await ev(supp, 'suppressed')
  await ev(comp, 'complained')
  await ev(rep, 'bounced'); await h.real.set(EVENTS, null, { type: 'bounced', email: rep.email, ts: NOW - DAY })
  h.ctl.get = (c, id) => {
    if (c === LIST && id === late.id) return { id, data: { email: late.email, createdAt: new Date(late.createdAtMs).toISOString(), unsubscribed: true } }
    if (c === LIST && id === gone.id) return null
    return undefined
  }
  const r = await run(h, ft)
  assert.deepEqual(r.blockedBy, { unsubscribed: 1, not_subscribed: 1, permanent_bounce: 1, provider_suppressed: 1, complained: 1, repeated_bounce: 1 })
  assert.deepEqual(provider.requests.map((q) => q.to), [ok.email])
})

// ── 7 · Fail-closed scan, guards, disabled ──────────────────────────────────
test('a scan error on page 2 sends nothing (scan_failed)', async () => {
  const { h, ft } = fresh()
  await seedList(h, 250, (i) => i % 50 === 0)
  h.ctl.fault = (c) => { if (c.op === 'query' && c.collection === LIST && c.args[1].where[0].value !== '') throw new Error('store down') }
  const r = await run(h, ft)
  assert.equal(r.stopped, 'scan_failed'); assert.equal(r.sent, 0); assert.equal(provider.requests.length, 0)
})

test('a store that returns a page without progress stops the scan (cursor_stalled); a page cap stops it too — nothing sent', async () => {
  {
    const { h, ft } = fresh()
    await seedList(h, 30, (i) => i < 3)
    const firstPage = await h.real.query(LIST, {})
    h.ctl.query = (c) => (c === LIST ? firstPage.sort(byId).slice(0, 5) : undefined)
    const r = await run(h, ft, NOW, { pageSize: 5 })
    assert.equal(r.stopped, 'cursor_stalled'); assert.equal(r.sent, 0)
  }
  {
    const { h, ft } = fresh()
    await seedList(h, 30, (i) => i < 3)
    const r = await run(h, ft, NOW, { pageSize: 5, maxPages: 2 })
    assert.equal(r.stopped, 'page_cap'); assert.equal(r.sent, 0); assert.equal(provider.requests.length, 0)
  }
})

test('disabled: no read at all; enabled without a launch cutoff: nobody is enrolled', async () => {
  const { h, ft } = fresh()
  await seedList(h, 30, (i) => i < 5)
  delete process.env.WELCOME_SEQUENCE_ENABLED
  h.calls.length = 0
  const r1 = await run(h, ft)
  assert.equal(r1.enabled, false); assert.equal(h.calls.length, 0)
  process.env.WELCOME_SEQUENCE_ENABLED = 'true'; delete process.env.WELCOME_SEQUENCE_SINCE
  const r2 = await run(h, ft)
  assert.equal(r2.due, 0); assert.equal(provider.requests.length, 0)
})

// ── 8 · Ledger hygiene and static guards ────────────────────────────────────
test('the ledger and review documents hold no email address; welcome mail stays untagged', async () => {
  const { h, ft } = fresh()
  await seedList(h, 40, (i) => i < 4)
  // The provider's error text names the recipient: it must not reach the ledger.
  provider.respond = (q) => (q.to === provider.requests[0].to ? { status: 422, message: `Invalid \`to\` field: ${q.to} is not deliverable` } : { status: 200 })
  for (let k = 0; k < 4; k++) await run(h, ft)
  assert.ok((await h.real.query(REVIEWS, {})).length === 1, 'three refusals of the first address → one review record')
  const docs = [...(await h.real.query(CLAIMS, {})), ...(await h.real.query(REVIEWS, {}))]
  assert.ok(docs.length > 0)
  for (const d of docs) assert.ok(!JSON.stringify(d.data).includes('@'), 'no address in ledger documents')
  assert.ok(provider.requests.every((q) => q.tags === undefined))
})

test('static: the drip never paginates with offset and never passes a campaign id', () => {
  const src = readFileSync(B + 'lib/newsletter/welcome-sequence.ts', 'utf8')
  assert.ok(!/offset/.test(src.replace(/\/\/.*$/gm, '')), 'no offset paging (the production adapter applies offset twice)')
  assert.ok(!/campaignId/.test(src))
  assert.ok(/field: 'id', op: '>'/.test(src) && /orderBy: \{ field: 'id', dir: 'asc' \}/.test(src))
})

test('pure helpers: outcome classes, delivery evidence window, provider-send count', () => {
  assert.equal(W.classifySendResult({ ok: true }), 'sent')
  assert.equal(W.classifySendResult({ ok: false, skipped: true }), 'skipped')
  for (const s of [400, 422]) assert.equal(W.classifySendResult({ ok: false, status: s }), 'failed')
  // asq-welcome-alerts-v1: 401/403 refuse the ACCOUNT, not the subscriber: deferred like 429 (not an attempt).
  for (const s of [401, 403, 429]) assert.equal(W.classifySendResult({ ok: false, status: s }), 'deferred')
  for (const s of [undefined, 408, 409, 500, 502, 503]) assert.equal(W.classifySendResult({ ok: false, status: s }), 'unknown')
  const at = NOW
  assert.ok(W.hasDeliveryEvidence([{ type: 'sent', ts: at + 5000 }], at))
  assert.ok(W.hasDeliveryEvidence([{ type: 'delivered', ts: at + 60_000 }], at))
  assert.ok(!W.hasDeliveryEvidence([{ type: 'sent', ts: at + 16 * MIN }], at), 'outside the window')
  assert.ok(!W.hasDeliveryEvidence([{ type: 'sent', ts: at + 1000, campaignId: 'c1' }], at), 'a campaign email is not evidence')
  assert.ok(!W.hasDeliveryEvidence([{ type: 'bounced', ts: at + 1000 }], at))
  const day = W.utcDayStart(NOW)
  assert.equal(W.countProviderSends([
    { type: 'sent', ts: day + 1, messageId: 'a' }, { type: 'suppressed', ts: day + 2, messageId: 'a' },
    { type: 'sent', ts: day + 3 }, { type: 'delivered', ts: day + 4, messageId: 'b' }, { type: 'sent', ts: day - 1, messageId: 'c' },
  ], day), 2)
  assert.equal(W.welcomeDeliveryKey('nl_x', 2, 1), 'welcome-nl_x-step2')
  assert.equal(W.welcomeDeliveryKey('nl_x', 2, 3), 'welcome-nl_x-step2-k3')
})

// ── Review of PR #129 (13 Nov 2026) ──────────────────────────────────────────
test('review 6: a record without an `id` field is invisible to the keyset scan, so the run reports scan_incomplete and sends nothing', async () => {
  const { h, ft } = fresh()
  await seedList(h, 12, (i) => i < 4)
  await h.real.set(LIST, 'legacy_record', { email: 'legacy@example.test', createdAt: new Date(NOW - 3 * DAY).toISOString(), consent: true, list: 'asquare-newsletter' })
  await h.real.update(LIST, 'legacy_record', { id: undefined })      // a document written without the field
  const r = await run(h, ft)
  assert.equal(r.scanned, 12, 'the keyset scan itself does not see it')
  assert.equal(r.stopped, 'scan_incomplete'); assert.equal(r.sent, 0); assert.equal(provider.requests.length, 0)
  assert.equal((await claimsOf(h)).length, 0)
})

test('review 6: a completeness read that fails counts as a failed scan; a complete list is unaffected', async () => {
  const { h, ft } = fresh()
  await seedList(h, 12, (i) => i < 4)
  h.ctl.fault = (c) => { if (c.op === 'query' && c.collection === LIST && !c.args[1]?.where) throw new Error('store down') }
  const r = await run(h, ft)
  assert.equal(r.stopped, 'scan_failed'); assert.equal(r.sent, 0); assert.equal(provider.requests.length, 0)
  h.ctl.fault = null
  const r2 = await run(h, ft)
  assert.equal(r2.stopped, undefined); assert.equal(r2.sent, 4)
})

test('review 7: a pre-check that runs out of its time budget leaves the rest to the full check — same sends, no duplicates', async () => {
  const { h, ft } = fresh()
  const rows = await seedList(h, 80, (i) => i % 4 === 0)   // 20 due
  const r = await run(h, ft, NOW, { precheckBudgetMs: -1 })   // out of time before the first batch read
  assert.equal(r.precheckCutShort, true); assert.equal(r.unclassified, 20); assert.equal(r.sent, 20); assert.equal(r.stopped, undefined)
  assert.deepEqual(provider.requests.map((q) => q.to).sort(), rows.filter((x) => x.due).map((x) => x.email).sort())
  assertNoDuplicateRecipients(); assertNoDuplicateKeys()
  const r2 = await run(h, ft)
  assert.equal(r2.precheckCutShort, undefined); assert.equal(r2.sent, 0)
})
