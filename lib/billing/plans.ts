// ─────────────────────────────────────────────────────────────────
// lib/billing/plans.ts  (asq-trustseal-billing-b3)
// Pure plan catalog bridging our internal interval ↔ the Razorpay plan objects.
// Dependency-free (only a type-only import) so it is runtime-tested directly.
// Razorpay plan IDs are environment-scoped (test vs live differ), so we expose the
// ENV VAR NAME here and read the actual id in the route — never hardcode a plan id.
// ─────────────────────────────────────────────────────────────────
import type { BillingInterval, BillingPlan } from '@/lib/billing/model'

export interface PlanOption {
  tier: Exclude<BillingPlan, 'free'> // 'pro' | 'business'
  interval: BillingInterval
  amountPaise: number       // display price, minor units (GST-inclusive)
  label: string
  envVar: string            // env var holding the Razorpay plan_id for this option
  totalCount: number        // number of billing cycles ("until cancelled")
}

export const PLAN_OPTIONS: PlanOption[] = [
  { tier: 'pro', interval: 'monthly', amountPaise: 49900, label: 'Pro · Monthly', envVar: 'RAZORPAY_PLAN_PRO_MONTHLY', totalCount: 120 },
  { tier: 'pro', interval: 'yearly', amountPaise: 499000, label: 'Pro · Yearly', envVar: 'RAZORPAY_PLAN_PRO_YEARLY', totalCount: 10 },
  { tier: 'business', interval: 'monthly', amountPaise: 199900, label: 'Business · Monthly', envVar: 'RAZORPAY_PLAN_BUSINESS_MONTHLY', totalCount: 120 },
  { tier: 'business', interval: 'yearly', amountPaise: 1999000, label: 'Business · Yearly', envVar: 'RAZORPAY_PLAN_BUSINESS_YEARLY', totalCount: 10 },
]

/** Resolve a plan option by tier + interval. Defaults to the Pro tier (back-compat). */
export function planOption(interval: string, tier: 'pro' | 'business' = 'pro'): PlanOption | null {
  return PLAN_OPTIONS.find((p) => p.tier === tier && p.interval === interval) ?? null
}

/**
 * Map a Razorpay plan id back to our internal tier, by matching it against the
 * configured Business plan-id env vars. Anything else (incl. the Pro plan ids) →
 * 'pro'. This is how the webhook learns whether a subscription is Business.
 * `env` is injectable for testing; defaults to process.env.
 */
export function planTierForRazorpayPlanId(
  planId: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): Exclude<BillingPlan, 'free'> {
  if (!planId) return 'pro'
  const businessIds = [env.RAZORPAY_PLAN_BUSINESS_MONTHLY, env.RAZORPAY_PLAN_BUSINESS_YEARLY].filter(Boolean)
  return businessIds.includes(planId) ? 'business' : 'pro'
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
