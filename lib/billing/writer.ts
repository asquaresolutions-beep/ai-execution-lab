// ─────────────────────────────────────────────────────────────────
// lib/billing/writer.ts  (asq-trustseal-billing-b2)
// Store-bound billing writer — the ONLY code that mutates ts_subscriptions /
// ts_billing_events. The DocumentStore is INJECTED (not fetched here), so this
// layer is store-agnostic and unit-tested at runtime against a fake store, while
// the route supplies the real getStore(). Pure decision logic lives in webhook.ts
// (applyTransition); this file is just persistence + idempotency wiring.
//
// Idempotency model (the store has no transactions):
//   • ts_billing_events doc id = Razorpay event id.
//   • persistEventOnce skips only FULLY-PROCESSED events → a true replay is a
//     no-op, but a retry of a half-finished event re-processes.
//   • applyTransition is itself idempotent + order-safe, so re-processing never
//     double-applies or downgrades.
// ─────────────────────────────────────────────────────────────────
import { applyTransition, pendingSubscription } from './webhook.ts'
import type { NormalizedSubEvent } from './webhook.ts'
import { SUBSCRIPTIONS, BILLING_EVENTS } from './model.ts'
import type { Subscription, BillingEvent, SubscriptionStatus, BillingInterval } from './model.ts'
import type { DocumentStore } from '@/lib/store/adapter'

/**
 * Persist the 'created' subscription reference at /subscribe time (before any
 * webhook). Status is 'created' (not entitled); the activation webhook flips it to
 * active. Safe to overwrite a prior non-entitled record (new checkout attempt) —
 * the route guards against overwriting a currently-entitled subscription.
 */
export async function createPendingSubscription(
  store: DocumentStore,
  opts: { uid: string; interval: BillingInterval; razorpaySubscriptionId: string; razorpayPlanId: string; razorpayCustomerId?: string | null },
  now: number = Date.now(),
): Promise<Subscription> {
  const sub = pendingSubscription(opts.uid, opts, now)
  await store.set<Subscription>(SUBSCRIPTIONS, sub.id, sub)
  return sub
}

/**
 * Record the event under its id, returning firstSeen=false ONLY for a replay of an
 * already-processed event (→ caller no-ops). Half-finished events (processed=false)
 * report firstSeen=true so a retry re-processes them.
 */
export async function persistEventOnce(
  store: DocumentStore,
  event: NormalizedSubEvent,
  payloadDigest: string,
): Promise<{ firstSeen: boolean }> {
  const existing = await store.get<BillingEvent>(BILLING_EVENTS, event.eventId)
  if (existing && existing.data.processed) return { firstSeen: false } // true replay → skip

  const record: BillingEvent = {
    id: event.eventId,
    type: event.type,
    subscriptionId: event.subscriptionId,
    accountId: event.uid,
    payloadDigest,
    receivedAt: Date.now(),
    processed: false,
    // Persist invoice/audit metadata now so B5 (GST invoices) needs no re-fetch.
    paymentId: event.paymentId,
    invoiceId: event.invoiceId,
    amount: event.amount,
    currency: event.currency,
    currentStart: event.currentStart,
    currentEnd: event.currentEnd,
  }
  await store.set<BillingEvent>(BILLING_EVENTS, event.eventId, record)
  return { firstSeen: true }
}

export interface ApplyResult {
  applied: boolean
  previousStatus: SubscriptionStatus | 'none'
  nextStatus: SubscriptionStatus | 'none'
}

/**
 * Load the account's subscription, apply the event via the pure state machine, and
 * persist only when state actually changed. No account (no notes.uid, no existing
 * doc) or a no-op (idempotent / out-of-order) returns applied=false.
 */
export async function applyAndUpsert(store: DocumentStore, event: NormalizedSubEvent): Promise<ApplyResult> {
  const uid = event.uid
  const current = uid ? (await store.get<Subscription>(SUBSCRIPTIONS, uid))?.data ?? null : null
  const next = applyTransition(current, event)

  if (!next) return { applied: false, previousStatus: current?.status ?? 'none', nextStatus: 'none' }
  if (current && next === current) return { applied: false, previousStatus: current.status, nextStatus: current.status }

  await store.set<Subscription>(SUBSCRIPTIONS, next.id, next)
  return { applied: true, previousStatus: current?.status ?? 'none', nextStatus: next.status }
}

/**
 * Persist the scheduled-cancel flag immediately after a confirmed Razorpay
 * cancel-at-cycle-end request (Razorpay returned 200, so this is authoritative,
 * not client-trusted). Status stays 'active' until the cycle-end webhook; the
 * webhook + reconcile keep this flag in sync thereafter. No-op if no doc exists.
 */
export async function setCancelScheduled(store: DocumentStore, uid: string, value: boolean): Promise<void> {
  await store.update<Subscription>(SUBSCRIPTIONS, uid, { cancelAtCycleEnd: value, updatedAt: Date.now() })
}

/** Mark a billing event fully processed (idempotency anchor for future replays). */
export async function markProcessed(store: DocumentStore, eventId: string, result: string): Promise<void> {
  await store.update<BillingEvent>(BILLING_EVENTS, eventId, { processed: true, result })
}
