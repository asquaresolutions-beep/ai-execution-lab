// ─────────────────────────────────────────────────────────────────
// lib/intelligence/hybrid.ts
// Hybrid retrieval: blend dense (vector) relevance with sparse (lexical /
// BM25-lite) relevance, then rerank. Vector search alone can miss exact
// entity/keyword matches (brand names, "OTP", "UPI", helpline numbers);
// lexical alone misses paraphrase. The blend is more robust for both
// scam-intelligence and GEO/SEO retrieval. Pure — operates on hits already
// returned by VECTOR_SEARCH (so it adds no Vertex/BigQuery cost). (task 1)
// ─────────────────────────────────────────────────────────────────

import { confidenceFromDistance, queryTerms } from './snippets'

export interface RankableHit {
  id: string
  title: string
  url: string
  source_type: string
  distance: number
  text?: string
  slug?: string
  category?: string
}

export interface RankedHit extends RankableHit {
  vectorScore: number   // 0..1 from cosine distance
  lexicalScore: number  // 0..1 BM25-lite over title+text
  hybridScore: number   // weighted blend
}

export interface HybridOptions {
  vectorWeight?: number // default 0.7 (dense-leaning; corpus is paraphrase-rich)
  k1?: number           // BM25 term-frequency saturation
}

/**
 * BM25-lite lexical score (single-doc, no global IDF table — uses term
 * presence + saturated frequency over the hit's own title+text). Cheap and
 * good enough to break ties / surface exact-keyword matches.
 */
function lexicalScore(query: string, text: string, k1: number): number {
  const terms = queryTerms(query)
  if (!terms.length) return 0
  const tokens = (text || '').toLowerCase().match(/[a-z0-9ऀ-ॿ]+/g) ?? []
  if (!tokens.length) return 0
  const len = tokens.length
  const counts = new Map<string, number>()
  for (const tok of tokens) counts.set(tok, (counts.get(tok) ?? 0) + 1)
  let score = 0
  for (const t of terms) {
    const tf = counts.get(t) ?? 0
    if (!tf) continue
    // Length-normalised saturated term frequency.
    const norm = (tf * (k1 + 1)) / (tf + k1 * (0.25 + 0.75 * (len / 400)))
    score += norm
  }
  // Normalise by query length so score ∈ ~0..1.
  return Math.min(1, score / (terms.length * (k1 + 1)))
}

/** Rerank hits by a weighted blend of vector + lexical relevance. */
export function hybridRerank(query: string, hits: RankableHit[], opts: HybridOptions = {}): RankedHit[] {
  const vw = Math.max(0, Math.min(1, opts.vectorWeight ?? 0.7))
  const k1 = opts.k1 ?? 1.4
  return hits
    .map((h) => {
      const vectorScore = confidenceFromDistance(h.distance)
      const lexicalScore = lexicalScore_(query, `${h.title} ${h.text ?? ''}`, k1)
      const hybridScore = Math.round((vw * vectorScore + (1 - vw) * lexicalScore) * 1000) / 1000
      return { ...h, vectorScore, lexicalScore, hybridScore }
    })
    .sort((a, b) => b.hybridScore - a.hybridScore)
}

// Named wrapper so the internal fn name doesn't shadow in map().
function lexicalScore_(query: string, text: string, k1: number): number {
  return Math.round(lexicalScore(query, text, k1) * 1000) / 1000
}
