#!/usr/bin/env node
// TrustSeal Billing — Phase B2.2 (webhook ingestion layer) tests.
// The writer (lib/billing/writer.ts) injects its DocumentStore, so we exercise the
// REAL writer against a fake in-memory store for true runtime idempotency + replay
// coverage. The route (Next/'@/'-bound) is static-asserted for its security
// contract; `next build` is the integration proof.
// Run: node --experimental-strip-types scripts/test-trustseal-billing-b2-2.mjs
import fs from 'node:fs'
import { persistEventOnce, applyAndUpsert, markProcessed } from '../lib/billing/writer.ts'
import { parseRazorpayEvent, auditActionFor } from '../lib/billing/webhook.ts'
import { SUBSCRIPTIONS, BILLING_EVENTS } from '../lib/billing/model.ts'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const eq = (l, got, want) => ok(`${l} (got ${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want))
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)))

// ── minimal fake DocumentStore (clones in/out, like Firestore) ────
function fakeStore() {
  const m = new Map()
  const k = (c, id) => `${c}/${id}`
  return {
    name: 'fake',
    _dump: () => m,
    async get(c, id) { const v = m.get(k(c, id)); return v ? { id, data: clone(v) } : null },
    async set(c, id, data) { m.set(k(c, id), clone(data)); return id },
    async update(c, id, patch) { m.set(k(c, id), { ...(m.get(k(c, id)) || {}), ...clone(patch) }) },
    async delete(c, id) { m.delete(k(c, id)) },
    async query() { return [] },
    async increment(c, id, f, by) { const d = m.get(k(c, id)) || {}; d[f] = (d[f] || 0) + by; m.set(k(c, id), d); return d[f] },
  }
}

const T = 1_750_000_000
const payload = (event, over = {}, createdAtSec = T) => ({
  entity: 'event', event, created_at: createdAtSec,
  payload: {
    subscription: { entity: {
      id: 'sub_ABC', plan_id: 'plan_pro_monthly', status: 'active',
      current_start: T - 5 * 86400, current_end: T + 25 * 86400, notes: { uid: 'user_1' }, ...over,
    } },
    payment: { entity: { id: 'pay_1' } }, invoice: { entity: { id: 'inv_1' } },
  },
})
const E = (event, eventId, over = {}, createdAtSec = T) => parseRazorpayEvent(payload(event, over, createdAtSec), eventId)

// ── persistEventOnce: dedupe semantics ────────────────────────────
{
  const s = fakeStore()
  const ev = E('subscription.activated', 'evt_1')
  const a = await persistEventOnce(s, ev, 'dig')
  ok('persist: first sighting → firstSeen true', a.firstSeen === true)
  ok('persist: event stored processed=false', (await s.get(BILLING_EVENTS, 'evt_1')).data.processed === false)
  const b = await persistEventOnce(s, ev, 'dig')
  ok('persist: retry of UNPROCESSED event → firstSeen true (re-process allowed)', b.firstSeen === true)
  await markProcessed(s, 'evt_1', 'applied:active')
  ok('persist: marked processed=true', (await s.get(BILLING_EVENTS, 'evt_1')).data.processed === true)
  const c = await persistEventOnce(s, ev, 'dig')
  ok('persist: REPLAY of processed event → firstSeen false (skip)', c.firstSeen === false)
}

// ── applyAndUpsert: state writes ──────────────────────────────────
{
  const s = fakeStore()
  const r1 = await applyAndUpsert(s, E('subscription.activated', 'e1'))
  ok('apply: activated → applied, none→active', r1.applied && r1.previousStatus === 'none' && r1.nextStatus === 'active')
  ok('apply: subscription persisted active pro', (await s.get(SUBSCRIPTIONS, 'user_1')).data.status === 'active')

  const r2 = await applyAndUpsert(s, E('subscription.charged', 'e2', { current_end: T + 55 * 86400 }, T + 1))
  ok('apply: charged renewal → applied active→active', r2.applied && r2.previousStatus === 'active' && r2.nextStatus === 'active')

  const rIdem = await applyAndUpsert(s, E('subscription.charged', 'e2', { current_end: T + 999 * 86400 }, T + 1))
  ok('apply: same eventId again → applied=false (idempotent state machine)', rIdem.applied === false)
  ok('apply: idempotent no-op did NOT change currentEnd', (await s.get(SUBSCRIPTIONS, 'user_1')).data.currentEnd === (T + 55 * 86400) * 1000)

  const rStale = await applyAndUpsert(s, E('subscription.pending', 'e_old', {}, T - 100))
  ok('apply: out-of-order older event → applied=false', rStale.applied === false)
  ok('apply: stale event did NOT downgrade status', (await s.get(SUBSCRIPTIONS, 'user_1')).data.status === 'active')

  const rNoUid = await applyAndUpsert(s, E('subscription.activated', 'e_nouid', { notes: {} }))
  ok('apply: event without uid → applied=false (unmappable)', rNoUid.applied === false && rNoUid.nextStatus === 'none')
}

// ── auditActionFor mapping ────────────────────────────────────────
eq('audit: none→active = activate', auditActionFor('none', 'active'), 'billing.activate')
eq('audit: active→active = renew', auditActionFor('active', 'active'), 'billing.renew')
eq('audit: past_due→active = renew (recovery)', auditActionFor('past_due', 'active'), 'billing.renew')
eq('audit: →past_due', auditActionFor('active', 'past_due'), 'billing.past_due')
eq('audit: →halted', auditActionFor('past_due', 'halted'), 'billing.halted')
eq('audit: →cancelled', auditActionFor('active', 'cancelled'), 'billing.cancel')
eq('audit: →expired', auditActionFor('active', 'expired'), 'billing.expire')
eq('audit: →created = null (not audited)', auditActionFor('none', 'created'), null)

// ── FULL ingest flow (mirrors the route) — idempotency + replay ───
async function ingest(store, event, digest = 'd') {
  const { firstSeen } = await persistEventOnce(store, event, digest)
  if (!firstSeen) return { duplicate: true }
  const r = await applyAndUpsert(store, event)
  await markProcessed(store, event.eventId, r.applied ? `applied:${r.nextStatus}` : 'noop')
  const action = r.applied && r.nextStatus !== 'none' ? auditActionFor(r.previousStatus, r.nextStatus) : null
  return { duplicate: false, ...r, action }
}
{
  const s = fakeStore()
  const first = await ingest(s, E('subscription.activated', 'A1'))
  ok('ingest: first activate applied + billing.activate', first.applied && first.action === 'billing.activate')

  // REPLAY: identical event id again → duplicate, no mutation, no audit
  const replay = await ingest(s, E('subscription.activated', 'A1', { current_end: T + 500 * 86400 }))
  ok('ingest REPLAY: duplicate=true (no-op)', replay.duplicate === true)
  ok('ingest REPLAY: currentEnd unchanged by replay', (await s.get(SUBSCRIPTIONS, 'user_1')).data.currentEnd === (T + 25 * 86400) * 1000)

  // lifecycle: charged(renew) → pending → charged(recovery) → cancelled(future end)
  eq('ingest: charged → renew', (await ingest(s, E('subscription.charged', 'A2', { current_end: T + 55 * 86400 }, T + 1))).action, 'billing.renew')
  eq('ingest: pending → past_due', (await ingest(s, E('subscription.pending', 'A3', {}, T + 2))).action, 'billing.past_due')
  eq('ingest: recovery charge → renew', (await ingest(s, E('subscription.charged', 'A4', { current_end: T + 85 * 86400 }, T + 3))).action, 'billing.renew')
  const cancelled = await ingest(s, E('subscription.cancelled', 'A5', { current_end: T + 100 * 86400 }, T + 4))
  eq('ingest: cancel → billing.cancel', cancelled.action, 'billing.cancel')
  ok('ingest: cancelAtCycleEnd persisted', (await s.get(SUBSCRIPTIONS, 'user_1')).data.cancelAtCycleEnd === true)

  // only ONE billing_events doc per id (no duplication)
  const evDocs = [...s._dump().keys()].filter((x) => x.startsWith('ts_billing_events/'))
  eq('ingest: one event doc per id (A1..A5)', evDocs.length, 5)
}

// ── route: static-assert the security contract ────────────────────
const route = read('app/api/trustseal/webhooks/razorpay/route.ts')
ok('route: POST handler, force-dynamic', /export async function POST/.test(route) && /dynamic = 'force-dynamic'/.test(route))
ok('route: raw body via req.text() BEFORE JSON.parse', route.indexOf('req.text()') < route.indexOf('JSON.parse'))
ok('route: verifies signature, 401 on invalid', /verifyRazorpaySignature\(rawBody, signature, secret\)/.test(route) && /status: 401/.test(route))
ok('route: 503 when secret missing (fail-closed config)', /RAZORPAY_WEBHOOK_SECRET/.test(route) && /status: 503/.test(route))
ok('route: unsupported event → ACK, no mutation', /parseRazorpayEvent/.test(route) && /ignored: true/.test(route))
ok('route: dedupe → ACK no-op on replay', /persistEventOnce/.test(route) && /duplicate: true/.test(route))
ok('route: applies + marks processed', /applyAndUpsert/.test(route) && /markProcessed/.test(route))
ok('route: audits via auditActionFor', /auditActionFor\(previousStatus, nextStatus\)/.test(route) && /actor: 'public:razorpay'/.test(route))
ok('route: fail-closed → 500 on processing error', /catch \(err\)/.test(route) && /status: 500/.test(route) && /reportError\('webhook\.razorpay'/.test(route))
ok('route: writes go ONLY through writer (no direct store.set of subscriptions)', !/getStore\(\)\.set/.test(route))

// audit action union extended
const auditTs = read('lib/ai/audit.ts')
for (const a of ['billing.activate', 'billing.renew', 'billing.past_due', 'billing.halted', 'billing.cancel', 'billing.expire']) {
  ok(`audit union: ${a}`, auditTs.includes(`'${a}'`))
}

// ── scope guard: B2.2's deliverable stays focused ─────────────────
// Durable: the webhook route ingests events only — it never schedules/reconciles
// or calls the Razorpay API (those land in B2.3's cron + client elsewhere).
ok('scope: webhook route does not reconcile / schedule / call Razorpay', !/reconcile|isAuthorizedCron|fetchSubscriptionSnapshot|from ['"]razorpay['"]/.test(route))

console.log(`\nBilling B2.2 ingestion tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
