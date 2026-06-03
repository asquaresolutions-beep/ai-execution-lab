// GET/POST /api/semantic-search?q=...&k=8  (RAG-ready retrieval)
// Embeds the query with Vertex, runs BigQuery VECTOR_SEARCH over the
// embeddings store, returns ranked matches. Powers semantic search +
// recommendations + RAG context retrieval. Live only when Vertex + BigQuery
// are configured; otherwise returns a clear 'not configured' response.
import { NextResponse } from 'next/server'
import { embed } from '@/lib/ai/embeddings'
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
  const { vector, live } = await embed(q)
  const hits = await vectorSearch(vector, k)
  return NextResponse.json(
    { query: q, embeddingLive: live, count: hits.length, results: hits },
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
