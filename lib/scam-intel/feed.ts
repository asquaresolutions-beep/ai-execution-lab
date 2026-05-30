// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/feed.ts
// Public-facing reads + admin moderation actions.
//   - publicFeed()      approved reports, newest first
//   - trending()        clusters ranked by recency-weighted trend
//   - heatmap()         region × category density grid
//   - moderation queue  list / approve / reject (admin)
// ─────────────────────────────────────────────────────────────────

import { getStore } from '@/lib/store/adapter'
import { audit } from '@/lib/ai/audit'
import { computeTrend } from './dedup'
import type {
  ScamReport, ScamCluster, TrendingItem, HeatmapCell, ReportStatus, Severity,
} from './types'

const REPORTS = 'scam_reports'
const CLUSTERS = 'scam_clusters'

// ── Public feed ────────────────────────────────────────────────────
export async function publicFeed(opts: { limit?: number; category?: string; region?: string } = {}): Promise<ScamReport[]> {
  const where = [{ field: 'status', op: '==' as const, value: 'approved' }]
  if (opts.category) where.push({ field: 'category', op: '==', value: opts.category })
  if (opts.region) where.push({ field: 'region', op: '==', value: opts.region })
  const rows = await getStore().query<ScamReport>(REPORTS, {
    where, orderBy: { field: 'createdAt', dir: 'desc' }, limit: opts.limit ?? 50,
  })
  // Only canonical reports in the feed (duplicates collapse into clusters).
  return rows.map((r) => r.data).filter((r) => r.isCanonical || r.duplicateOf === null)
}

// ── Trending dashboard ─────────────────────────────────────────────
export async function trending(limit = 20, windowDays = 7): Promise<TrendingItem[]> {
  const now = Date.now()
  const cutoff = now - windowDays * 86_400_000
  const clusters = (await getStore().query<ScamCluster>(CLUSTERS, { limit: 1000 })).map((r) => r.data)
  return clusters
    .map((c) => ({
      clusterId: c.id,
      title: c.title,
      category: c.category,
      reportCount: c.reportCount,
      severity: c.severity,
      trendScore: c.lastSeen >= cutoff ? c.trendScore : computeTrend(c.reportCount, c.firstSeen, now) * 0.5,
      velocity: c.lastSeen >= cutoff ? c.reportCount : 0,
      platforms: c.platforms,
      regions: c.regions,
    }))
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, limit)
}

// ── Heatmap (region × category) ────────────────────────────────────
export async function heatmap(windowDays = 30): Promise<HeatmapCell[]> {
  const cutoff = Date.now() - windowDays * 86_400_000
  const reports = (await getStore().query<ScamReport>(REPORTS, {
    where: [{ field: 'status', op: '==', value: 'approved' }], limit: 5000,
  })).map((r) => r.data).filter((r) => r.createdAt >= cutoff)

  const sevWeight: Record<Severity, number> = { low: 1, medium: 2, high: 3, critical: 5 }
  const grid = new Map<string, HeatmapCell>()
  for (const r of reports) {
    const region = r.region && r.region !== 'unknown' ? r.region : 'Unknown'
    const key = `${region}__${r.category}`
    const cell = grid.get(key) ?? { region, category: r.category, count: 0, severityWeighted: 0 }
    cell.count += 1
    cell.severityWeighted += sevWeight[r.severity.severity]
    grid.set(key, cell)
  }
  return [...grid.values()].sort((a, b) => b.severityWeighted - a.severityWeighted)
}

// ── Moderation queue (admin) ───────────────────────────────────────
export async function moderationQueue(status: ReportStatus = 'pending', limit = 100): Promise<ScamReport[]> {
  const rows = await getStore().query<ScamReport>(REPORTS, {
    where: [{ field: 'status', op: '==', value: status }],
    orderBy: { field: 'createdAt', dir: 'desc' }, limit,
  })
  return rows.map((r) => r.data)
}

export async function moderateReport(
  reportId: string,
  decision: 'approved' | 'rejected',
  adminId: string,
  note?: string,
): Promise<void> {
  await getStore().update(REPORTS, reportId, { status: decision, updatedAt: Date.now() })
  await audit({
    action: 'moderation.decision', actor: adminId, subject: reportId, ok: true,
    meta: { decision, note, manual: true },
  })
}

// ── Trending recomputation (cron) ──────────────────────────────────
// Recomputes recency-weighted trendScore for every cluster and stores a
// materialized snapshot in `trending_snapshots` for fast public reads.
export async function recomputeTrending(): Promise<{ clusters: number; snapshotId: string }> {
  const store = getStore()
  const now = Date.now()
  const clusters = (await store.query<ScamCluster>(CLUSTERS, { limit: 5000 })).map((r) => r.data)
  for (const c of clusters) {
    const trendScore = computeTrend(c.reportCount, c.firstSeen, now)
    if (trendScore !== c.trendScore) await store.update(CLUSTERS, c.id, { trendScore })
  }
  const top = await trending(50)
  const snapshotId = `snap_${now}`
  await store.set('trending_snapshots', snapshotId, { id: snapshotId, generatedAt: now, items: top } as unknown as Record<string, unknown>)
  return { clusters: clusters.length, snapshotId }
}

export async function queueSummary(): Promise<Record<ReportStatus, number>> {
  const all = (await getStore().query<ScamReport>(REPORTS, { limit: 5000 })).map((r) => r.data)
  const out = { pending: 0, approved: 0, rejected: 0, duplicate: 0, spam: 0 } as Record<ReportStatus, number>
  for (const r of all) out[r.status] = (out[r.status] ?? 0) + 1
  return out
}
