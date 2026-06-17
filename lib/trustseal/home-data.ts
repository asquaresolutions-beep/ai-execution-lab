// ─────────────────────────────────────────────────────────────────
// lib/trustseal/home-data.ts  (asq-trustseal-harden)
// REAL homepage data — replaces the fabricated metrics/feed. Equality-only store
// queries (auto single-field index, no composite index needed; mirrors sitemap),
// sorted in memory. Fail-safe: any store error → empty/zero so the build never
// breaks and the homepage simply hides the affected section.
// ─────────────────────────────────────────────────────────────────
import { getStore } from '@/lib/store/adapter'
import { usagePeriod } from '@/lib/trustseal/quota'

const CLAIMS = 'ts_claims'
const AUDIT = 'audit_log'
const HISTORY = 'ts_verification_history'
const USAGE = 'ts_api_usage'

export interface HomeMetrics {
  domainsVerified: number
  verificationsRun: number
  // Social-proof extras (Conversion pass). Each is fail-safe → 0; the homepage
  // hides any stat that is 0 so a sparse platform never shows a bare "0".
  certificatesIssued: number   // 1 per verified domain (cert is downloadable on demand)
  apiRequestsServed: number    // public Trust API requests this month
  monitoringChecks: number     // verification-history snapshots (reverifications performed)
}
export interface FeedItem {
  domain: string
  verifiedAt: number
}

interface VerifiedClaim { domain: string; status: string; verifiedAt?: number; createdAt: number }

/** Real, current platform metrics. Zeroes on any failure (caller hides the section). */
export async function getHomeMetrics(): Promise<HomeMetrics> {
  try {
    const verified = await getStore().query<VerifiedClaim>(CLAIMS, {
      where: [{ field: 'status', op: '==', value: 'verified' }],
      limit: 5000,
    })
    let runs = verified.length
    try {
      const checks = await getStore().query(AUDIT, { where: [{ field: 'action', op: '==', value: 'claim.verified' }], limit: 5000 })
      runs = Math.max(runs, checks.length)
    } catch { /* audit index optional */ }

    // Social-proof extras — each independently fail-safe.
    let monitoringChecks = 0
    try { monitoringChecks = (await getStore().query(HISTORY, { limit: 5000 })).length } catch { /* */ }
    let apiRequestsServed = 0
    try {
      const period = usagePeriod()
      apiRequestsServed = (await getStore().query<{ count?: number }>(USAGE, { limit: 5000 }))
        .filter((u) => u.id.endsWith(`__${period}`))
        .reduce((n, u) => n + (u.data.count ?? 0), 0)
    } catch { /* */ }

    return {
      domainsVerified: verified.length,
      verificationsRun: Math.max(runs, monitoringChecks),
      certificatesIssued: verified.length,
      apiRequestsServed,
      monitoringChecks,
    }
  } catch {
    return { domainsVerified: 0, verificationsRun: 0, certificatesIssued: 0, apiRequestsServed: 0, monitoringChecks: 0 }
  }
}

/**
 * The genuine recent-verification feed: most-recently verified domains (which are
 * already public via their seal pages). Equality-only query + in-memory sort, so no
 * composite index. Empty on failure (caller hides the section).
 */
export async function getRecentVerifications(limit = 5): Promise<FeedItem[]> {
  try {
    const rows = await getStore().query<VerifiedClaim>(CLAIMS, {
      where: [{ field: 'status', op: '==', value: 'verified' }],
      limit: 5000,
    })
    return rows
      .map((r) => ({ domain: r.data.domain, verifiedAt: r.data.verifiedAt ?? r.data.createdAt ?? 0 }))
      .filter((x) => x.domain)
      .sort((a, b) => b.verifiedAt - a.verifiedAt)
      .slice(0, limit)
  } catch {
    return []
  }
}
