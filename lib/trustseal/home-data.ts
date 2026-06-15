// ─────────────────────────────────────────────────────────────────
// lib/trustseal/home-data.ts  (asq-trustseal-harden)
// REAL homepage data — replaces the fabricated metrics/feed. Equality-only store
// queries (auto single-field index, no composite index needed; mirrors sitemap),
// sorted in memory. Fail-safe: any store error → empty/zero so the build never
// breaks and the homepage simply hides the affected section.
// ─────────────────────────────────────────────────────────────────
import { getStore } from '@/lib/store/adapter'

const CLAIMS = 'ts_claims'
const AUDIT = 'audit_log'

export interface HomeMetrics {
  domainsVerified: number
  verificationsRun: number
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
    return { domainsVerified: verified.length, verificationsRun: runs }
  } catch {
    return { domainsVerified: 0, verificationsRun: 0 }
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
