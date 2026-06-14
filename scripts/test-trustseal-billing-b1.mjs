#!/usr/bin/env node
// TrustSeal Billing — Phase B1 (foundation layer) tests.
// The pure model (lib/billing/model.ts) is dependency-free, so we import it for
// REAL runtime coverage of the entitlement decision logic. The store-bound
// service (lib/billing/entitlement.ts) chains '@/'-alias imports the harness can't
// resolve, so — per the repo convention — we STATIC-ASSERT its wiring + the
// fail-closed invariant; `next build` is the integration proof.
// Run: node --experimental-strip-types scripts/test-trustseal-billing-b1.mjs
import fs from 'node:fs'
import {
  SUBSCRIPTIONS, BILLING_EVENTS, INVOICES, PLANS, GRACE_MS,
  freeEntitlement, deriveEntitlement,
} from '../lib/billing/model.ts'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')

const DAY = 24 * 60 * 60 * 1000
const now = 1_750_000_000_000
const proSub = (over = {}) => ({
  id: 'u1', accountId: 'u1', plan: 'pro', interval: 'monthly', status: 'active',
  razorpayCustomerId: 'cust_1', razorpaySubscriptionId: 'sub_1', razorpayPlanId: 'plan_1',
  currentStart: now - 10 * DAY, currentEnd: now + 20 * DAY, cancelAtCycleEnd: false,
  scheduledChange: null, lastEventId: null, lastEventAt: null, updatedAt: now, ...over,
})

// ── collection names ──────────────────────────────────────────────
ok('collections: ts_subscriptions', SUBSCRIPTIONS === 'ts_subscriptions')
ok('collections: ts_billing_events', BILLING_EVENTS === 'ts_billing_events')
ok('collections: ts_invoices', INVOICES === 'ts_invoices')

// ── plan catalog (Free vs Pro gates) ──────────────────────────────
ok('plans: free allows exactly 1 domain', PLANS.free.maxDomains === 1)
ok('plans: pro allows >1 domain', PLANS.pro.maxDomains > 1)
ok('plans: free has NO badge widget entitlement', PLANS.free.features.badgeWidget === false)
ok('plans: pro HAS badge widget + signed badge', PLANS.pro.features.badgeWidget === true && PLANS.pro.features.signedBadge === true)
ok('plans: free has no command center / analytics', !PLANS.free.features.commandCenter && !PLANS.free.features.analytics)
ok('plans: pro unlocks command center + analytics', PLANS.pro.features.commandCenter && PLANS.pro.features.analytics)

// ── Free-plan defaults ────────────────────────────────────────────
const f = freeEntitlement()
ok('free default: plan=free, inactive', f.plan === 'free' && f.active === false)
ok('free default: status none', f.status === 'none')
ok('free default: limits maxDomains=1', f.limits.maxDomains === 1)
ok('free default: no pro features', Object.values(f.features).every((v) => v === false))
ok('free default: no currentEnd, not in grace', f.currentEnd === null && f.inGrace === false)

// ── deriveEntitlement: the core resolver ──────────────────────────
ok('derive: null subscription → Free (implicit default, no backfill)', deriveEntitlement(null, now).plan === 'free')
ok('derive: undefined subscription → Free', deriveEntitlement(undefined, now).plan === 'free')

const eActive = deriveEntitlement(proSub(), now)
ok('derive: active within period → Pro active', eActive.plan === 'pro' && eActive.active === true && eActive.inGrace === false)
ok('derive: active Pro unlocks features + limits', eActive.features.badgeWidget === true && eActive.limits.maxDomains === 10)

ok('derive: active past currentEnd but within grace → Pro (inGrace)', (() => {
  const e = deriveEntitlement(proSub({ currentEnd: now - 1 * DAY }), now)
  return e.active === true && e.inGrace === true
})())
ok('derive: active past currentEnd + grace → Free (expired)', (() => {
  const e = deriveEntitlement(proSub({ currentEnd: now - (GRACE_MS / DAY + 1) * DAY }), now)
  return e.plan === 'free' && e.active === false
})())

ok('derive: past_due within grace keeps Pro (dunning)', (() => {
  const e = deriveEntitlement(proSub({ status: 'past_due', currentEnd: now - 1 * DAY }), now)
  return e.active === true && e.inGrace === true
})())
ok('derive: past_due beyond grace → Free', deriveEntitlement(proSub({ status: 'past_due', currentEnd: now - 10 * DAY }), now).active === false)

