// GET /api/scam-intel/trending  (PUBLIC, CDN-cached)
// Serves the materialized trending snapshot — one cheap Firestore read,
// then cached at the edge. Powers the on-page TrendingStrip + widgets
// without rebuilding static pages (real-time freshness, near-zero cost).
import { NextResponse } from 'next/server'
import { latestTrendingSnapshot } from '@/lib/scam-intel/feed'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get('limit')) || 12
  try {
    const snap = await latestTrendingSnapshot(limit)
    return NextResponse.json(snap, {
      headers: {
        // Cache at CDN ~10 min; serve stale while revalidating (cheap + fresh-enough).
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800',
      },
    })
  } catch (err) {
    return NextResponse.json({ generatedAt: Date.now(), items: [], error: (err as Error).message }, { status: 200 })
  }
}
