#!/usr/bin/env node
// TrustSeal Billing — Phase B3 (subscription checkout & dashboard) tests.
// Pure pieces (plan catalog, pendingSubscription builder, the create→webhook
// compatibility flow) run at runtime against the REAL writer + fake store. The
// '@/'/Next/network pieces (routes, client, Razorpay client) are static-asserted;
// next build is the integration proof. TEST MODE ONLY, no entitlement enforcement.
// Run: node --experimental-strip-types scripts/test-trustseal-billing-b3.mjs
import fs from 'node:fs'
import { planOption, isTestModeKey, isRazorpayConfigured, PLAN_OPTIONS } from '../lib/billing/plans.ts'
import { pendingSubscription, parseRazorpayEvent } from '../lib/billing/webhook.ts'
import { createPendingSubscription, applyAndUpsert } from '../lib/billing/writer.ts'
import { deriveEntitlement, SUBSCRIPTIONS } from '../lib/billing/model.ts'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const eq = (l, got, want) => ok(`${l} (got ${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want))
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)))
function fakeStore() {
  const m = new Map(); const k = (c, id) => `${c}/${id}`
  return {
    name: 'fake',
    async get(c, id) { const v = m.get(k(c, id)); return v ? { id, data: clone(v) } : null },
    async set(c, id, d) { m.set(k(c, id), clone(d)); return id },
    async update(c, id, p) { m.set(k(c, id), { ...(m.get(k(c, id)) || {}), ...clone(p) }) },
    async delete(c, id) { m.delete(k(c, id)) }, async query() { return [] }, async increment() { return 0 },
  }
}

// ── plan catalog ──────────────────────────────────────────────────
// Pro monthly+yearly (default tier) + Business monthly+yearly (Phase: Business billing).
ok('plans: Pro monthly + yearly options', planOption('monthly') && planOption('yearly') && planOption('monthly').tier === 'pro')
ok('plans: Business monthly + yearly options', planOption('monthly', 'business') && planOption('yearly', 'business') && planOption('monthly', 'business').tier === 'business')
eq('plans: monthly price', planOption('monthly').amountPaise, 49900)
eq('plans: yearly price', planOption('yearly').amountPaise, 499000)
eq('plans: monthly env var', planOption('monthly').envVar, 'RAZORPAY_PLAN_PRO_MONTHLY')
eq('plans: yearly env var', planOption('yearly').envVar, 'RAZORPAY_PLAN_PRO_YEARLY')
ok('plans: unknown interval → null', planOption('weekly') === null && planOption('') === null)
ok('plans: test-mode key detection', isTestModeKey('rzp_test_abc') && !isTestModeKey('rzp_live_abc') && !isTestModeKey(undefined))
ok('plans: billing-configured accepts live AND test, rejects unconfigured', isRazorpayConfigured('rzp_live_abc') && isRazorpayConfigured('rzp_test_abc') && !isRazorpayConfigured('') && !isRazorpayConfigured(undefined))

// ── pendingSubscription builder (pure) ────────────────────────────
const T = 1_750_000_000_000
const pend = pendingSubscription('user_1', { interval: 'monthly', razorpaySubscriptionId: 'sub_NEW', razorpayPlanId: 'plan_pro_monthly', razorpayCustomerId: 'cust_9' }, T)
ok('pending: status created (NOT entitled yet)', pend.status === 'created' && pend.plan === 'pro')
ok('pending: no currentEnd → entitlement Free until activation', pend.currentEnd === null && deriveEntitlement(pend, T).plan === 'free')
ok('pending: stores razorpay ids + interval', pend.razorpaySubscriptionId === 'sub_NEW' && pend.razorpayPlanId === 'plan_pro_monthly' && pend.interval === 'monthly' && pend.razorpayCustomerId === 'cust_9')
ok('pending: id == uid (one per account)', pend.id === 'user_1' && pend.accountId === 'user_1')

// ── SUBSCRIPTION CREATION (writer + fake store) ───────────────────
{
  const s = fakeStore()
  const sub = await createPendingSubscription(s, { uid: 'user_1', interval: 'yearly', razorpaySubscriptionId: 'sub_Y', razorpayPlanId: 'plan_pro_yearly' }, T)
  ok('create: persists a created record', sub.status === 'created')
  ok('create: readable from store', (await s.get(SUBSCRIPTIONS, 'user_1')).data.razorpaySubscriptionId === 'sub_Y')
  ok('create: does NOT grant Pro (entitlement still Free)', deriveEntitlement((await s.get(SUBSCRIPTIONS, 'user_1')).data, T).active === false)
}

// ── notes.uid PROPAGATION → webhook compatibility ─────────────────
// A subscription created with notes.uid produces webhook payloads carrying that
// uid; the webhook path must map it back and activate the SAME account.
{
  const s = fakeStore()
  await createPendingSubscription(s, { uid: 'user_7', interval: 'monthly', razorpaySubscriptionId: 'sub_7', razorpayPlanId: 'plan_pro_monthly' }, T)
  // Razorpay sends subscription.activated carrying notes.uid = user_7
  const evt = parseRazorpayEvent({
    entity: 'event', event: 'subscription.activated', created_at: (T + 1000) / 1000,
    payload: { subscription: { entity: { id: 'sub_7', plan_id: 'plan_pro_monthly', status: 'active', current_start: T / 1000, current_end: (T / 1000) + 30 * 86400, notes: { uid: 'user_7' } } } },
  }, 'evt_act')
  ok('webhook-compat: parsed uid matches the created account', evt.uid === 'user_7')
  const r = await applyAndUpsert(s, evt)
  ok('webhook-compat: activation applies to the created subscription', r.applied && r.previousStatus === 'created' && r.nextStatus === 'active')
  ok('webhook-compat: account now entitled Pro', deriveEntitlement((await s.get(SUBSCRIPTIONS, 'user_7')).data, T + 2000).active === true)
}

// ── CANCELLATION LIFECYCLE (create → activate → cancel webhook) ───
{
  const s = fakeStore()
  await createPendingSubscription(s, { uid: 'user_c', interval: 'monthly', razorpaySubscriptionId: 'sub_c', razorpayPlanId: 'plan_pro_monthly' }, T)
  const mk = (event, over, atSec) => parseRazorpayEvent({ entity: 'event', event, created_at: atSec, payload: { subscription: { entity: { id: 'sub_c', plan_id: 'plan_pro_monthly', status: 'active', notes: { uid: 'user_c' }, ...over } } } }, event)
  await applyAndUpsert(s, mk('subscription.activated', { current_start: T / 1000, current_end: (T / 1000) + 30 * 86400 }, T / 1000 + 1))
  const cancel = await applyAndUpsert(s, mk('subscription.cancelled', { current_end: (T / 1000) + 30 * 86400 }, T / 1000 + 2))
  ok('cancel-lifecycle: cancelled applied, cancelAtCycleEnd set', cancel.nextStatus === 'cancelled' && (await s.get(SUBSCRIPTIONS, 'user_c')).data.cancelAtCycleEnd === true)
  const ent = deriveEntitlement((await s.get(SUBSCRIPTIONS, 'user_c')).data, T + 5 * 86400000)
  ok('cancel-lifecycle: still Pro until period end (server-authoritative)', ent.active === true)
}

// ── /subscribe route (static-assert contract) ─────────────────────
const sub = read('app/api/trustseal/billing/subscribe/route.ts')
ok('subscribe: authenticated (requireUser → 401)', /requireUser\(req\)/.test(sub) && /status: 401/.test(sub))
ok('subscribe: requires configured Razorpay key (live OR test), else 503', /isRazorpayConfigured\(process\.env\.RAZORPAY_KEY_ID\)/.test(sub) && /billing_not_configured/.test(sub))
ok('subscribe: stamps notes.uid (createSubscription with uid)', /createSubscription\(\{ planId, uid: user\.uid/.test(sub))
ok('subscribe: stores subscription reference', /createPendingSubscription\(/.test(sub))
ok('subscribe: server-authoritative (blocks double-subscribe when entitled)', /getEntitlement\(user\.uid\)/.test(sub) && /already_subscribed/.test(sub))
ok('subscribe: returns hosted-checkout short_url', /shortUrl: created\.shortUrl/.test(sub))
ok('subscribe: does NOT grant entitlement locally (no status active write)', !/status: 'active'/.test(sub))

// ── /status + /cancel routes ──────────────────────────────────────
const stat = read('app/api/trustseal/billing/status/route.ts')
ok('status: authed display projection via getEntitlement (read-only)', /requireUser/.test(stat) && /getEntitlement\(user\.uid\)/.test(stat) && !/\.set\(|\.update\(/.test(stat))
ok('status: returns plan/status/currentEnd/interval', /plan: ent\.plan/.test(stat) && /currentEnd: ent\.currentEnd/.test(stat) && /interval: sub\?\.interval/.test(stat))
const cancel = read('app/api/trustseal/billing/cancel/route.ts')
ok('cancel: authed + billing-configured + server-authoritative (no local status mutation)', /requireUser/.test(cancel) && /isRazorpayConfigured/.test(cancel) && /cancelSubscription\(/.test(cancel) && !/\.set\(SUBSCRIPTIONS/.test(cancel))

// ── Razorpay client: create + cancel (writes); still no entitlement grant ─
const client = read('lib/billing/razorpay.ts')
ok('client: createSubscription POSTs with notes.uid', /export async function createSubscription/.test(client) && /method: 'POST'/.test(client) && /notes: \{ uid: opts\.uid \}/.test(client))
ok('client: cancelSubscription POSTs cancel', /export async function cancelSubscription/.test(client) && /\/cancel`/.test(client))

