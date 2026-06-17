#!/usr/bin/env node
// TrustSeal Billing — cancellation lifecycle (Fix #1 + #2) tests.
// Runtime coverage of cancel-at-cycle-end parsing/sync/reconcile (pure), plus
// static-assert of the /cancel persistence, /reactivate route, and dashboard UI.
// Run: node --experimental-strip-types scripts/test-trustseal-billing-cancel.mjs
import fs from 'node:fs'
import { parseRazorpayEvent, applyTransition, reconcileSubscription } from '../lib/billing/webhook.ts'
import { deriveEntitlement, SUBSCRIPTIONS } from '../lib/billing/model.ts'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')

const T = 1_750_000_000 // seconds
const evtBody = (event, subOver = {}, atSec = T) => ({
  entity: 'event', event, created_at: atSec,
  payload: { subscription: { entity: {
    id: 'sub_C', plan_id: 'plan_pro_yearly', status: 'active',
    current_start: T - 5 * 86400, current_end: T + 300 * 86400, notes: { uid: 'user_C' }, ...subOver,
  } } },
})
const E = (event, id, subOver = {}, atSec = T) => parseRazorpayEvent(evtBody(event, subOver, atSec), id)
const sub = (over = {}) => ({
  id: 'user_C', accountId: 'user_C', plan: 'pro', interval: 'yearly', status: 'active',
  razorpayCustomerId: 'c', razorpaySubscriptionId: 'sub_C', razorpayPlanId: 'plan_pro_yearly',
  currentStart: (T - 5 * 86400) * 1000, currentEnd: (T + 300 * 86400) * 1000, cancelAtCycleEnd: false,
  scheduledChange: null, lastEventId: 'e0', lastEventAt: (T - 10) * 1000, updatedAt: (T - 10) * 1000, ...over,
})

// ── parse: cancel_at_cycle_end (true / 1 / false / 0 / absent) ────
ok('parse: cancel_at_cycle_end true', E('subscription.updated', 'u1', { cancel_at_cycle_end: true }).cancelAtCycleEnd === true)
ok('parse: cancel_at_cycle_end 1 → true', E('subscription.updated', 'u1', { cancel_at_cycle_end: 1 }).cancelAtCycleEnd === true)
ok('parse: cancel_at_cycle_end false', E('subscription.updated', 'u1', { cancel_at_cycle_end: false }).cancelAtCycleEnd === false)
ok('parse: absent → null', E('subscription.charged', 'c1').cancelAtCycleEnd === null)

// ── Fix #2 core: subscription.updated syncs the scheduled-cancel flag ──
{
  const cur = sub() // active, not scheduled
  const next = applyTransition(cur, E('subscription.updated', 'u2', { cancel_at_cycle_end: true }, T + 1))
  ok('updated: status STAYS active', next.status === 'active')
  ok('updated: cancelAtCycleEnd set true', next.cancelAtCycleEnd === true)
  ok('updated: currentEnd unchanged (still future)', next.currentEnd === cur.currentEnd)
  // Requirement 5: entitlement stays Pro until currentEnd
  ok('entitlement: still ACTIVE/Pro after scheduled cancel', deriveEntitlement(next, (T + 2) * 1000).active === true)
  ok('entitlement: free only AFTER currentEnd (downgrade logic unchanged)', deriveEntitlement(next, (T + 400 * 86400) * 1000).active === false)
}

// ── updated clearing the flag (reactivation reflected by Razorpay) ──
ok('updated: cancel flag false clears it', applyTransition(sub({ cancelAtCycleEnd: true }), E('subscription.updated', 'u3', { cancel_at_cycle_end: false }, T + 1)).cancelAtCycleEnd === false)

// ── charged honors the flag (default false when absent) ──
ok('charged: absent flag → cancelAtCycleEnd false (unchanged behavior)', applyTransition(sub(), E('subscription.charged', 'c2', {}, T + 1)).cancelAtCycleEnd === false)

// ── Fix #1 (reconcile): heal scheduled-cancel set directly in Razorpay ──
{
  const snap = { subscriptionId: 'sub_C', status: 'active', uid: 'user_C', planId: 'plan_pro_yearly', currentStart: (T - 5 * 86400) * 1000, currentEnd: (T + 300 * 86400) * 1000, cancelAtCycleEnd: true }
  const r = reconcileSubscription(sub({ cancelAtCycleEnd: false }), snap, T * 1000)
  ok('reconcile: heals cancelAtCycleEnd true from snapshot', r.changed && r.next.cancelAtCycleEnd === true && r.next.status === 'active')
  // no drift when already matching
  const r2 = reconcileSubscription(sub({ cancelAtCycleEnd: true }), snap, T * 1000)
  ok('reconcile: no-op when flag already matches', r2.changed === false)
}

// ── static-assert: /cancel persists immediately (Fix #1) ──
const cancel = read('app/api/trustseal/billing/cancel/route.ts')
ok('cancel: persists scheduled-cancel via setCancelScheduled', /setCancelScheduled\(getStore\(\), user\.uid, true\)/.test(cancel))
ok('cancel: persists only after Razorpay 200 (call order)', cancel.indexOf('cancelSubscription(sub.razorpaySubscriptionId') < cancel.indexOf('setCancelScheduled(getStore()'))
const writer = read('lib/billing/writer.ts')
ok('writer: setCancelScheduled updates cancelAtCycleEnd', /export async function setCancelScheduled/.test(writer) && /cancelAtCycleEnd: value/.test(writer))

// ── static-assert: /reactivate route ──
const react = read('app/api/trustseal/billing/reactivate/route.ts')
ok('reactivate: authed + billing-configured (live OR test)', /requireUser/.test(react) && /isRazorpayConfigured/.test(react))
ok('reactivate: requires cancel-scheduled state', /sub\.cancelAtCycleEnd/.test(react) && /not_cancel_scheduled/.test(react))
ok('reactivate: resubscribes via createSubscription, returns shortUrl', /createSubscription\(/.test(react) && /shortUrl: created\.shortUrl/.test(react))
ok('reactivate: non-destructive (no pending downgrade write)', !/createPendingSubscription|status: 'created'/.test(react))

// ── static-assert: razorpay snapshot reads the flag ──
const rzp = read('lib/billing/razorpay.ts')
ok('snapshot: reads cancel_at_cycle_end', /cancel_at_cycle_end/.test(rzp) && /cancelAtCycleEnd:/.test(rzp))

// ── static-assert: dashboard UI (Fix #2) ──
const ui = read('components/trustseal/billing/billing-section.tsx')
// i18n: banner + button labels now flow through t(locale, 'dash.*').
ok('UI: cancelled-but-active banner', /x\('dash\.cancelledBanner'\)/.test(ui) && /\.replace\('\{date\}'/.test(ui))
ok('UI: Reactivate button replaces Cancel when scheduled', /x\('dash\.reactivate'\)/.test(ui) && /isCancelScheduled \? \(/.test(ui))
ok('UI: isCancelScheduled = active && cancelAtCycleEnd', /isCancelScheduled = isPaid && \(status\?\.cancelAtCycleEnd/.test(ui))
ok('UI: reactivate calls the endpoint', /\/api\/trustseal\/billing\/reactivate/.test(ui))

console.log(`\nBilling cancellation-lifecycle tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
