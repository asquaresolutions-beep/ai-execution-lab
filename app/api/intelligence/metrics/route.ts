// GET /api/intelligence/metrics?window=60   (ADMIN)
// Retrieval observability + estimated spend: hit-rate, confidence, latency,
// cache-hit-rate, per-endpoint volume, content-gap queries, plus today's
// Vertex token cost. Pairs in-memory retrieval metrics with lib/ai/usage.ts.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { retrievalSummary } from '@/lib/intelligence/metrics'
import { costToday } from '@/lib/ai/usage'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const windowMinutes = Math.min(1440, Math.max(5, Number(new URL(req.url).searchParams.get('window')) || 60))
  const retrieval = retrievalSummary(windowMinutes)
  const spend = await costToday().catch(() => ({ totalUsd: 0, byTier: {} }))
  return NextResponse.json({ retrieval, spend, estimatedInr: Math.round(spend.totalUsd * 83 * 100) / 100 })
}
