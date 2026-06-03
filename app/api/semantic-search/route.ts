// GET/POST /api/semantic-search?q=...&k=8  (RAG-ready retrieval)
// Embeds the query with Vertex, runs BigQuery VECTOR_SEARCH over the
// embeddings store, returns ranked matches. Powers semantic search +
// recommendations + RAG context retrieval. Live only when Vertex + BigQuery
// are configured; otherwise returns a clear 'not configured' response.
import { NextResponse } from 'next/server'
import { embedQuery, EMBED_DIM, EMBED_MODEL, getLastEmbedError } from '@/lib/ai/embeddings'
import { vectorSearch, bigQueryReady, corpusDimensions, vectorSearchPlan } from '@/lib/store/bigquery'
import { vertexConfigured } from '@/lib/ai/provider'
import { log } from '@/lib/observability/logger'
import { getCached, setCached } from '@/lib/ai/cache'
import { hybridRerank } from '@/lib/intelligence/hybrid'
import { buildSnippet, highlights, matchedTerms, confidenceBand, relevanceExplanation } from '@/lib/intelligence/snippets'
import { recordRetrieval } from '@/lib/intelligence/metrics'
import { jsonRoute } from '@/lib/api/json'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** Cache the query embedding (24h) — identical queries cost 0 Vertex calls. */
async function cachedQueryEmbedding(q: string): Promise<{ vector: number[]; live: boolean; model: string; cached: boolean }> {
  const key = `qembed:${EMBED_MODEL}:${q.toLowerCase().trim()}`
  const hit = await getCached<{ vector: number[]; model: string }>(key)
  if (hit && Array.isArray(hit.vector) && hit.vector.length === EMBED_DIM) return { ...hit, live: true, cached: true }
  const { vector, live, model } = await embedQuery(q)
  if (live && vector.length === EMBED_DIM) await setCached(key, 'qembed', { vector, model }, 24 * 60 * 60_000)
  return { vector, live, model, cached: false }
}

