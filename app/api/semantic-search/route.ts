// GET/POST /api/semantic-search?q=...&k=8  (RAG-ready retrieval)
// Embeds the query with Vertex, runs BigQuery VECTOR_SEARCH over the
// embeddings store, returns ranked matches. Powers semantic search +
// recommendations + RAG context retrieval. Live only when Vertex + BigQuery
// are configured; otherwise returns a clear 'not configured' response.
import { NextResponse } from 'next/server'
import { embedQuery, EMBED_DIM, EMBED_MODEL, getLastEmbedError } from '@/lib/ai/embeddings'
import { vectorSearch, bigQueryReady, corpusDimensions } from '@/lib/store/bigquery'
import { vertexConfigured } from '@/lib/ai/provider'
import { log } from '@/lib/observability/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

async function handle(q: string, k: number, diag: boolean) {
  if (!vertexConfigured() || !bigQueryReady()) {
    return NextResponse.json(
      { error: 'not_configured', detail: 'Requires Vertex AI + BigQuery credentials (VERTEX_PROJECT_ID + service account/token).' },
      { status: 503 },
    )
  }
  // Canonical query embedding: same model + 768-dim as the stored corpus,
  // task_type=RETRIEVAL_QUERY.
  const { vector, live, model } = await embedQuery(q)
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

  // Diagnostic mode (?diag=1): report the REAL query dim and the REAL stored
  // corpus dims side by side, without running VECTOR_SEARCH. Stops guessing.
  if (diag) {
    const corpus = await corpusDimensions().catch((e) => [{ dim: -1, recorded_dim: -1, model: `error: ${e instanceof Error ? e.message : e}`, rows: 0 }])
    return NextResponse.json({ diag: true, queryDim: vector.length, queryModel: model, canonicalDim: EMBED_DIM, corpus })
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

  const hits = await vectorSearch(vector, k)
  return NextResponse.json(
    { query: q, model, dim: vector.length, embeddingLive: live, count: hits.length, results: hits },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } },
  )
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const q = (sp.get('q') || '').trim()
  const diag = sp.get('diag') === '1'
  if (q.length < 2) return NextResponse.json({ error: 'q required' }, { status: 400 })
  return handle(q, Number(sp.get('k')) || 8, diag)
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { q?: string; query?: string; k?: number }
  const q = (body.q || body.query || '').trim()
  if (q.length < 2) return NextResponse.json({ error: 'q/query required' }, { status: 400 })
  return handle(q, body.k || 8, false)
}
