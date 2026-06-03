// POST /api/scam-intel/similar   { text, k? }   (public, rate-limited)
// Semantic scam-pattern similarity: classify the input, find semantically
// similar scam-relevant corpus content via VECTOR_SEARCH, and return the
// detected category + tactics. Powers ScamCheck "similar known scams" + the
// scam-intelligence similarity API. (task 3)
import { NextResponse } from 'next/server'
import { embedQuery, EMBED_DIM } from '@/lib/ai/embeddings'
import { vectorSearch, bigQueryReady } from '@/lib/store/bigquery'
import { vertexConfigured } from '@/lib/ai/provider'
import { enrich } from '@/lib/intelligence/enrichment'
import { hybridRerank } from '@/lib/intelligence/hybrid'
import { confidenceBand } from '@/lib/intelligence/snippets'
import { enforceRateLimit, RateLimitError } from '@/lib/ai/rate-limit'
import { clientIp } from '@/lib/admin-auth'
import { recordRetrieval } from '@/lib/intelligence/metrics'
import { jsonRoute } from '@/lib/api/json'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const SCAM_SOURCES = ['scamcheck', 'trustseal', 'tier_a_post', 'blog_post']

export const POST = jsonRoute('scam-intel/similar', async (req) => {
  const started = Date.now()
  try {
    await enforceRateLimit({ key: `scam-similar:${clientIp(req)}`, limit: 20, windowMs: 60_000 })
  } catch (e) {
    if (e instanceof RateLimitError) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  const body = await req.json().catch(() => ({})) as { text?: string; k?: number }
  const text = (body.text || '').trim()
  if (text.length < 15) return NextResponse.json({ error: 'text too short (min 15 chars)' }, { status: 400 })
  const k = Math.min(15, body.k || 6)

  // Always classify (works offline). Similarity needs live infra.
  const enrichment = enrich({ text })
  if (!vertexConfigured() || !bigQueryReady()) {
    return NextResponse.json({ classification: enrichment.scam, similar: [], note: 'similarity unavailable (Vertex/BigQuery not configured)' }, { status: 200 })
  }
  const { vector, live } = await embedQuery(text)
  if (!live || vector.length !== EMBED_DIM) {
    return NextResponse.json({ classification: enrichment.scam, similar: [], note: 'live embedding unavailable' }, { status: 200 })
  }
  const raw = await vectorSearch(vector, k + 4, { withText: true, sourceTypes: SCAM_SOURCES })
  const similar = hybridRerank(text, raw).slice(0, k).map((h) => ({
    id: h.id, title: h.title, url: h.url, source_type: h.source_type,
    confidence: h.hybridScore, confidenceBand: confidenceBand(h.hybridScore),
  }))
  const top = similar[0]?.confidence ?? 0
  recordRetrieval({ endpoint: 'scam-similar', query: text, results: similar.length, topConfidence: top, hit: top >= 0.6, latencyMs: Date.now() - started, embeddingLive: true, cached: false })
  return NextResponse.json({
    classification: enrichment.scam,
    category: enrichment.scam.category,
    tactics: enrichment.scam.tactics,
    severity: enrichment.scam.severity,
    similar,
  })
})
