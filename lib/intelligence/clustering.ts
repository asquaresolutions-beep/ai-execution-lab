// ─────────────────────────────────────────────────────────────────
// lib/intelligence/clustering.ts
// Lightweight agglomerative clustering over embedding vectors — group
// semantically similar items (e.g. scam patterns: phishing/OTP/banking),
// surface repeated linguistic tactics, and compute cluster centroids. Pure
// (no Vertex/BigQuery cost); operates on vectors you already have. (task 3)
// ─────────────────────────────────────────────────────────────────

import { cosineSimilarity } from '@/lib/ai/embeddings'

export interface VectorItem { id: string; vector: number[]; label?: string; tactics?: string[] }
export interface Cluster {
  id: number
  memberIds: string[]
  size: number
  centroid: number[]
  cohesion: number              // avg intra-cluster similarity (0..1)
  topTactics: Array<{ tactic: string; count: number }>
  label: string
}

function centroidOf(vectors: number[][]): number[] {
  if (!vectors.length) return []
  const dim = vectors[0].length
  const c = new Array(dim).fill(0)
  for (const v of vectors) for (let i = 0; i < dim; i++) c[i] += v[i]
  for (let i = 0; i < dim; i++) c[i] /= vectors.length
  return c
}

/**
 * Single-link agglomerative clustering by cosine-similarity threshold.
 * O(n²) — intended for hundreds of items per call (a query result set or a
 * day's reports), not the whole corpus.
 */
export function clusterByThreshold(items: VectorItem[], threshold = 0.78): Cluster[] {
  const n = items.length
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])))
  const union = (a: number, b: number) => { parent[find(a)] = find(b) }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (cosineSimilarity(items[i].vector, items[j].vector) >= threshold) union(i, j)
    }
  }
  const groups = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const root = find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push(i)
  }

  const clusters: Cluster[] = []
  let cid = 0
  for (const idxs of groups.values()) {
    const vectors = idxs.map((i) => items[i].vector)
    const centroid = centroidOf(vectors)
    // Cohesion = mean similarity of members to the centroid.
    const cohesion = idxs.length === 1 ? 1 : Math.round((idxs.reduce((a, i) => a + cosineSimilarity(items[i].vector, centroid), 0) / idxs.length) * 1000) / 1000
    const tally = new Map<string, number>()
    for (const i of idxs) for (const t of items[i].tactics ?? []) tally.set(t, (tally.get(t) ?? 0) + 1)
    const topTactics = Array.from(tally.entries()).map(([tactic, count]) => ({ tactic, count })).sort((a, b) => b.count - a.count).slice(0, 6)
    const label = items[idxs[0]].label || (topTactics[0] ? `pattern: ${topTactics[0].tactic}` : `cluster ${cid}`)
    clusters.push({ id: cid++, memberIds: idxs.map((i) => items[i].id), size: idxs.length, centroid, cohesion, topTactics, label })
  }
  return clusters.sort((a, b) => b.size - a.size)
}
