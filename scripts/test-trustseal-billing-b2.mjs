#!/usr/bin/env node
// TrustSeal Billing — Phase B2.1 (pure webhook helpers) tests.
// webhook.ts has no VALUE project imports (only node:crypto + an erased type-only
// import), so we import it for REAL runtime coverage of signature verification,
// event parsing, and the subscription state machine — including idempotency and
// out-of-order events. We also feed transition outputs through the B1 resolver
// (deriveEntitlement) to prove webhook state drives entitlement correctly.
// Run: node --experimental-strip-types scripts/test-trustseal-billing-b2.mjs
import fs from 'node:fs'
import { createHmac } from 'node:crypto'
import { verifyRazorpaySignature, parseRazorpayEvent, applyTransition } from '../lib/billing/webhook.ts'
import { deriveEntitlement } from '../lib/billing/model.ts'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const eq = (l, got, want) => ok(`${l} (got ${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want))
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')

const SEC = 'whsec_test_secret'
const sign = (raw) => createHmac('sha256', SEC).update(raw, 'utf8').digest('hex')

// ── signature verification ────────────────────────────────────────
const raw = '{"event":"subscription.charged","x":1}'
ok('verify: valid hex HMAC accepted', verifyRazorpaySignature(raw, sign(raw), SEC))
ok('verify: tampered body rejected', !verifyRazorpaySignature(raw + ' ', sign(raw), SEC))
ok('verify: wrong secret rejected', !verifyRazorpaySignature(raw, createHmac('sha256', 'other').update(raw).digest('hex'), SEC))
ok('verify: garbage signature rejected', !verifyRazorpaySignature(raw, 'deadbeef', SEC))
ok('verify: empty inputs rejected', !verifyRazorpaySignature('', sign(raw), SEC) && !verifyRazorpaySignature(raw, '', SEC) && !verifyRazorpaySignature(raw, sign(raw), ''))

// ── event payload builder (Razorpay shape; times in SECONDS) ──────
const T = 1_750_000_000 // seconds
const payload = (event, over = {}) => ({
  entity: 'event', event, created_at: T,
  payload: {
    subscription: { entity: {
      id: 'sub_ABC', plan_id: 'plan_pro_monthly', status: 'active',
      current_start: T - 5 * 86400, current_end: T + 25 * 86400, notes: { uid: 'user_1' }, ...over,
    } },
    payment: { entity: { id: 'pay_XYZ' } },
    invoice: { entity: { id: 'inv_123' } },
  },
})

// ── parseRazorpayEvent ────────────────────────────────────────────
const ev = parseRazorpayEvent(payload('subscription.charged'), 'evt_1')
ok('parse: type + eventId', ev.type === 'subscription.charged' && ev.eventId === 'evt_1')
ok('parse: seconds → ms', ev.createdAt === T * 1000 && ev.currentEnd === (T + 25 * 86400) * 1000)
ok('parse: uid from notes', ev.uid === 'user_1')
ok('parse: payment + invoice ids', ev.paymentId === 'pay_XYZ' && ev.invoiceId === 'inv_123')
ok('parse: planId', ev.planId === 'plan_pro_monthly')
ok('parse: non-subscription event → null', parseRazorpayEvent({ event: 'payment.failed', payload: {} }, 'e') === null)
ok('parse: missing subscription entity → null', parseRazorpayEvent({ event: 'subscription.charged', payload: {} }, 'e') === null)
ok('parse: non-object body → null', parseRazorpayEvent(null, 'e') === null && parseRazorpayEvent('x', 'e') === null)
ok('parse: eventId falls back to body.id', parseRazorpayEvent({ ...payload('subscription.charged'), id: 'evt_body' }, '').eventId === 'evt_body')
ok('parse: missing notes.uid → null uid', parseRazorpayEvent(payload('subscription.charged', { notes: {} }), 'e').uid === null)

// ── applyTransition: state machine ────────────────────────────────
const E = (event, eventId, over = {}, createdAtSec = T) =>
  parseRazorpayEvent({ ...payload(event, over), created_at: createdAtSec }, eventId)

// null current + activated (has uid) → fresh active pro doc
const s1 = applyTransition(null, E('subscription.activated', 'e1'))
ok('transition: null+activated → active pro', s1 && s1.plan === 'pro' && s1.status === 'active' && s1.accountId === 'user_1')
ok('transition: sets currentEnd + identity', s1.currentEnd === (T + 25 * 86400) * 1000 && s1.razorpaySubscriptionId === 'sub_ABC')
ok('transition: null current + no uid → null (no account)', applyTransition(null, E('subscription.activated', 'e1', { notes: {} })) === null)

// authenticated → created
eq('transition: authenticated → created', applyTransition(null, E('subscription.authenticated', 'e0')).status, 'created')

// charged extends currentEnd
const charged = applyTransition(s1, E('subscription.charged', 'e2', { current_end: T + 55 * 86400 }, T + 1))
ok('transition: charged extends currentEnd + stays active', charged.status === 'active' && charged.currentEnd === (T + 55 * 86400) * 1000)

// active → pending (past_due), currentEnd unchanged
const pending = applyTransition(charged, E('subscription.pending', 'e3', {}, T + 2))
ok('transition: pending → past_due, currentEnd unchanged', pending.status === 'past_due' && pending.currentEnd === charged.currentEnd)

// past_due → charged recovery → active again
const recovered = applyTransition(pending, E('subscription.charged', 'e4', { current_end: T + 85 * 86400 }, T + 3))
ok('transition: recovery charge → active + extended', recovered.status === 'active' && recovered.currentEnd === (T + 85 * 86400) * 1000)

// cancelled with FUTURE currentEnd → cancelAtCycleEnd true
const cancelFuture = applyTransition(recovered, E('subscription.cancelled', 'e5', { current_end: T + 100 * 86400 }, T + 4))
ok('transition: cancel w/ future end → cancelled + cancelAtCycleEnd', cancelFuture.status === 'cancelled' && cancelFuture.cancelAtCycleEnd === true)

// cancelled immediate (end in the past) → cancelAtCycleEnd false
const cancelNow = applyTransition(recovered, E('subscription.cancelled', 'e6', { current_end: T - 1 }, T + 4))
ok('transition: immediate cancel → cancelAtCycleEnd false', cancelNow.status === 'cancelled' && cancelNow.cancelAtCycleEnd === false)

// completed → expired
eq('transition: completed → expired', applyTransition(recovered, E('subscription.completed', 'e7', {}, T + 5)).status, 'expired')

// updated → status unchanged, planId refreshed
const updated = applyTransition(recovered, E('subscription.updated', 'e8', { plan_id: 'plan_pro_yearly' }, T + 6))
ok('transition: updated keeps status, refreshes planId', updated.status === 'active' && updated.razorpayPlanId === 'plan_pro_yearly')

// ── IDEMPOTENCY ───────────────────────────────────────────────────
const again = applyTransition(charged, E('subscription.charged', 'e2', { current_end: T + 999 * 86400 }, T + 1))
ok('idempotency: same eventId → unchanged (no re-apply)', again === charged)

// ── OUT-OF-ORDER ──────────────────────────────────────────────────
// recovered is at lastEventAt = (T+3)s; a STALE pending from (T+1)s must be ignored.
const stale = applyTransition(recovered, E('subscription.pending', 'e9', {}, T + 1))
ok('out-of-order: older event ignored (stays active)', stale === recovered && recovered.status === 'active')
// a NEWER pending (T+10) applies.
const fresh = applyTransition(recovered, E('subscription.pending', 'e10', {}, T + 10))
ok('out-of-order: newer event applies (→ past_due)', fresh.status === 'past_due')

// ── cross-check: webhook state drives B1 entitlement correctly ────
ok('entitlement: activated → Pro active', deriveEntitlement(s1, (T + 1) * 1000).active === true)
ok('entitlement: cancelled w/ future end → Pro until end', deriveEntitlement(cancelFuture, (T + 5) * 1000).active === true)
ok('entitlement: immediate cancel → Free', deriveEntitlement(cancelNow, (T + 5) * 1000).plan === 'free')
ok('entitlement: expired → Free', deriveEntitlement(applyTransition(recovered, E('subscription.completed', 'eC', {}, T + 5)), (T + 6) * 1000).plan === 'free')

// ── static-assert: purity + scope ─────────────────────────────────
const wh = read('lib/billing/webhook.ts')
ok('webhook: only node:crypto as a VALUE import (model import is type-only)', /import \{ createHmac, timingSafeEqual \} from 'node:crypto'/.test(wh) && /import type \{[^}]*\} from '@\/lib\/billing\/model'/.test(wh))
ok('webhook: hex HMAC + timingSafeEqual', /digest\('hex'\)/.test(wh) && /timingSafeEqual/.test(wh))
ok('webhook: exports the three helpers', /export function verifyRazorpaySignature/.test(wh) && /export function parseRazorpayEvent/.test(wh) && /export function applyTransition/.test(wh))
ok('webhook: applyTransition is pure (no Date.now / no store)', !/Date\.now\(/.test(wh) && !/getStore|@\/lib\/store/.test(wh))

// scope guard: B2.1 ships NO route / cron / API client
// Durable purity guard (B2.2 legitimately adds the route): webhook.ts itself must
// stay pure — no Next/route/store code, ever.
ok('scope: webhook.ts stays pure (no Next/route/store)', !/next\/server|NextResponse|getStore|@\/lib\/store/.test(wh))
ok('scope: no billing cron route', !fs.existsSync(new URL('../app/api/cron/billing-reconcile', import.meta.url)))
ok('scope: no razorpay API client', !fs.existsSync(new URL('../lib/billing/razorpay.ts', import.meta.url)))

console.log(`\nBilling B2.1 webhook tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
