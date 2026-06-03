// ─────────────────────────────────────────────────────────────────
// lib/intelligence/snippets.ts
// Retrieval presentation: query-aware snippets, term highlights, relevance
// explanations, and confidence scoring from COSINE distance. Pure — turns a
// raw VECTOR_SEARCH hit into a human-/LLM-readable result. (task 6)
// ─────────────────────────────────────────────────────────────────

const STOP = new Set(['the','a','an','and','or','of','to','in','for','on','is','are','how','what','why','do','does','your','you','with','at','by','from','this','that','it','as','be'])

export function queryTerms(q: string): string[] {
  return Array.from(new Set((q.toLowerCase().match(/[a-z0-9ऀ-ॿ]+/g) ?? []).filter((t) => t.length > 2 && !STOP.has(t))))
}

/**
 * Cosine DISTANCE (0 = identical, 2 = opposite) → 0..1 confidence.
 * VECTOR_SEARCH returns distance; similarity = 1 - distance/2 for unit vectors.
 */
export function confidenceFromDistance(distance: number): number {
  const sim = Math.max(0, Math.min(1, 1 - distance / 2))
  return Math.round(sim * 1000) / 1000
}

export function confidenceBand(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.78) return 'high'
  if (confidence >= 0.62) return 'medium'
  return 'low'
}

/** Extract the most query-relevant ~maxLen window from body text. */
export function buildSnippet(text: string, query: string, maxLen = 280): string {
  const body = (text || '').replace(/\s+/g, ' ').trim()
  if (body.length <= maxLen) return body
  const terms = queryTerms(query)
  if (!terms.length) return body.slice(0, maxLen) + '…'
  // Score sentences by query-term hits; return the densest contiguous window.
  const sentences = body.split(/(?<=[.!?])\s+/)
  let best = 0, bestScore = -1
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i].toLowerCase()
    const score = terms.reduce((a, t) => a + (s.includes(t) ? 1 : 0), 0)
    if (score > bestScore) { bestScore = score; best = i }
  }
  let out = sentences[best]
  let j = best + 1
  while (j < sentences.length && (out.length + sentences[j].length) < maxLen) { out += ' ' + sentences[j]; j++ }
  if (out.length > maxLen) out = out.slice(0, maxLen) + '…'
  return out.trim()
}

/** Term offsets within a snippet for client-side highlighting. */
export interface Highlight { term: string; start: number; end: number }
export function highlights(snippet: string, query: string): Highlight[] {
  const terms = queryTerms(query)
  const out: Highlight[] = []
  const lower = snippet.toLowerCase()
  for (const t of terms) {
    let from = 0, idx: number
    while ((idx = lower.indexOf(t, from)) !== -1) {
      out.push({ term: t, start: idx, end: idx + t.length }); from = idx + t.length
    }
  }
  return out.sort((a, b) => a.start - b.start).slice(0, 25)
}

/** Plain-language reason a result matched (for UI + trust). */
export function relevanceExplanation(opts: { confidence: number; matchedTerms: string[]; sourceType?: string }): string {
  const { confidence, matchedTerms, sourceType } = opts
  const band = confidenceBand(confidence)
  const pct = Math.round(confidence * 100)
  const lexical = matchedTerms.length ? `shares the terms ${matchedTerms.slice(0, 4).map((t) => `“${t}”`).join(', ')}` : 'is semantically close in meaning (no exact keyword overlap)'
  const src = sourceType ? ` from a ${sourceType.replace(/_/g, ' ')}` : ''
  return `${band[0].toUpperCase()}${band.slice(1)} relevance (${pct}%): this result${src} ${lexical}.`
}

export function matchedTerms(text: string, query: string): string[] {
  const lower = (text || '').toLowerCase()
  return queryTerms(query).filter((t) => lower.includes(t))
}
