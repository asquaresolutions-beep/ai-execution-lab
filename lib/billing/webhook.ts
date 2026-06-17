// ─────────────────────────────────────────────────────────────────
// lib/billing/webhook.ts  (asq-trustseal-billing-b2)
// PURE Razorpay subscription-webhook helpers — signature verification, event
// normalization, and the subscription state machine. No project VALUE imports
// (only node:crypto + a type-only model import that is erased at runtime), so the
// logic is unit-tested directly under `node --experimental-strip-types` with zero
// drift from shipped behavior. Mirrors lib/email/webhook.ts.
//
// Phase B2.1 scope: verifyRazorpaySignature / parseRazorpayEvent / applyTransition.
// NO route, NO cron, NO Razorpay API client, NO checkout, NO UI — those are later.
// applyTransition is the ONLY place subscription state is computed; the (future)
// route + reconcile cron both call it so webhook-driven and reconciled writes are
// byte-identical.
// ─────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Subscription, SubscriptionStatus, BillingInterval, BillingPlan } from '@/lib/billing/model'

// Audit action emitted for a status transition (consumed by the route's audit log).
export type BillingAuditAction =
  | 'billing.activate' | 'billing.renew' | 'billing.past_due'
  | 'billing.halted' | 'billing.cancel' | 'billing.expire'

/**
 * PURE: map a (previous → next) status change to the audit action to log, or null
 * when the change is not auditable (e.g. → created, or no real change). A move INTO
 * active is `activate` from a cold state, else `renew` (recurring charge / recovery).
 */
export function auditActionFor(prev: SubscriptionStatus | 'none', next: SubscriptionStatus): BillingAuditAction | null {
  switch (next) {
    case 'active': return prev === 'active' || prev === 'past_due' ? 'billing.renew' : 'billing.activate'
    case 'past_due': return 'billing.past_due'
    case 'halted': return 'billing.halted'
    case 'cancelled': return 'billing.cancel'
    case 'expired': return 'billing.expire'
    default: return null
  }
}

// ── Signature verification ────────────────────────────────────────
// Razorpay signs webhooks as hex HMAC-SHA256(rawBody, webhookSecret), delivered in
// the `x-razorpay-signature` header. Verify over the RAW body (before JSON.parse).
export function verifyRazorpaySignature(rawBody: string, signature: string, secret: string): boolean {
  if (!rawBody || !signature || !secret) return false
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature, 'utf8')
  if (a.length !== b.length) return false // timingSafeEqual throws on length mismatch
  return timingSafeEqual(a, b)
}

// ── Event normalization ───────────────────────────────────────────
// The subscription lifecycle events we act on. 'subscription.updated' is handled
// (refresh plan/identity) but does not by itself change status.
export type RazorpayEventType =
  | 'subscription.authenticated'
  | 'subscription.activated'
  | 'subscription.charged'
  | 'subscription.pending'
  | 'subscription.halted'
  | 'subscription.cancelled'
  | 'subscription.completed'
  | 'subscription.updated'

// status to set per event ('updated' → null = leave status unchanged).
const STATUS_BY_EVENT: Record<RazorpayEventType, SubscriptionStatus | null> = {
  'subscription.authenticated': 'created',
  'subscription.activated': 'active',
  'subscription.charged': 'active',
  'subscription.pending': 'past_due',
  'subscription.halted': 'halted',
  'subscription.cancelled': 'cancelled',
  'subscription.completed': 'expired',
  'subscription.updated': null,
}

export interface NormalizedSubEvent {
  eventId: string            // x-razorpay-event-id (idempotency key)
  type: RazorpayEventType
  createdAt: number          // event time, ms (ordering key)
  subscriptionId: string
  uid: string | null         // from subscription.notes.uid (account mapping)
  planId: string | null
  razorpayStatus: string | null
  currentStart: number | null // ms
  currentEnd: number | null   // ms
  paymentId: string | null
  invoiceId: string | null
  amount: number | null       // minor units (paise), from the payment entity
  currency: string | null
  cancelAtCycleEnd: boolean | null // Razorpay sub `cancel_at_cycle_end` (null if absent)
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const secToMs = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1000) : null)
// Razorpay sends booleans as true/false or 1/0; null when the field is absent.
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : v === 1 ? true : v === 0 ? false : null)

/**
 * Normalize a Razorpay webhook body into our subscription event, or null for
 * payloads we do not handle (non-subscription events, malformed). `eventId` is the
 * `x-razorpay-event-id` header (the route supplies it; falls back to body.id).
 */
