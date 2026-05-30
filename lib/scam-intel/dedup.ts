// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/dedup.ts
// Semantic deduplication + clustering. A new report's embedding is
// compared to existing cluster centroids; above DUP_THRESHOLD it's a
// duplicate, above CLUSTER_THRESHOLD it joins the cluster, otherwise it
// seeds a new cluster. Centroids update incrementally (running mean).
// ─────────────────────────────────────────────────────────────────

import { getStore, genId } from '@/lib/store/adapter'
import { cosineSimilarity } from '@/lib/ai/embeddings'
import type { Classification, ScamCluster, Severity } from './types'

const CLUSTERS = 'scam_clusters'

// Tunable thresholds (cosine similarity).
export const DUP_THRESHOLD = 0.92      // near-identical -> duplicate
export const CLUSTER_THRESHOLD = 0.78  // same pattern -> same cluster

export interface ClusterMatch {
  decision: 'duplicate' | 'join' | 'new'
  cluster: ScamCluster
  similarity: number
}

export async function assignCluster(
  vector: number[],
  classification: Classification,
  reportId: string,
  now: number,
): Promise<ClusterMatch> {
  const store = getStore()
  // Candidate clusters in the same category (keeps comparison cheap).
  const candidates = (await store.query<ScamCluster>(CLUSTERS, {
    where: [{ field: 'category', op: '==', value: classification.category }],
    limit: 300,
  })).map((r) => r.data)

  let best: { cluster: ScamCluster; sim: number } | null = null
  for (const c of candidates) {
    if (!c.centroid?.length) continue
    const sim = cosineSimilarity(vector, c.centroid)
    if (!best || sim > best.sim) best = { cluster: c, sim }
  }

  if (best && best.sim >= DUP_THRESHOLD) {
    const updated = await touchCluster(best.cluster, classification, vector, now, /*incCount*/ true)
    return { decision: 'duplicate', cluster: updated, similarity: best.sim }
  }
  if (best && best.sim >= CLUSTER_THRESHOLD) {
    const updated = await touchCluster(best.cluster, classification, vector, now, true)
    return { decision: 'join', cluster: updated, similarity: best.sim }
  }

  // Seed a new cluster.
  const cluster: ScamCluster = {
    id: genId('cl_'),
    category: classification.category,
    canonicalReportId: reportId,
    title: classification.summary || `${classification.category} pattern`,
    centroid: vector,
    reportCount: 1,
    severity: 'low',
    platforms: classification.platform ? [classification.platform] : [],
    regions: classification.region && classification.region !== 'unknown' ? [classification.region] : [],
    firstSeen: now,
    lastSeen: now,
    trendScore: 1,
  }
  await store.set(CLUSTERS, cluster.id, cluster as unknown as Record<string, unknown>)
  return { decision: 'new', cluster, similarity: best?.sim ?? 0 }
}

async function touchCluster(
  cluster: ScamCluster,
  classification: Classification,
  vector: number[],
  now: number,
  incCount: boolean,
): Promise<ScamCluster> {
  const store = getStore()
  const reportCount = cluster.reportCount + (incCount ? 1 : 0)
  // Running-mean centroid update.
  const centroid = cluster.centroid.map((v, i) =>
    (v * cluster.reportCount + (vector[i] ?? 0)) / reportCount,
  )
  const platforms = uniq([...cluster.platforms, classification.platform].filter(Boolean))
  const regions = uniq([...cluster.regions, classification.region].filter((r) => r && r !== 'unknown'))
  const patch: Partial<ScamCluster> = {
    reportCount, centroid, platforms, regions, lastSeen: now,
    trendScore: computeTrend(reportCount, cluster.firstSeen, now),
  }
  await store.update(CLUSTERS, cluster.id, patch)
  return { ...cluster, ...patch } as ScamCluster
}

export function setClusterSeverity(clusterId: string, severity: Severity): Promise<void> {
  return getStore().update(CLUSTERS, clusterId, { severity })
}

// Recency-weighted trend: volume / age-in-days, with light decay.
export function computeTrend(reportCount: number, firstSeen: number, now: number): number {
  const ageDays = Math.max(1, (now - firstSeen) / 86_400_000)
  return +(reportCount / Math.pow(ageDays, 0.6)).toFixed(3)
}

function uniq<T>(a: T[]): T[] { return [...new Set(a)] }
