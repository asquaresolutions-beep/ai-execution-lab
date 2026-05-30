// ─────────────────────────────────────────────────────────────────
// lib/analytics.ts
// Aggregations for the admin analytics dashboard + /api/health:
//   - queueHealth()        backlog, oldest-age, failure rate, DLQ size
//   - publishingMetrics()  per-channel publish success/volume
//   - aiUsage()            generations, cache-hit rate, errors (from audit)
//   - ingestionMetrics()   reports by status/category, dedup rate
//   - analyticsSnapshot()  everything, for one dashboard render
// All derived from the store — no extra writes.
// ─────────────────────────────────────────────────────────────────

import { getStore } from '@/lib/store/adapter'
import { listJobs, type QueueJob } from '@/lib/distribution/queue'
import { dlqSize } from '@/lib/distribution/dlq'
import { recentAudit } from '@/lib/ai/audit'
import { recentErrors } from '@/lib/observability/errors'
import { costToday, quotaStatus, type QuotaStatus } from '@/lib/ai/usage'
import type { ScamReport } from '@/lib/scam-intel/types'

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

export interface QueueHealth {
  status: HealthStatus
  queued: number
  processing: number
  published: number
  failed: number
  dlq: number
  oldestQueuedAgeMs: number
  failureRate: number      // failed / (published + failed)
  issues: string[]
}

export interface PublishingMetrics {
  totalJobs: number
  byChannel: Record<string, { published: number; failed: number; queued: number; successRate: number }>
  overallSuccessRate: number
}

export interface AiUsage {
  generations: number
  cacheHits: number
  cacheHitRate: number
  errors: number
}

export interface IngestionMetrics {
  total: number
  byStatus: Record<string, number>
  byCategory: Record<string, number>
  dedupRate: number        // duplicates / total
}

export interface AnalyticsSnapshot {
  generatedAt: number
  queue: QueueHealth
  publishing: PublishingMetrics
  ai: AiUsage
  cost: { todayUsd: number; byTier: Record<string, number> }
  quota: QuotaStatus[]
  ingestion: IngestionMetrics
  recentErrors: number
}

// ── Queue health ───────────────────────────────────────────────────
const STALE_QUEUE_MS = 30 * 60_000 // 30 min backlog = degraded

export async function queueHealth(): Promise<QueueHealth> {
  const all = await listJobs(undefined, 1000)
  const now = Date.now()
  const count = (s: QueueJob['status']) => all.filter((j) => j.status === s).length
  const queued = count('queued')
  const processing = count('processing')
  const published = count('published')
  const failed = count('failed')
  const dlq = await dlqSize()

  const oldestQueued = all.filter((j) => j.status === 'queued').reduce((min, j) => Math.min(min, j.runAt), now)
  const oldestQueuedAgeMs = queued > 0 ? now - oldestQueued : 0
  const failureRate = published + failed > 0 ? failed / (published + failed) : 0

  const issues: string[] = []
  if (oldestQueuedAgeMs > STALE_QUEUE_MS) issues.push(`oldest queued job is ${Math.round(oldestQueuedAgeMs / 60000)}m old`)
  if (failureRate > 0.25) issues.push(`failure rate ${(failureRate * 100).toFixed(0)}%`)
  if (dlq > 0) issues.push(`${dlq} job(s) in dead-letter queue`)
  if (processing > 50) issues.push(`${processing} jobs stuck processing`)

  const status: HealthStatus =
    issues.length === 0 ? 'healthy'
    : (dlq > 10 || failureRate > 0.5) ? 'unhealthy'
    : 'degraded'

  return { status, queued, processing, published, failed, dlq, oldestQueuedAgeMs, failureRate, issues }
}

// ── Publishing metrics ─────────────────────────────────────────────
export async function publishingMetrics(): Promise<PublishingMetrics> {
  const all = await listJobs(undefined, 2000)
  const byChannel: PublishingMetrics['byChannel'] = {}
  let pub = 0, fail = 0
  for (const j of all) {
    const c = (byChannel[j.channel] ??= { published: 0, failed: 0, queued: 0, successRate: 0 })
    if (j.status === 'published') { c.published++; pub++ }
    else if (j.status === 'failed') { c.failed++; fail++ }
    else if (j.status === 'queued') c.queued++
  }
  for (const c of Object.values(byChannel)) {
    const done = c.published + c.failed
    c.successRate = done > 0 ? +(c.published / done).toFixed(3) : 0
  }
  return {
    totalJobs: all.length,
    byChannel,
    overallSuccessRate: pub + fail > 0 ? +(pub / (pub + fail)).toFixed(3) : 0,
  }
}

// ── AI usage (from audit log) ──────────────────────────────────────
export async function aiUsage(): Promise<AiUsage> {
  const entries = await recentAudit(1000)
  const generations = entries.filter((e) => e.action === 'ai.generate').length
  const cacheHits = entries.filter((e) => e.action === 'ai.cache_hit').length
  const errors = entries.filter((e) => e.action === 'ai.error').length
  const lookups = generations + cacheHits
  return { generations, cacheHits, cacheHitRate: lookups > 0 ? +(cacheHits / lookups).toFixed(3) : 0, errors }
}

// ── Ingestion metrics ──────────────────────────────────────────────
export async function ingestionMetrics(): Promise<IngestionMetrics> {
  const reports = (await getStore().query<ScamReport>('scam_reports', { limit: 5000 })).map((r) => r.data)
  const byStatus: Record<string, number> = {}
  const byCategory: Record<string, number> = {}
  let duplicates = 0
  for (const r of reports) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1
    if (r.status === 'duplicate' || r.duplicateOf) duplicates++
  }
  return { total: reports.length, byStatus, byCategory, dedupRate: reports.length > 0 ? +(duplicates / reports.length).toFixed(3) : 0 }
}

export async function analyticsSnapshot(): Promise<AnalyticsSnapshot> {
  const [queue, publishing, ai, ingestion, errs, cost, qFlash, qPro] = await Promise.all([
    queueHealth(), publishingMetrics(), aiUsage(), ingestionMetrics(), recentErrors(100),
    costToday(), quotaStatus('flash'), quotaStatus('pro'),
  ])
  return {
    generatedAt: Date.now(),
    queue, publishing, ai, ingestion,
    cost: { todayUsd: cost.totalUsd, byTier: cost.byTier },
    quota: [qFlash, qPro],
    recentErrors: errs.length,
  }
}
