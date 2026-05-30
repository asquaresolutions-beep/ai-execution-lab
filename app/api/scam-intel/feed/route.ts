// GET /api/scam-intel/feed  (PUBLIC, read-only)
//   ?view=feed|trending|heatmap|search
//   feed:    &category=&region=&limit=
//   search:  &q=
import { NextResponse } from 'next/server'
import { publicFeed, trending, heatmap } from '@/lib/scam-intel/feed'
import { searchClusters } from '@/lib/scam-intel/vector-search'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const view = sp.get('view') || 'feed'
  try {
    switch (view) {
      case 'trending':
        return NextResponse.json({ items: await trending(Number(sp.get('limit')) || 20) })
      case 'heatmap':
        return NextResponse.json({ cells: await heatmap(Number(sp.get('days')) || 30) })
      case 'search': {
        const q = sp.get('q')
        if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 })
        return NextResponse.json({ results: await searchClusters(q, Number(sp.get('limit')) || 10) })
      }
      case 'feed':
      default:
        return NextResponse.json({
          reports: await publicFeed({
            limit: Number(sp.get('limit')) || 50,
            category: sp.get('category') || undefined,
            region: sp.get('region') || undefined,
          }),
        })
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