// ── DASHBOARD RENDERING (static-assert) ───────────────────────────
const ui = read('components/trustseal/billing/billing-section.tsx')
ok('dashboard: client component', /^'use client'/.test(ui))
// i18n: labels now flow through t(locale, 'dash.*') instead of hardcoded English.
ok('dashboard: shows current plan + status + renewal', /x\('dash\.planLabel'\)/.test(ui) && /x\('dash\.statusLabel'\)/.test(ui) && /x\('dash\.renewsLabel'\)/.test(ui))
ok('dashboard: billing history placeholder', /x\('dash\.invoicesSoon'\)/.test(ui))
ok('dashboard: upgrade + manage controls', /x\('dash\.upgradeMonthly'\)/.test(ui) && /x\('dash\.cancelSub'\)/.test(ui))
ok('dashboard: fetches status with Bearer token (display only)', /\/api\/trustseal\/billing\/status/.test(ui) && /Bearer \$\{user\.idToken\}/.test(ui))
ok('dashboard: subscribe redirects to hosted checkout', /window\.location\.href = data\.shortUrl/.test(ui))
ok('dashboard: NO entitlement enforcement (display only)', !/getEntitlement|requirePro/.test(ui))
const dash = read('components/trustseal/dashboard-client.tsx')
ok('dashboard: BillingSection mounted in the dashboard', /<BillingSection locale=\{locale\} \/>/.test(dash))

// ── scope guards ──────────────────────────────────────────────────
// Durable: B3's checkout/dashboard surfaces don't perform capability enforcement
// (that's B4's enforce.ts, applied to the badge/command surfaces — not here).
ok('scope: B3 checkout/dashboard does not import the enforcement gateway', !/@\/lib\/billing\/enforce/.test(sub + stat + cancel + ui))
ok('scope: no invoice generation (B5)', !fs.existsSync(new URL('../lib/billing/invoice.ts', import.meta.url)) && !/generateInvoice/.test(sub + stat + cancel))

console.log(`\nBilling B3 checkout/dashboard tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
