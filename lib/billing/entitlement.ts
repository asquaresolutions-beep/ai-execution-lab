// ─────────────────────────────────────────────────────────────────
// lib/billing/entitlement.ts  (asq-trustseal-billing-b1)
// Store-bound billing service — the server-authoritative entitlement gateway.
//
// getEntitlement(uid) is what every protected action calls (badge serve, claim
// limits, Pro features). It reads the account's subscription from the store and
// resolves Free vs Pro via the PURE deriveEntitlement() in ./model.ts.
//
// FAIL-CLOSED by design: a missing subscription, a store error, or any thrown
// exception resolves to the Free entitlement — Pro is never granted by accident.
// Free is the implicit default for every account, so NO backfill/migration of
// existing ts_accounts is required (absence of a ts_subscriptions doc == Free).
//
// Phase B1: read-only. The ONLY writers of ts_subscriptions are the Razorpay
// webhook + reconciliation paths, which land in a later phase.
// ─────────────────────────────────────────────────────────────────
import { getStore } from '@/lib/store/adapter'
import {
  SUBSCRIPTIONS,
  deriveEntitlement,
  freeEntitlement,
  type Subscription,
  type Entitlement,
} from '@/lib/billing/model'

/** Read the account's subscription row (doc id = Firebase uid), or null. */
export async function getSubscription(uid: string): Promise<Subscription | null> {
  if (!uid) return null
  try {
    const doc = await getStore().get<Subscription>(SUBSCRIPTIONS, uid)
    return doc ? doc.data : null
  } catch {
    return null
  }
}

/**
 * Resolve the current entitlement for an account. Server-authoritative and
 * fail-closed: any error or missing record yields the Free entitlement.
 */
export async function getEntitlement(uid: string): Promise<Entitlement> {
  try {
    const sub = await getSubscription(uid)
    return deriveEntitlement(sub, Date.now())
  } catch {
    return freeEntitlement()
  }
}

/** Convenience guard for Pro-gated server actions. */
export async function requirePro(uid: string): Promise<boolean> {
  return (await getEntitlement(uid)).active
}