async function handle(q: string, k: number, diag: boolean) {
  const started = Date.now()
  if (!vertexConfigured() || !bigQueryReady()) {
    return NextResponse.json(
      { error: 'not_configured', detail: 'Requires Vertex AI + BigQuery credentials (VERTEX_PROJECT_ID + service account/token).' },
      { status: 503 },
    )
  }
  // Canonical query embedding (cached): same model + 768-dim as the corpus,
  // task_type=RETRIEVAL_QUERY.
  const { vector, live, model, cached } = await cachedQueryEmbedding(q)
  // Never run VECTOR_SEARCH with a non-live (hash) fallback or wrong-dim vector
  // — it would either dimension-mismatch or return meaningless results.
  if (!live) {
    return NextResponse.json(
      {
        error: 'embedding_unavailable',
        detail: 'Live Vertex embedding required for semantic search; the query embedding fell back to a non-semantic vector.',
        reason: getLastEmbedError() ?? 'unknown (no error captured — check vertexConfigured/ADC)',
        model: EMBED_MODEL,
      },
      { status: 503 },
    )
  }

  // Diagnostic mode (?diag=1): report query dim, corpus row count + dims,
  // model, and the EXACT generated VECTOR_SEARCH SQL — without running it.
  if (diag) {
    const corpus = await corpusDimensions().catch((e) => [{ dim: -1, recorded_dim: -1, model: `error: ${e instanceof Error ? e.message : e}`, rows: 0 }])
    const plan = await vectorSearchPlan(k, { withText: true }).catch((e) => ({ sql: `error: ${e instanceof Error ? e.message : e}`, selectedColumns: [], missingColumns: [], liveSchema: [] }))
    const rowCount = corpus.reduce((a, c) => a + (c.rows || 0), 0)
    log.info({ event: 'semantic_search.diag', queryDim: vector.length, rowCount, selectedColumns: plan.selectedColumns, missingColumns: plan.missingColumns })
    return NextResponse.json({
      diag: true,
      queryDim: vector.length,
      embeddingDimension: vector.length,
      canonicalDim: EMBED_DIM,
      model: EMBED_MODEL,
      queryModel: model,
      rowCount,
      corpus,
      selectedColumns: plan.selectedColumns,
      missingColumns: plan.missingColumns,
      liveSchema: plan.liveSchema,
      generatedSQL: plan.sql,
    })
  }

  // Hard runtime assertion: query vector MUST be canonical 768.
  if (vector.length !== EMBED_DIM) {
    return NextResponse.json(
      { error: 'query_dimension_mismatch', detail: `Query embedding dim ${vector.length} != canonical ${EMBED_DIM} (model ${model}). Set VERTEX_EMBED_MODEL=${EMBED_MODEL}.`, queryDim: vector.length, canonicalDim: EMBED_DIM },
      { status: 500 },
    )
  }

  // Proactively compare against the ACTUAL stored corpus dimension so a
  // mismatch returns the real numbers + remedy instead of an opaque BigQuery
  // "dimension does not match" error.
  const corpus = await corpusDimensions()
  const mismatched = corpus.filter((c) => c.dim !== vector.length)
  if (corpus.length && mismatched.length === corpus.length) {
    log.warn({ event: 'semantic_search.corpus_dim_mismatch', queryDim: vector.length, corpus })
    return NextResponse.json(
      {
        error: 'corpus_dimension_mismatch',
        detail: `Stored corpus is ${corpus.map((c) => `${c.dim}-dim (${c.rows} rows, model ${c.model})`).join(', ')} but the canonical query is ${vector.length}-dim. Re-embed the corpus at the canonical ${EMBED_DIM}-dim model: re-run scripts/gen-embeddings-to-bigquery.mjs (it now re-embeds any rows whose stored dim != ${EMBED_DIM}).`,
        queryDim: vector.length,
        corpus,
      },
      { status: 409 },
    )
  }

  // Retrieve with body text, hybrid-rerank (dense + lexical), then build
  // snippets / highlights / confidence / relevance explanations. (tasks 1, 6)
  const raw = await vectorSearch(vector, Math.min(50, k * 3), { withText: true })
  const ranked = hybridRerank(q, raw).slice(0, k)
  const results = ranked.map((h) => {
    const snippet = buildSnippet(h.text ?? h.title, q)
    const terms = matchedTerms(`${h.title} ${h.text ?? ''}`, q)
    const confidence = h.hybridScore
    return {
      id: h.id,
      title: h.title,
      url: h.url,
      slug: h.slug,
      category: h.category,
      source_type: h.source_type,
      distance: h.distance,
      confidence,
      confidenceBand: confidenceBand(confidence),
      vectorScore: h.vectorScore,
      lexicalScore: h.lexicalScore,
      snippet,
      highlights: highlights(snippet, q),
      matchedTerms: terms,
      relevanceExplanation: relevanceExplanation({ confidence, matchedTerms: terms, sourceType: h.source_type }),
    }
  })
  const topConfidence = results[0]?.confidence ?? 0
  recordRetrieval({ endpoint: 'semantic-search', query: q, results: results.length, topConfidence, hit: topConfidence >= 0.6, latencyMs: Date.now() - started, embeddingLive: live, cached })
  return NextResponse.json(
    { query: q, model, dim: vector.length, embeddingLive: live, cached, count: results.length, topConfidence, results },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } },
  )
}

export const GET = jsonRoute('semantic-search', async (req) => {
  const sp = new URL(req.url).searchParams
  const q = (sp.get('q') || '').trim()
  const diag = sp.get('diag') === '1'
  if (q.length < 2) return NextResponse.json({ error: 'q required' }, { status: 400 })
  return handle(q, Number(sp.get('k')) || 8, diag)
})

export const POST = jsonRoute('semantic-search', async (req) => {
  const body = await req.json().catch(() => ({})) as { q?: string; query?: string; k?: number }
  const q = (body.q || body.query || '').trim()
  if (q.length < 2) return NextResponse.json({ error: 'q/query required' }, { status: 400 })
  return handle(q, body.k || 8, false)
})
