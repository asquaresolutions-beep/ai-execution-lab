// ─────────────────────────────────────────────────────────────────
// lib/seo/semantic-links.ts
// Semantic internal-link intelligence: related-doc detection, clustering,
// and AI-driven internal-link suggestions — all from embeddings + cosine.
// Works on any corpus of { id, title, url, vector } (e.g. the BigQuery
// embeddings store or in-memory). No AI call needed (pure vector math),
// so it is free to run at scale.
// ─────────────────────────────────────────────────────────────────

import { cosineSimilarity } from '@/lib/ai/embeddings'

export interface DocVector { id: string; title: string; url: string; vector: number[]; type?: string }

export interface RelatedDoc { id: string; title: string; url: string; score: number }
export interface LinkSuggestion { fromId: string; fromUrl: string; toId: string; toUrl: string; toTitle: string; score: number; anchor: string }
export interface Cluster { id: number; label: string; members: { id: string; title: string; url: string }[] }

/** Top-K semantically related docs for one doc. */
export function relatedDocs(doc: DocVector, corpus: DocVector[], topK = 5, minScore = 0.6): RelatedDoc[] {
  return corpus
    .filter((d) => d.id !== doc.id && d.vector?.length)
    .map((d) => ({ id: d.id, title: d.title, url: d.url, score: +cosineSimilarity(doc.vector, d.vector).toFixed(3) }))
    .filter((d) => d.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

/**
 * Internal-link suggestions across the corpus. One suggestion per (from→to)
 * pair above threshold, with a contextual anchor derived from the target
 * title (no repeated exact-match anchor cannibalization across a page).
 */
export function suggestInternalLinks(corpus: DocVector[], opts: { perDoc?: number; minScore?: number } = {}): LinkSuggestion[] {
  const perDoc = opts.perDoc ?? 3
  const minScore = opts.minScore ?? 0.62
  const out: LinkSuggestion[] = []
  for (const doc of corpus) {
    if (!doc.vector?.length) continue
    const related = relatedDocs(doc, corpus, perDoc, minScore)
    const usedAnchors = new Set<string>()
    for (const r of related) {
      const anchor = contextualAnchor(r.title, usedAnchors)
      out.push({ fromId: doc.id, fromUrl: doc.url, toId: r.id, toUrl: r.url, toTitle: r.title, score: r.score, anchor })
    }
  }
  return out
}

/**
 * Greedy agglomerative clustering by cosine similarity (threshold-based).
 * Good enough for topical clustering of a few thousand docs without a
 * heavyweight clustering dependency.
 */
export function clusterCorpus(corpus: DocVector[], threshold = 0.7): Cluster[] {
  const clusters: { centroid: number[]; members: DocVector[] }[] = []
  for (const doc of corpus) {
    if (!doc.vector?.length) continue
    let best: { c: typeof clusters[number]; sim: number } | null = null
    for (const c of clusters) {
      const sim = cosineSimilarity(doc.vector, c.centroid)
      if (!best || sim > best.sim) best = { c, sim }
    }
    if (best && best.sim >= threshold) {
      best.c.members.push(doc)
      best.c.centroid = runningMean(best.c.centroid, doc.vector, best.c.members.length)
    } else {
      clusters.push({ centroid: [...doc.vector], members: [doc] })
    }
  }
  return clusters.map((c, i) => ({
    id: i,
    label: c.members[0]?.title ?? `cluster ${i}`,
    members: c.members.map((m) => ({ id: m.id, title: m.title, url: m.url })),
  }))
}

/** Find pages with no inbound semantic links (orphan risk in the graph). */
export function findSemanticOrphans(corpus: DocVector[], minScore = 0.62): DocVector[] {
  const suggestions = suggestInternalLinks(corpus, { minScore })
  const linkedTo = new Set(suggestions.map((s) => s.toId))
  return corpus.filter((d) => !linkedTo.has(d.id))
}

function contextualAnchor(title: string, used: Set<string>): string {
  let a = title.replace(/\s*[|—-]\s*A Square Solutions.*$/i, '').replace(/\s*\(20\d\d\).*$/, '').trim()
  if (used.has(a.toLowerCase())) a = `more on ${a}`
  used.add(a.toLowerCase())
  return a
}

function runningMean(centroid: number[], v: number[], n: number): number[] {
  return centroid.map((c, i) => (c * (n - 1) + (v[i] ?? 0)) / n)
}