export function parseRazorpayEvent(body: unknown, eventId: string): NormalizedSubEvent | null {
  if (!isObj(body)) return null
  const type = str(body.event)
  if (!type || !(type in STATUS_BY_EVENT)) return null

  const payload = isObj(body.payload) ? body.payload : null
  const subWrap = payload && isObj(payload.subscription) ? payload.subscription : null
  const sub = subWrap && isObj(subWrap.entity) ? subWrap.entity : null
  const subId = sub ? str(sub.id) : null
  if (!sub || !subId) return null

  const payWrap = payload && isObj(payload.payment) ? payload.payment : null
  const pay = payWrap && isObj(payWrap.entity) ? payWrap.entity : null
  const invWrap = payload && isObj(payload.invoice) ? payload.invoice : null
  const inv = invWrap && isObj(invWrap.entity) ? invWrap.entity : null
  const notes = isObj(sub.notes) ? sub.notes : null

  return {
    eventId: eventId || str(body.id) || '',
    type: type as RazorpayEventType,
    createdAt: secToMs(body.created_at) ?? 0,
    subscriptionId: subId,
    uid: notes ? str(notes.uid) : null,
    planId: str(sub.plan_id),
    razorpayStatus: str(sub.status),
    currentStart: secToMs(sub.current_start),
    currentEnd: secToMs(sub.current_end),
    paymentId: pay ? str(pay.id) : null,
    invoiceId: inv ? str(inv.id) : null,
    amount: pay && typeof pay.amount === 'number' ? pay.amount : null,
    currency: pay ? str(pay.currency) : null,
    cancelAtCycleEnd: bool(sub.cancel_at_cycle_end),
  }
}

// ── Builders ──────────────────────────────────────────────────────
// PURE: a fresh 'created' subscription record stamped at /subscribe time, before
// any webhook. Status is 'created' (NOT entitled) — Pro is granted only when the
// activation/charge webhook lands. The id == uid (one subscription per account).
export function pendingSubscription(
  uid: string,
  opts: { interval: BillingInterval; razorpaySubscriptionId: string; razorpayPlanId: string; razorpayCustomerId?: string | null; plan?: BillingPlan },
  now: number,
): Subscription {
  return {
    // Tier is decided by the caller (the /subscribe route knows the PlanOption tier)
    // and PRESERVED across transitions — keeps this pure module free of value imports.
    id: uid, accountId: uid, plan: opts.plan ?? 'pro', interval: opts.interval, status: 'created',
    razorpayCustomerId: opts.razorpayCustomerId ?? null,
    razorpaySubscriptionId: opts.razorpaySubscriptionId,
    razorpayPlanId: opts.razorpayPlanId,
    currentStart: null, currentEnd: null, cancelAtCycleEnd: false,
    scheduledChange: null, lastEventId: null, lastEventAt: null, updatedAt: now,
  }
}

// ── State machine ─────────────────────────────────────────────────
function skeleton(uid: string, subscriptionId: string): Subscription {
  return {
    id: uid, accountId: uid, plan: 'pro', interval: null, status: 'created',
    razorpayCustomerId: null, razorpaySubscriptionId: subscriptionId, razorpayPlanId: null,
    currentStart: null, currentEnd: null, cancelAtCycleEnd: false,
    scheduledChange: null, lastEventId: null, lastEventAt: null, updatedAt: 0,
  }
}

/**
 * Apply a normalized event to the current subscription, returning the next state.
 * PURE and deterministic (no clock — derives all timestamps from the event).
 *
 *  - Idempotent: re-applying the same eventId returns the current state unchanged.
 *  - Order-safe: an event OLDER than the last applied one is ignored, so a late
 *    `pending` can never downgrade an already-recovered `active` subscription.
 *  - Returns null only when no account can be resolved (no current doc AND no
 *    notes.uid on the event) — the caller logs/skips.
 */
