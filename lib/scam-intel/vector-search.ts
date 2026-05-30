// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/vector-search.ts
// Semantic search over reports & clusters. In dev/Firestore-REST this is
// an in-process cosine scan (fine to thousands of docs). For scale, the
// SAME interface is satisfied by Firestore Vector Search / Vertex Matching
// Engine — see firestore-schema.ts for the index definition.
// ─────────────────────────────────────────────────────────────────

import { getStore } from '@/lib/store/adapter'
import { embed, rankBySimilarity } from '@/lib/ai/embeddings'
import type { ScamReport, ScamCluster } from './types'

export interface SearchHit<T> { item: T; score: number }

export async function searchReports(query: string, topK = 10): Promise<SearchHit<ScamReport>[]> {
  const { vector } = await embed(query)
  const rows = (await getStore().query<ScamReport>('scam_reports', {
    where: [{ field: 'status', op: '==', value: 'approved' }],
    limit: 2000,
  })).map((r) => r.data).filter((r) => r.vector?.length)
  return rankBySimilarity(vector, rows, topK).map((r) => ({ item: r as ScamReport, score: r.score }))
}

export async function searchClusters(query: string, topK = 10): Promise<SearchHit<ScamCluster>[]> {
  const { vector } = await embed(query)
  const rows = (await getStore().query<ScamCluster>('scam_clusters', { limit: 2000 }))
    .map((r) => r.data)
    .filter((c) => c.centroid?.length)
    .map((c) => ({ ...c, vector: c.centroid }))
  return rankBySimilarity(vector, rows, topK).map((r) => ({ item: r as unknown as ScamCluster, score: r.score }))
}

/** "Find scams similar to this one" — powers the related-alerts feature. */
export async function similarToReport(report: ScamReport, topK = 6): Promise<SearchHit<ScamReport>[]> {
  if (!report.vector?.length) return []
  const rows = (await getStore().query<ScamReport>('scam_reports', {
    where: [{ field: 'status', op: '==', value: 'approved' }],
    limit: 2000,
  })).map((r) => r.data).filter((r) => r.id !== report.id && r.vector?.length)
  return rankBySimilarity(report.vector, rows, topK).map((r) => ({ item: r as ScamReport, score: r.score }))
}
