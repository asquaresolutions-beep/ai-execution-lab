// GET/POST /api/semantic-search?q=...&k=8  (RAG-ready retrieval)
// Embeds the query with Vertex, runs BigQuery VECTOR_SEARCH over the
// embeddings store, returns ranked matches. Powers semantic search +
// recommendations + RAG context retrieval. Live only when Vertex + BigQuery
// are configured; otherwise returns a clear 'not configured' response.
import { NextResponse } from 'next/server'
import { embedQuery, EMBED_DIM, EMBED_MODEL } from '@/lib/ai/embeddings'
import { vectorSearch, bigQueryReady } from '@/lib/store/bigquery'
import { vertexConfigured } from '@/lib/ai/provider'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

async function handle(q: string, k: number) {
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
      { error: 'embedding_unavailable', detail: 'Live Vertex embedding required for semantic search; the query embedding fell back to a non-semantic vector.' },
      { status: 503 },
    )
  }
  if (vector.length !== EMBED_DIM) {
    return NextResponse.json(
      { error: 'dimension_mismatch', detail: `Query embedding dim ${vector.length} != corpus ${EMBED_DIM} (model ${model}). Set VERTEX_EMBED_MODEL=${EMBED_MODEL}.` },
      { status: 500 },
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
  if (q.length < 2) return NextResponse.json({ error: 'q required' }, { status: 400 })
  return handle(q, Number(sp.get('k')) || 8)
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { q?: string; query?: string; k?: number }
  const q = (body.q || body.query || '').trim()
  if (q.length < 2) return NextResponse.json({ error: 'q/query required' }, { status: 400 })
  return handle(q, body.k || 8)
}
