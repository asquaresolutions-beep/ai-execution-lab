// GET /api/scam-intel/growth  (ADMIN)
//   ?view=discover|entities|leverage|all
// Growth intelligence for prioritisation (Discover candidates, fastest-growing
// entities, highest-leverage topics). Derived from clusters — bounded reads.
import { NextResponse } from 'next/server'
import { discoverCandidates, fastestGrowingEntities, topicLeverage } from '@/lib/scam-intel/growth-analytics'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const view = new URL(req.url).searchParams.get('view') || 'all'
  try {
    if (view === 'discover') return NextResponse.json({ discoverCandidates: await discoverCandidates() })
    if (view === 'entities') return NextResponse.json({ fastestGrowingEntities: await fastestGrowingEntities() })
    if (view === 'leverage') return NextResponse.json({ topicLeverage: await topicLeverage() })
    const [discover, entities, leverage] = await Promise.all([
      discoverCandidates(), fastestGrowingEntities(), topicLeverage(),
    ])
    return NextResponse.json({ discoverCandidates: discover, fastestGrowingEntities: entities, topicLeverage: leverage })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