ok('derive: cancelled with future end → Pro until period end (no extra grace)', (() => {
  const e = deriveEntitlement(proSub({ status: 'cancelled', cancelAtCycleEnd: true, currentEnd: now + 5 * DAY }), now)
  return e.active === true && e.inGrace === false
})())
ok('derive: cancelled past end → Free immediately (no grace)', deriveEntitlement(proSub({ status: 'cancelled', currentEnd: now - 1 }), now).active === false)
ok('derive: halted within paid period → Pro; past end → Free', (() => {
  const live = deriveEntitlement(proSub({ status: 'halted', currentEnd: now + 2 * DAY }), now)
  const dead = deriveEntitlement(proSub({ status: 'halted', currentEnd: now - 1 }), now)
  return live.active === true && live.inGrace === false && dead.active === false
})())
ok('derive: created (not yet activated) → Free', deriveEntitlement(proSub({ status: 'created' }), now).plan === 'free')
ok('derive: expired → Free', deriveEntitlement(proSub({ status: 'expired' }), now).plan === 'free')

// ── fail-closed invariants ────────────────────────────────────────
ok('fail-closed: pro plan but currentEnd missing → Free', deriveEntitlement(proSub({ currentEnd: null }), now).plan === 'free')
ok('fail-closed: non-pro plan value → Free', deriveEntitlement(proSub({ plan: 'free' }), now).plan === 'free')
ok('fail-closed: free entitlement is never active', freeEntitlement('active').active === false)

// ── store-bound service: static-assert wiring + fail-closed ───────
const ent = read('lib/billing/entitlement.ts')
ok('service: exports getEntitlement', /export async function getEntitlement/.test(ent))
ok('service: exports getSubscription', /export async function getSubscription/.test(ent))
ok('service: reads ts_subscriptions via store adapter', /getStore\(\)\.get<Subscription>\(SUBSCRIPTIONS, uid\)/.test(ent) && /@\/lib\/store\/adapter/.test(ent))
ok('service: resolves via the pure deriveEntitlement', /deriveEntitlement\(sub, Date\.now\(\)\)/.test(ent))
ok('service: fail-closed to Free on error (try/catch → freeEntitlement)', /catch\s*\{[\s\S]*freeEntitlement\(\)/.test(ent))
ok('service: B1 is read-only (no store writes)', !/\.set\(|\.update\(|\.delete\(/.test(ent))

// ── model: no '@/' imports (keeps it runtime-importable + pure) ───
const model = read('lib/billing/model.ts')
ok('model: dependency-free (no @/ imports)', !/from '@\//.test(model))
ok('model: defines Subscription / BillingEvent / Invoice interfaces', /interface Subscription/.test(model) && /interface BillingEvent/.test(model) && /interface Invoice/.test(model))
ok('model: idempotency key documented (event id)', /idempotency key/.test(model))

// ── Firestore indexes present ─────────────────────────────────────
const idx = JSON.parse(read('firestore.indexes.json'))
const hasIndex = (cg, fields) => idx.indexes.some((i) => i.collectionGroup === cg &&
  JSON.stringify(i.fields.map((x) => x.fieldPath)) === JSON.stringify(fields))
ok('index: ts_billing_events (subscriptionId, receivedAt)', hasIndex('ts_billing_events', ['subscriptionId', 'receivedAt']))
ok('index: ts_invoices (accountId, issuedAt)', hasIndex('ts_invoices', ['accountId', 'issuedAt']))
ok('index: ts_subscriptions (status, currentEnd)', hasIndex('ts_subscriptions', ['status', 'currentEnd']))

// ── scope guard: B1 ships NO Razorpay / webhook / UI ──────────────
// Doc comments may reference Razorpay (future phases); assert no actual
// integration exists yet — no client module, no SDK import, no key usage.
ok('scope: no razorpay integration in lib/billing', !fs.existsSync(new URL('../lib/billing/razorpay.ts', import.meta.url)) && !/from ['"]razorpay['"]|require\(['"]razorpay['"]\)|RAZORPAY_/.test(model + ent))
// Durable purity guard (later phases legitimately add the webhook route): the B1
// lib itself must never contain Next/route code.
ok('scope: B1 lib has no Next/route code', !/next\/server|NextResponse/.test(model + ent))

console.log(`\nBilling B1 foundation tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
