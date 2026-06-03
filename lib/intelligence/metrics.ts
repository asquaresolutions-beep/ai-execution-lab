// ─────────────────────────────────────────────────────────────────
// lib/intelligence/metrics.ts
// Retrieval observability: query logs, hit-rate, latency, confidence, and a
// rolling summary for semantic-search quality. In-memory ring buffer (per
// instance) — zero external cost, scale-to-zero friendly. Pairs with the
// existing token/cost tracking in lib/ai/usage.ts for spend visibility.
// (task 7)
// ─────────────────────────────────────────────────────────────────

export interface RetrievalEvent {
  ts: number
  endpoint: string         // 'semantic-search' | 'related' | 'scam-similar' ...
  query: string            // truncated; never logs secrets
  results: number
  topConfidence: number    // 0..1
  hit: boolean             // at least one result over the relevance floor
  latencyMs: number
  embeddingLive: boolean
  cached: boolean
}

const RING_SIZE = 500
const ring: RetrievalEvent[] = []

export function recordRetrieval(e: Omit<RetrievalEvent, 'ts'>): void {
  ring.push({ ts: Date.now(), ...e, query: (e.query || '').slice(0, 120) })
  if (ring.length > RING_SIZE) ring.splice(0, ring.length - RING_SIZE)
}

export interface RetrievalSummary {
  windowMinutes: number
  total: number
  hitRate: number              // fraction of queries with a relevant hit
  avgResults: number
  avgTopConfidence: number
  avgLatencyMs: number
  cacheHitRate: number
  liveEmbeddingRate: number
  byEndpoint: Record<string, number>
  recent: RetrievalEvent[]
  lowConfidenceQueries: string[]  // candidates for new content (content-gap signal)
}

export function retrievalSummary(windowMinutes = 60): RetrievalSummary {
  const since = Date.now() - windowMinutes * 60_000
  const events = ring.filter((e) => e.ts >= since)
  const n = events.length || 1
  const byEndpoint: Record<string, number> = {}
  for (const e of events) byEndpoint[e.endpoint] = (byEndpoint[e.endpoint] ?? 0) + 1
  const avg = (sel: (e: RetrievalEvent) => number) => Math.round((events.reduce((a, e) => a + sel(e), 0) / n) * 1000) / 1000
  return {
    windowMinutes,
    total: events.length,
    hitRate: avg((e) => (e.hit ? 1 : 0)),
    avgResults: avg((e) => e.results),
    avgTopConfidence: avg((e) => e.topConfidence),
    avgLatencyMs: Math.round(events.reduce((a, e) => a + e.latencyMs, 0) / n),
    cacheHitRate: avg((e) => (e.cached ? 1 : 0)),
    liveEmbeddingRate: avg((e) => (e.embeddingLive ? 1 : 0)),
    byEndpoint,
    recent: events.slice(-20).reverse(),
    // Low-confidence / zero-hit queries reveal what content to create next.
    lowConfidenceQueries: Array.from(new Set(events.filter((e) => !e.hit || e.topConfidence < 0.6).map((e) => e.query))).slice(0, 25),
  }
}
