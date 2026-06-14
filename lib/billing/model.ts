// ─────────────────────────────────────────────────────────────────
// lib/billing/model.ts  (asq-trustseal-billing-b1)
// TrustSeal billing FOUNDATION — pure data model + entitlement decision logic.
//
// This module is intentionally DEPENDENCY-FREE (no '@/...' imports, no store, no
// network) so the entitlement logic can be unit-tested at runtime via Node's
// native type-stripping (no drift between tested and shipped logic). The
// store-bound service (getEntitlement / getSubscription) lives in ./entitlement.ts.
//
// Phase B1 scope: collections, types, the Free/Pro plan catalog, and the PURE
// deriveEntitlement() resolver. NO Razorpay, NO webhooks, NO UI — those land in
// later phases and are the ONLY things that write subscription state.
// ─────────────────────────────────────────────────────────────────

// ── Collections (created on first write in a later phase) ──────────
export const SUBSCRIPTIONS = 'ts_subscriptions'
export const BILLING_EVENTS = 'ts_billing_events'
export const INVOICES = 'ts_invoices'

// ── Enumerated string unions (no TS `enum` — keeps type-stripping simple) ──
export type BillingPlan = 'free' | 'pro'
export type BillingInterval = 'monthly' | 'yearly'
// Mirrors the Razorpay subscription lifecycle we care about, plus 'none'.
export type SubscriptionStatus =
  | 'none' | 'created' | 'active' | 'past_due' | 'halted' | 'cancelled' | 'expired'

// ── Stored documents ──────────────────────────────────────────────
// One subscription per account (owner-scoped v1); doc id = Firebase uid.
export interface Subscription {
  id: string
  accountId: string
  plan: BillingPlan
  interval: BillingInterval | null
  status: SubscriptionStatus
  razorpayCustomerId: string | null
  razorpaySubscriptionId: string | null
  razorpayPlanId: string | null
  currentStart: number | null            // epoch ms
  currentEnd: number | null              // entitlement valid through (pre-grace)
  cancelAtCycleEnd: boolean
  scheduledChange: { plan: BillingPlan; interval: BillingInterval; effectiveAt: number } | null
  lastEventId: string | null
  lastEventAt: number | null
  updatedAt: number
}

// Append-only webhook log; doc id = Razorpay event id (the idempotency key).
export interface BillingEvent {
  id: string
  type: string
  subscriptionId: string | null
  accountId: string | null
  payloadDigest: string
  receivedAt: number
  processed: boolean
  result?: string
}

// GST tax-invoice record; doc id = sequential invoice number (e.g. TS-2026-0001).
export interface Invoice {
  id: string
  accountId: string
  razorpayInvoiceId: string | null
  razorpayPaymentId: string | null
  amount: number                         // minor units (paise)
  currency: 'INR'
  taxBreakup: { base: number; cgst: number; sgst: number; igst: number; rate: number }
  placeOfSupply: string
  customerGstin: string | null
  sellerGstin: string
  hsnSac: string
  periodStart: number
  periodEnd: number
  issuedAt: number
  pdfUrl: string | null
}

// ── Plan catalog (the gates Free vs Pro unlock) ───────────────────
export interface PlanFeatures {
  badgeWidget: boolean        // embeddable signed badge widget
  signedBadge: boolean        // HMAC-signed badge payload
  analytics: boolean          // badge / verification analytics
  commandCenter: boolean      // /command intelligence surface
  customStyling: boolean      // custom seal styling
  continuousReverify: boolean // priority / continuous re-verification
}
export interface PlanDef {
  plan: BillingPlan
  maxDomains: number
  features: PlanFeatures
}

export const PLANS: Record<BillingPlan, PlanDef> = {
  free: {
    plan: 'free',
    maxDomains: 1,
    features: { badgeWidget: false, signedBadge: false, analytics: false, commandCenter: false, customStyling: false, continuousReverify: false },
  },
  pro: {
    plan: 'pro',
    maxDomains: 10,
    features: { badgeWidget: true, signedBadge: true, analytics: true, commandCenter: true, customStyling: true, continuousReverify: true },
  },
}

// Dunning grace beyond currentEnd for active/past_due — keeps Pro live while
// Razorpay smart-retries run, so a single failed charge doesn't instantly revoke.
export const GRACE_MS = 3 * 24 * 60 * 60 * 1000 // 3 days

// ── Entitlement (what every protected action reads) ───────────────
export interface Entitlement {
  plan: BillingPlan
  status: SubscriptionStatus
  active: boolean                        // are Pro features unlocked right now?
  features: PlanFeatures
  limits: { maxDomains: number }
  currentEnd: number | null
  inGrace: boolean                       // granted via the post-currentEnd grace window
}

export function freeEntitlement(status: SubscriptionStatus = 'none'): Entitlement {
  const p = PLANS.free
  return { plan: 'free', status, active: false, features: { ...p.features }, limits: { maxDomains: p.maxDomains }, currentEnd: null, inGrace: false }
}

function proEntitlement(status: SubscriptionStatus, currentEnd: number, inGrace: boolean): Entitlement {
  const p = PLANS.pro
  return { plan: 'pro', status, active: true, features: { ...p.features }, limits: { maxDomains: p.maxDomains }, currentEnd, inGrace }
}

/**
 * PURE entitlement resolver — the single source of truth for Free vs Pro.
 * Fail-closed: anything missing, malformed, or unrecognized resolves to Free.
 *
 *  - active / past_due : Pro through currentEnd, then through currentEnd+GRACE.
 *  - cancelled / halted: Pro only for the remainder of the paid period (no extra
 *                        grace) — access ends exactly at currentEnd.
 *  - created / expired / none / non-pro: Free.
 */
export function deriveEntitlement(sub: Subscription | null | undefined, now: number): Entitlement {
  if (!sub || sub.plan !== 'pro') return freeEntitlement(sub?.status ?? 'none')

  const end = sub.currentEnd
  if (typeof end !== 'number') return freeEntitlement(sub.status) // fail-closed: no period boundary

  const s = sub.status
  if (s === 'active' || s === 'past_due') {
    if (now <= end) return proEntitlement(s, end, false)
    if (now <= end + GRACE_MS) return proEntitlement(s, end, true)
    return freeEntitlement(s)
  }
  if (s === 'cancelled' || s === 'halted') {
    if (now < end) return proEntitlement(s, end, false) // ride out the paid period only
    return freeEntitlement(s)
  }
  return freeEntitlement(s) // created / expired / none
}
