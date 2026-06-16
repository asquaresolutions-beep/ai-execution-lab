// ─────────────────────────────────────────────────────────────────
// lib/trustseal/quota.ts  (asq-trustseal-phase4)
// Public Trust API quota tiers by plan. PURE (no imports) → unit-testable.
// `free` and `pro` are live today; `business` and `enterprise` are forward-defined
// for the upcoming paid tiers (see Phase-4 strategy). rpm = requests/minute (rate
// limit); monthly = soft monthly request allowance surfaced via usage reporting.
// ─────────────────────────────────────────────────────────────────
export type QuotaPlan = 'free' | 'pro' | 'business' | 'enterprise'

export interface Quota {
  rpm: number      // requests per minute (hard rate limit)
  monthly: number  // monthly request allowance (reported; soft)
}

export const QUOTAS: Record<QuotaPlan, Quota> = {
  free: { rpm: 60, monthly: 1_000 },
  pro: { rpm: 600, monthly: 50_000 },
  business: { rpm: 3_000, monthly: 500_000 },
  enterprise: { rpm: 12_000, monthly: 5_000_000 },
}

export function quotaFor(plan: string | null | undefined): Quota {
  return QUOTAS[(plan as QuotaPlan)] ?? QUOTAS.free
}

/** Current usage period key (UTC month), e.g. "2026-06". */
export function usagePeriod(now = Date.now()): string {
  const d = new Date(now)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
