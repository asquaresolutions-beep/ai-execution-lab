// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/autopilot.ts
// Autonomous scam-alert generation pipeline.
//
// Flow (per run, budget-capped):
//   1. read clusters  → 2. rank by freshness/trending
//   3. skip clusters that ALREADY produced a bundle (dup prevention)
//   4. for the top N within the daily budget:
//        build ScamInput from the canonical report
//        → generateBundle (article + Hindi + GEO + FAQ + schema + social)
//        → enqueue publishing  → enqueue Shorts script
//        → stamp cluster.bundleId so it is never regenerated
//
// Designed to be cheap: small N per run, dedup avoids rework, all
// generation is cache-backed, and India is the default region.
// ─────────────────────────────────────────────────────────────────

import { getStore } from '@/lib/store/adapter'
import { log } from '@/lib/observability/logger'
import { audit } from '@/lib/ai/audit'
import { generateBundle } from '@/lib/distribution/engine'
import { enqueue } from '@/lib/distribution/queue'
import { allowBundle, THROTTLE } from '@/lib/distribution/throttle'
import { scoreBundleQuality } from '@/lib/distribution/quality'
import { assertWithinBudget } from '@/lib/ai/budget'
import { formatAlertForCategory } from '@/lib/distribution/alert-formats'
import type { Channel } from '@/lib/distribution/integrations'
import type { ScamInput, Severity } from '@/lib/distribution/types'
import { rankByFreshness } from './freshness'
import type { ScamCluster, ScamReport } from './types'

const CLUSTERS = 'scam_clusters'
const REPORTS = 'scam_reports'

// Channels to publish to + Shorts queued separately.
const PUBLISH_CHANNELS: Channel[] = ['internal-store', 'markdown-export', 'wordpress']
const SHORTS_CHANNEL: Channel = 'youtube-shorts'

const DEFAULT_REGION = process.env.AUTOPILOT_REGION || 'India'
const MIN_FRESHNESS = Number(process.env.AUTOPILOT_MIN_FRESHNESS) || 25

export interface AutopilotResult {
  considered: number
  eligible: number
  generated: Array<{ clusterId: string; bundleId: string; title: string; freshness: number; quality: number }>
  skippedExisting: number
  skippedLowQuality: number
  budgetReached: boolean
  message: string
}

type ClusterWithBundle = ScamCluster & { bundleId?: string }

export async function runAutopilot(maxItems = THROTTLE.autopilotPerRun): Promise<AutopilotResult> {
  const store = getStore()
  const now = Date.now()

  const clusters = (await store.query<ClusterWithBundle>(CLUSTERS, { limit: 1000 })).map((r) => r.data)
  const ranked = rankByFreshness(clusters, now)

  const generated: AutopilotResult['generated'] = []
  let skippedExisting = 0
  let skippedLowQuality = 0
  let budgetReached = false
  let eligible = 0

  for (const cluster of ranked) {
    if (generated.length >= maxItems) break
    if (cluster.freshness.score < MIN_FRESHNESS) break // ranked desc → rest are staler

    // Dup prevention: one bundle per scam pattern.
    if (cluster.bundleId) { skippedExisting++; continue }
    eligible++

    // Respect the daily bundle budget (cost guard).
    if (!(await allowBundle())) { budgetReached = true; break }

    // Vertex daily-spend circuit breaker — stop the run, don't crash.
    try { await assertWithinBudget() }
    catch { budgetReached = true; break }

    const report = await loadCanonicalReport(cluster)
    if (!report) continue

    const input: ScamInput = {
      title: cluster.title?.replace(/^Likely\s+/i, '').replace(/\.$/, '') || 'Scam alert',
      description: report.text,
      platform: report.platform || cluster.platforms[0] || 'unknown',
      region: chooseRegion(cluster, report),
      severity: cluster.severity as Severity,
    }

    try {
      const bundle = await generateBundle(input, { locales: ['en', 'hi'] })

      // Quality gate — never publish thin/mock pages. Leave unstamped so a
      // later run (with live AI) can retry this cluster.
      const quality = scoreBundleQuality(bundle)
      if (!quality.pass) {
        skippedLowQuality++
        log.warn({ event: 'autopilot.low_quality', clusterId: cluster.id, score: quality.score, issues: quality.issues })
        continue
      }

      await enqueue(bundle.id, { channels: PUBLISH_CHANNELS })
      await enqueue(bundle.id, { channels: [SHORTS_CHANNEL] }) // Shorts script job
      // Auto-distribution: store deterministic per-channel snippets (X thread,
      // carousel, WhatsApp, Telegram, Shorts hook) for the social pipeline.
      const formats = formatAlertForCategory(cluster.category, chooseRegion(cluster, report))
      if (formats) {
        await store.set('distribution_alerts', bundle.id, {
          id: bundle.id, clusterId: cluster.id, category: cluster.category,
          formats: formats as unknown as Record<string, unknown>, createdAt: now,
        })
      }
      await store.update(CLUSTERS, cluster.id, { bundleId: bundle.id })
      generated.push({ clusterId: cluster.id, bundleId: bundle.id, title: input.title, freshness: cluster.freshness.score, quality: quality.score })
      log.info({ event: 'autopilot.generated', clusterId: cluster.id, bundleId: bundle.id, freshness: cluster.freshness.score, quality: quality.score })
    } catch (err) {
      log.error({ event: 'autopilot.generate_failed', clusterId: cluster.id, error: (err as Error).message })
    }
  }

  await audit({
    action: 'distribution.bundle', actor: 'autopilot', ok: true,
    message: `autopilot run: ${generated.length} generated`,
    meta: { generated: generated.length, skippedExisting, skippedLowQuality, budgetReached },
  })

  return {
    considered: ranked.length,
    eligible,
    generated,
    skippedExisting,
    skippedLowQuality,
    budgetReached,
    message: `Generated ${generated.length} alert bundle(s); skipped ${skippedExisting} existing, ${skippedLowQuality} low-quality; ${budgetReached ? 'budget/quota reached' : 'within budget'}.`,
  }
}

async function loadCanonicalReport(cluster: ScamCluster): Promise<ScamReport | null> {
  if (cluster.canonicalReportId) {
    const doc = await getStore().get<ScamReport>(REPORTS, cluster.canonicalReportId)
    if (doc) return doc.data
  }
  // Fallback: most recent approved report in this cluster.
  const rows = await getStore().query<ScamReport>(REPORTS, {
    where: [{ field: 'clusterId', op: '==', value: cluster.id }],
    orderBy: { field: 'createdAt', dir: 'desc' }, limit: 1,
  })
  return rows[0]?.data ?? null
}

function chooseRegion(cluster: ScamCluster, report: ScamReport): string {
  const r = report.region && report.region !== 'unknown' ? report.region : cluster.regions[0]
  return r && r !== 'unknown' ? r : DEFAULT_REGION
}
