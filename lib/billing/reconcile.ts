// ─────────────────────────────────────────────────────────────────
// lib/billing/reconcile.ts  (asq-trustseal-billing-b2-3)
// Billing reconciliation SERVICE — recovers subscription state when webhooks are
// missed, delayed, duplicated, or arrive out of order. Razorpay is the source of
// truth: we read its current snapshot and heal local state via the PURE
// reconcileSubscription() in webhook.ts (same model used by the webhook path).
//
// Both the store AND the snapshot fetcher are INJECTED (ports), so the whole
// service is unit-tested at runtime against a fake store + fake fetcher with zero
// network. The cron route supplies the real getStore() + fetchSubscriptionSnapshot.
//
// Guarantees:
//   • Idempotent — no drift ⇒ no write.
//   • Fail-closed — a fetch error / missing snapshot SKIPS that account; it never
//     downgrades or clears local state on a transient failure.
//   • Server-authoritative — Razorpay snapshot wins; the client is never consulted.
// ─────────────────────────────────────────────────────────────────
import { reconcileSubscription } from './webhook.ts'
import type { RazorpaySnapshot } from './webhook.ts'
import { SUBSCRIPTIONS } from './model.ts'
import type { Subscription, SubscriptionStatus } from './model.ts'
import type { DocumentStore } from '@/lib/store/adapter'

// Port: fetch the current Razorpay snapshot for a subscription id (null if absent).
export type SubscriptionFetcher = (subscriptionId: string) => Promise<RazorpaySnapshot | null>

export interface ReconcileOutcome {
  uid: string
  changed: boolean
  healed: boolean
  from: SubscriptionStatus | 'none'
  to: SubscriptionStatus | 'none'
  skipped?: 'no_subscription' | 'fetch_error' | 'no_snapshot'
}

/** Reconcile one account's subscription against Razorpay. Fail-closed + idempotent. */
export async function reconcileAccount(
  store: DocumentStore,
  fetcher: SubscriptionFetcher,
  uid: string,
  now: number = Date.now(),
): Promise<ReconcileOutcome> {
  const local = (await store.get<Subscription>(SUBSCRIPTIONS, uid))?.data ?? null
  const from = local?.status ?? 'none'
  if (!local || !local.razorpaySubscriptionId) {
    return { uid, changed: false, healed: false, from, to: from, skipped: 'no_subscription' }
  }

  let snap: RazorpaySnapshot | null
  try {
    snap = await fetcher(local.razorpaySubscriptionId)
  } catch {
    return { uid, changed: false, healed: false, from, to: from, skipped: 'fetch_error' } // fail-closed: keep local
  }
  if (!snap) return { uid, changed: false, healed: false, from, to: from, skipped: 'no_snapshot' }

  const r = reconcileSubscription(local, snap, now)
  if (!r.changed || !r.next) return { uid, changed: false, healed: false, from: r.from, to: r.to }

  await store.set<Subscription>(SUBSCRIPTIONS, r.next.id, r.next)
  return { uid, changed: true, healed: true, from: r.from, to: r.to }
}

export interface ReconcileSweep {
  scanned: number
  healed: number
  outcomes: ReconcileOutcome[]
}

// Subscriptions in these states can drift and are worth re-checking. 'expired' is
// terminal (no further changes) so it is intentionally excluded from the sweep.
const SWEEP_STATUSES: SubscriptionStatus[] = ['created', 'active', 'past_due', 'halted', 'cancelled']

/**
 * Sweep reconcilable subscriptions and heal drift. Iterates per status (using the
 * ts_subscriptions (status, currentEnd) index) so each query is index-served, then
 * dedupes ids across statuses.
 */
export async function reconcileDue(
  store: DocumentStore,
  fetcher: SubscriptionFetcher,
  opts: { now?: number; limit?: number } = {},
): Promise<ReconcileSweep> {
  const now = opts.now ?? Date.now()
  const limit = opts.limit ?? 100
  const seen = new Set<string>()
  const outcomes: ReconcileOutcome[] = []

  for (const status of SWEEP_STATUSES) {
    const rows = await store.query<Subscription>(SUBSCRIPTIONS, {
      where: [{ field: 'status', op: '==', value: status }],
      orderBy: { field: 'currentEnd', dir: 'asc' },
      limit,
    })
    for (const row of rows) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      outcomes.push(await reconcileAccount(store, fetcher, row.id, now))
    }
  }

  return { scanned: seen.size, healed: outcomes.filter((o) => o.healed).length, outcomes }
}
