// ─────────────────────────────────────────────────────────────────
// lib/billing/plans.ts  (asq-trustseal-billing-b3)
// Pure plan catalog bridging our internal interval ↔ the Razorpay plan objects.
// Dependency-free (only a type-only import) so it is runtime-tested directly.
// Razorpay plan IDs are environment-scoped (test vs live differ), so we expose the
// ENV VAR NAME here and read the actual id in the route — never hardcode a plan id.
// ─────────────────────────────────────────────────────────────────
import type { BillingInterval } from '@/lib/billing/model'

export interface PlanOption {
  interval: BillingInterval
  amountPaise: number       // display price, minor units (GST-inclusive)
  label: string
  envVar: string            // env var holding the Razorpay plan_id for this interval
  totalCount: number        // number of billing cycles ("until cancelled")
}

export const PLAN_OPTIONS: PlanOption[] = [
  { interval: 'monthly', amountPaise: 49900, label: 'Pro · Monthly', envVar: 'RAZORPAY_PLAN_PRO_MONTHLY', totalCount: 120 },
  { interval: 'yearly', amountPaise: 499000, label: 'Pro · Yearly', envVar: 'RAZORPAY_PLAN_PRO_YEARLY', totalCount: 10 },
]

export function planOption(interval: string): PlanOption | null {
  return PLAN_OPTIONS.find((p) => p.interval === interval) ?? null
}

/** True when the configured Razorpay key is a TEST-mode key. */
export function isTestModeKey(keyId: string | undefined | null): boolean {
  return !!keyId && keyId.startsWith('rzp_test_')
}

/**
 * True when a usable Razorpay key is configured — TEST or LIVE. Billing routes gate
 * on this (not on test-mode) so live mode works; an unconfigured key is refused.
 */
export function isRazorpayConfigured(keyId: string | undefined | null): boolean {
  return !!keyId && (keyId.startsWith('rzp_test_') || keyId.startsWith('rzp_live_'))
}
