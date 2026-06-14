// ─────────────────────────────────────────────────────────────────
// lib/billing/enforce.ts  (asq-trustseal-billing-b4)
// Server-side entitlement enforcement — the ONLY place Pro capabilities are
// gated. Resolves the account's entitlement via the B1 model (server-authoritative,
// fail-closed) and checks the per-capability feature flag. Client state is never
// trusted: callers are API routes / server code that pass a verified uid (or the
// account that owns a domain).
//
// Each capability maps to a PlanFeatures flag, which deriveEntitlement sets true
// ONLY for an active Pro subscription — so a single check covers active/grace/
// cancelled-in-term vs free/expired/missing.
// ─────────────────────────────────────────────────────────────────
import { getEntitlement } from '@/lib/billing/entitlement'
import type { PlanFeatures } from '@/lib/billing/model'

/** True iff the account currently has the given Pro capability. Fail-closed. */
export async function hasFeature(uid: string, feature: keyof PlanFeatures): Promise<boolean> {
  if (!uid) return false
  try {
    const ent = await getEntitlement(uid)
    return ent.features[feature] === true
  } catch {
    return false
  }
}

// Capability-specific guards (named so call sites read intentionally).
export const isBadgeEntitled = (accountId: string) => hasFeature(accountId, 'badgeWidget')
export const isCommandCenterEntitled = (uid: string) => hasFeature(uid, 'commandCenter')
export const isAnalyticsEntitled = (uid: string) => hasFeature(uid, 'analytics')