export function applyTransition(current: Subscription | null, event: NormalizedSubEvent): Subscription | null {
  const uid = current?.accountId ?? event.uid
  if (!uid) return null // cannot map event to an account

  if (current) {
    if (current.lastEventId === event.eventId) return current // idempotent replay
    if (current.lastEventAt != null && event.createdAt < current.lastEventAt) return current // out-of-order
  }

  const next: Subscription = { ...(current ?? skeleton(uid, event.subscriptionId)) }
  // Preserve the tier set at /subscribe time (pro/business); only default to 'pro'
  // when there's no prior record (e.g. an event seen before the pending write).
  next.plan = current?.plan ?? 'pro'
  if (event.subscriptionId) next.razorpaySubscriptionId = event.subscriptionId
  if (event.planId) next.razorpayPlanId = event.planId

  const mapped = STATUS_BY_EVENT[event.type]
  if (mapped) next.status = mapped

  switch (event.type) {
    case 'subscription.activated':
    case 'subscription.charged':
      if (event.currentStart != null) next.currentStart = event.currentStart
      if (event.currentEnd != null) next.currentEnd = event.currentEnd
      // A fresh charge clears any scheduled cancel unless Razorpay still flags it.
      next.cancelAtCycleEnd = event.cancelAtCycleEnd === true
      break
    case 'subscription.updated':
      // Cancel-at-cycle-end keeps status 'active' and arrives as `updated`; sync the
      // scheduled-cancel flag (and any period change) so the dashboard reflects it.
      if (event.currentEnd != null) next.currentEnd = event.currentEnd
      if (event.cancelAtCycleEnd != null) next.cancelAtCycleEnd = event.cancelAtCycleEnd
      break
    case 'subscription.cancelled':
      if (event.currentEnd != null) next.currentEnd = event.currentEnd
      // Cycle-end cancel keeps Pro until currentEnd; immediate cancel ends now.
      next.cancelAtCycleEnd = event.currentEnd != null && event.currentEnd > event.createdAt
      break
    // authenticated / pending / halted / completed: keep currentEnd as-is.
    default:
      break
  }

  next.lastEventId = event.eventId
  next.lastEventAt = event.createdAt
  next.updatedAt = event.createdAt
  return next
}

// ── Reconciliation (snapshot-based healing) ───────────────────────
// When webhooks are missed/delayed/dropped, the reconcile path reads Razorpay's
// CURRENT subscription snapshot (the source of truth) and heals local state to
// match. Unlike applyTransition this is NOT event-ordered — the snapshot is
// authoritative now — but it deliberately leaves lastEventId/lastEventAt untouched
// so the webhook ordering guard still protects against post-reconcile stale events.

// A normalized Razorpay subscription snapshot (from GET /subscriptions/:id).
export interface RazorpaySnapshot {
  subscriptionId: string
  status: string            // Razorpay's own status string
  uid: string | null        // notes.uid
  planId: string | null
  currentStart: number | null // ms
  currentEnd: number | null   // ms
  cancelAtCycleEnd: boolean | null
}

// Razorpay subscription status → our SubscriptionStatus. Unknown → null (skip,
// never guess — fail-closed: do not mutate state from an unrecognized status).
const RZ_STATUS_MAP: Record<string, SubscriptionStatus> = {
  created: 'created',
  authenticated: 'created',
  active: 'active',
  pending: 'past_due',
  halted: 'halted',
  paused: 'past_due',
  cancelled: 'cancelled',
  completed: 'expired',
  expired: 'expired',
}
export function mapRazorpayStatus(status: string): SubscriptionStatus | null {
  return RZ_STATUS_MAP[status] ?? null
}

export interface ReconcileResult {
  changed: boolean
  next: Subscription | null
  from: SubscriptionStatus | 'none'
  to: SubscriptionStatus | 'none'
}

/**
 * PURE: heal a local subscription against a Razorpay snapshot. Returns changed=false
 * (no write) when there is no drift, no account can be resolved, or the snapshot
 * status is unrecognized (fail-closed — never downgrade on an unknown status).
 */
export function reconcileSubscription(local: Subscription | null, snap: RazorpaySnapshot, now: number): ReconcileResult {
  const uid = local?.accountId ?? snap.uid
  if (!uid) return { changed: false, next: null, from: local?.status ?? 'none', to: 'none' }

  const mapped = mapRazorpayStatus(snap.status)
  if (!mapped) return { changed: false, next: local, from: local?.status ?? 'none', to: local?.status ?? 'none' }

  const base = local ?? skeleton(uid, snap.subscriptionId)
  const next: Subscription = { ...base }
  next.plan = 'pro'
  next.status = mapped
  next.razorpaySubscriptionId = snap.subscriptionId
  if (snap.planId) next.razorpayPlanId = snap.planId
  if (snap.currentStart != null) next.currentStart = snap.currentStart
  if (snap.currentEnd != null) next.currentEnd = snap.currentEnd
  // Honor Razorpay's scheduled-cancel flag (covers cancels done directly in the
  // Razorpay dashboard); fall back to the cancelled-with-future-end inference.
  next.cancelAtCycleEnd = snap.cancelAtCycleEnd === true
    || (mapped === 'cancelled' && snap.currentEnd != null && snap.currentEnd > now)
  next.updatedAt = now

  const changed = !local
    || local.status !== next.status
    || local.currentEnd !== next.currentEnd
    || local.currentStart !== next.currentStart
    || local.razorpayPlanId !== next.razorpayPlanId
    || local.cancelAtCycleEnd !== next.cancelAtCycleEnd
  if (!changed) return { changed: false, next: local, from: local.status, to: local.status }

  return { changed: true, next, from: local?.status ?? 'none', to: next.status }
}
