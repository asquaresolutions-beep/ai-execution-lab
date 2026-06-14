#!/usr/bin/env node
// TrustSeal Billing — Phase B2.3 (reconciliation layer) tests.
// The reconcile service injects BOTH the store and the snapshot fetcher, so we
// exercise the REAL service against a fake store + fake fetcher for true runtime
// coverage of missed-webhook recovery, duplicate/stale/out-of-order resilience,
// and drift healing. Pure reconcileSubscription is tested directly; the cron route
// + Razorpay client are static-asserted (network/'@/'); next build is the proof.
// Run: node --experimental-strip-types scripts/test-trustseal-billing-b2-3.mjs
import fs from 'node:fs'
import { reconcileSubscription, mapRazorpayStatus, parseRazorpayEvent } from '../lib/billing/webhook.ts'
import { reconcileAccount, reconcileDue } from '../lib/billing/reconcile.ts'
import { deriveEntitlement, SUBSCRIPTIONS, BILLING_EVENTS } from '../lib/billing/model.ts'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const eq = (l, got, want) => ok(`${l} (got ${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want))
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)))

function fakeStore() {
  const m = new Map(); const k = (c, id) => `${c}/${id}`
  return {
    name: 'fake', _set: (c, id, d) => m.set(k(c, id), clone(d)),
    async get(c, id) { const v = m.get(k(c, id)); return v ? { id, data: clone(v) } : null },
    async set(c, id, d) { m.set(k(c, id), clone(d)); return id },
    async update(c, id, p) { m.set(k(c, id), { ...(m.get(k(c, id)) || {}), ...clone(p) }) },
    async delete(c, id) { m.delete(k(c, id)) },
    async query(c, opts = {}) {
      let rows = [...m.entries()].filter(([key]) => key.startsWith(c + '/')).map(([key, data]) => ({ id: key.slice(c.length + 1), data: clone(data) }))
      for (const f of opts.where || []) rows = rows.filter((r) => r.data[f.field] === f.value)
      if (opts.orderBy) rows.sort((a, b) => (a.data[opts.orderBy.field] - b.data[opts.orderBy.field]) * (opts.orderBy.dir === 'desc' ? -1 : 1))
      return opts.limit ? rows.slice(0, opts.limit) : rows
    },
    async increment() { return 0 },
  }
}

const T = 1_750_000_000_000 // ms
const sub = (over = {}) => ({
  id: 'user_1', accountId: 'user_1', plan: 'pro', interval: 'monthly', status: 'active',
  razorpayCustomerId: 'cust_1', razorpaySubscriptionId: 'sub_ABC', razorpayPlanId: 'plan_pro_monthly',
  currentStart: T - 5 * 86400000, currentEnd: T + 25 * 86400000, cancelAtCycleEnd: false,
  scheduledChange: null, lastEventId: 'e1', lastEventAt: T - 1000, updatedAt: T - 1000, ...over,
})
const snap = (over = {}) => ({
  subscriptionId: 'sub_ABC', status: 'active', uid: 'user_1', planId: 'plan_pro_monthly',
  currentStart: T - 5 * 86400000, currentEnd: T + 25 * 86400000, ...over,
})

// ── pure mapping ──────────────────────────────────────────────────
eq('map: active', mapRazorpayStatus('active'), 'active')
eq('map: pending → past_due', mapRazorpayStatus('pending'), 'past_due')
eq('map: halted', mapRazorpayStatus('halted'), 'halted')
eq('map: cancelled', mapRazorpayStatus('cancelled'), 'cancelled')
eq('map: completed → expired', mapRazorpayStatus('completed'), 'expired')
eq('map: authenticated → created', mapRazorpayStatus('authenticated'), 'created')
eq('map: unknown → null (fail-closed)', mapRazorpayStatus('weird'), null)

// ── pure reconcileSubscription ────────────────────────────────────
ok('reconcile: no drift → changed=false (idempotent)', reconcileSubscription(sub(), snap(), T).changed === false)
ok('reconcile: unknown snapshot status → no change (fail-closed)', reconcileSubscription(sub(), snap({ status: 'weird' }), T).changed === false)
{
  const r = reconcileSubscription(sub({ status: 'created', currentEnd: null }), snap({ status: 'active' }), T)
  ok('reconcile: missed activation (created→active) heals', r.changed && r.next.status === 'active' && r.next.currentEnd === T + 25 * 86400000)
}
{
  const r = reconcileSubscription(sub({ status: 'active' }), snap({ status: 'cancelled', currentEnd: T + 10 * 86400000 }), T)
  ok('reconcile: drift active→cancelled heals + cancelAtCycleEnd', r.changed && r.next.status === 'cancelled' && r.next.cancelAtCycleEnd === true)
}
{
  const r = reconcileSubscription(sub({ status: 'past_due' }), snap({ status: 'active', currentEnd: T + 60 * 86400000 }), T)
  ok('reconcile: recovery past_due→active heals + extends', r.changed && r.next.status === 'active' && r.next.currentEnd === T + 60 * 86400000)
}
ok('reconcile: no local + no uid → no change', reconcileSubscription(null, snap({ uid: null }), T).changed === false)
ok('reconcile: leaves lastEventId/At untouched (webhook ordering preserved)', (() => {
  const r = reconcileSubscription(sub({ status: 'created' }), snap({ status: 'active' }), T)
  return r.next.lastEventId === 'e1' && r.next.lastEventAt === T - 1000
})())

// ── service: reconcileAccount (real service + fake ports) ─────────
{
  const s = fakeStore(); s._set(SUBSCRIPTIONS, 'user_1', sub({ status: 'created', currentEnd: null }))
  const fetcher = async () => snap({ status: 'active' })
  const out = await reconcileAccount(s, fetcher, 'user_1', T)
  ok('service: MISSED WEBHOOK recovery (created→active healed)', out.healed && out.from === 'created' && out.to === 'active')
  ok('service: healed state persisted', (await s.get(SUBSCRIPTIONS, 'user_1')).data.status === 'active')
  // entitlement now Pro (cross-check with B1)
  ok('service: healed sub → entitlement Pro', deriveEntitlement((await s.get(SUBSCRIPTIONS, 'user_1')).data, T).active === true)
}
{
  const s = fakeStore(); s._set(SUBSCRIPTIONS, 'user_1', sub())
  const out = await reconcileAccount(s, async () => snap(), T) // identical → no drift
  ok('service: no drift → not healed (idempotent)', out.healed === false && out.changed === false)
}
{
  const s = fakeStore(); const before = sub(); s._set(SUBSCRIPTIONS, 'user_1', before)
  const out = await reconcileAccount(s, async () => { throw new Error('429') }, 'user_1', T) // fetch error
  ok('service: FAIL-CLOSED on fetch error (skipped, no mutation)', out.skipped === 'fetch_error' && out.healed === false)
  eq('service: local unchanged after fetch error', (await s.get(SUBSCRIPTIONS, 'user_1')).data.status, before.status)
}
{
  const s = fakeStore(); s._set(SUBSCRIPTIONS, 'user_1', sub())
  const out = await reconcileAccount(s, async () => null, 'user_1', T) // no snapshot
  ok('service: no snapshot → skipped, no mutation', out.skipped === 'no_snapshot' && out.healed === false)
}
{
  const s = fakeStore() // no local doc
  const out = await reconcileAccount(s, async () => snap(), T)
  ok('service: no local subscription → skipped', out.skipped === 'no_subscription')
}

// ── service: reconcileDue sweep ──────────────────────────────────
{
  const s = fakeStore()
  s._set(SUBSCRIPTIONS, 'u_drift', sub({ id: 'u_drift', accountId: 'u_drift', razorpaySubscriptionId: 'sub_d', status: 'past_due' }))
  s._set(SUBSCRIPTIONS, 'u_ok', sub({ id: 'u_ok', accountId: 'u_ok', razorpaySubscriptionId: 'sub_o', status: 'active' }))
  s._set(SUBSCRIPTIONS, 'u_done', sub({ id: 'u_done', accountId: 'u_done', razorpaySubscriptionId: 'sub_x', status: 'expired' })) // terminal, excluded
  const fetcher = async (id) => id === 'sub_d' ? snap({ status: 'active', currentEnd: T + 90 * 86400000 }) : snap()
  const res = await reconcileDue(s, fetcher, { now: T, limit: 50 })
  ok('sweep: scans non-terminal subs only (expired excluded)', res.scanned === 2)
  ok('sweep: heals exactly the drifted one', res.healed === 1 && res.outcomes.find((o) => o.uid === 'u_drift').to === 'active')
  ok('sweep: drifted sub persisted as active', (await s.get(SUBSCRIPTIONS, 'u_drift')).data.status === 'active')
}

// ── audit finding F3: metadata persisted on billing events ───────
{
  const ev = parseRazorpayEvent({
    entity: 'event', event: 'subscription.charged', created_at: T / 1000,
    payload: {
      subscription: { entity: { id: 'sub_ABC', plan_id: 'plan_pro_monthly', status: 'active', current_start: T / 1000, current_end: T / 1000 + 30 * 86400, notes: { uid: 'user_1' } } },
      payment: { entity: { id: 'pay_1', amount: 49900, currency: 'INR' } },
      invoice: { entity: { id: 'inv_1' } },
    },
  }, 'evt_meta')
  ok('F3: event parses amount + currency', ev.amount === 49900 && ev.currency === 'INR')
  const w = read('lib/billing/writer.ts')
  ok('F3: writer persists paymentId/invoiceId/amount/currency/period', /paymentId: event\.paymentId/.test(w) && /invoiceId: event\.invoiceId/.test(w) && /amount: event\.amount/.test(w) && /currency: event\.currency/.test(w) && /currentEnd: event\.currentEnd/.test(w))
  const model = read('lib/billing/model.ts')
  ok('F3: BillingEvent model carries the metadata fields', /paymentId: string \| null/.test(model) && /amount: number \| null/.test(model) && /currentEnd: number \| null/.test(model))
}

// ── audit findings F1 + F2: route guards (static-assert) ─────────
const route = read('app/api/trustseal/webhooks/razorpay/route.ts')
ok('F1: route rejects empty event id with 400', /if \(!eventId\) return NextResponse\.json\(\{ error: 'missing_event_id' \}, \{ status: 400 \}\)/.test(route))
ok('F2: route reports unmapped events (missing uid)', /if \(!event\.uid\)/.test(route) && /reportError\('webhook\.razorpay\.unmapped'/.test(route))

// ── cron route + client (static-assert) ──────────────────────────
const cron = read('app/api/cron/billing-reconcile/route.ts')
ok('cron: CRON_SECRET auth via isAuthorizedCron, 401', /isAuthorizedCron\(req\)/.test(cron) && /status: 401/.test(cron))
ok('cron: calls reconcileDue with the real snapshot fetcher', /reconcileDue\(getStore\(\), fetchSubscriptionSnapshot/.test(cron))
ok('cron: audits healed accounts (billing.reconcile)', /action: 'billing\.reconcile'/.test(cron) && /if \(o\.healed\)/.test(cron))
ok('cron: fail-closed → 500 + reportError', /status: 500/.test(cron) && /reportError\('cron\.billing_reconcile'/.test(cron))
const client = read('lib/billing/razorpay.ts')
ok('client: exposes snapshot fetch for reconcile', /export async function fetchSubscriptionSnapshot/.test(client))
ok('client: fail-closed (returns null on missing config / error)', /if \(!keyId \|\| !keySecret/.test(client) && /return null/.test(client))

// audit union extended
const auditTs = read('lib/ai/audit.ts')
ok('audit union: billing.reconcile + billing.unmapped', /'billing\.reconcile'/.test(auditTs) && /'billing\.unmapped'/.test(auditTs))

// vercel cron registered
const vercel = JSON.parse(read('vercel.json'))
ok('vercel: billing-reconcile cron scheduled', vercel.crons.some((c) => c.path === '/api/cron/billing-reconcile'))

// ── scope guard: NO checkout / subscription-creation / UI ────────
// Durable: the reconcile path is READ-ONLY — the service + cron never create or
// cancel subscriptions (B3 owns those writes, elsewhere).
const reconcileSrc = read('lib/billing/reconcile.ts')
ok('scope: reconcile service never creates/cancels subscriptions', !/createSubscription|cancelSubscription/.test(reconcileSrc))
ok('scope: reconcile cron never creates/cancels subscriptions', !/createSubscription|cancelSubscription/.test(cron))

console.log(`\nBilling B2.3 reconciliation tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
