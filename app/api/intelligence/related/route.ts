// GET /api/intelligence/related?q=...&k=6   (semantic recommendations)
//   or ?id=<doc-id>   — "more like this" from an existing corpus doc.
// Powers internal recommendations / related-content widgets. Reuses the
// canonical 768-dim query embedding + BigQuery VECTOR_SEARCH, hybrid-reranked.
import { NextResponse } from 'next/server'
import { embedQuery, EMBED_DIM } from '@/lib/ai/embeddings'
import { vectorSearch, bigQueryReady, getDocById } from '@/lib/store/bigquery'
import { vertexConfigured } from '@/lib/ai/provider'
import { getCached, setCached } from '@/lib/ai/cache'
import { hybridRerank } from '@/lib/intelligence/hybrid'
import { confidenceBand } from '@/lib/intelligence/snippets'
import { recordRetrieval } from '@/lib/intelligence/metrics'
import { jsonRoute } from '@/lib/api/json'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export const GET = jsonRoute('intelligence/related', async (req) => {
  const started = Date.now()
  if (!vertexConfigured() || !bigQueryReady()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }
  const sp = new URL(req.url).searchParams
  const k = Math.min(20, Number(sp.get('k')) || 6)
  let q = (sp.get('q') || '').trim()
  const id = (sp.get('id') || '').trim()

  // "More like this": derive the query text from a stored doc's title.
  let excludeId = ''
  if (!q && id) {
    const doc = await getDocById(id).catch(() => null)
    q = doc?.title ?? ''
    excludeId = id
  }
  if (q.length < 2) return NextResponse.json({ error: 'q or id required' }, { status: 400 })

  const key = `qembed:related:${q.toLowerCase()}`
  let vec = await getCached<number[]>(key)
  let cached = !!vec
  if (!vec) {
    const r = await embedQuery(q)
    if (!r.live || r.vector.length !== EMBED_DIM) return NextResponse.json({ error: 'embedding_unavailable' }, { status: 503 })
    vec = r.vector; cached = false
    await setCached(key, 'qembed-related', vec, 24 * 60 * 60_000)
  }

  const raw = (await vectorSearch(vec, k + 4, { withText: true })).filter((h) => h.id !== excludeId)
  const results = hybridRerank(q, raw).slice(0, k).map((h) => ({
    id: h.id, title: h.title, url: h.url, slug: h.slug, category: h.category, source_type: h.source_type,
    confidence: h.hybridScore, confidenceBand: confidenceBand(h.hybridScore),
  }))
  const top = results[0]?.confidence ?? 0
  recordRetrieval({ endpoint: 'related', query: q, results: results.length, topConfidence: top, hit: top >= 0.6, latencyMs: Date.now() - started, embeddingLive: true, cached })
  return NextResponse.json({ query: q, count: results.length, results }, { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } })
})
