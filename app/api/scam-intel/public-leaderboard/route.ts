// GET /api/scam-intel/public-leaderboard   (PUBLIC, cached)
// Powers the public "Trending Scam Campaigns" view. Serves the live BigQuery
// scam_corpus leaderboard when configured; otherwise a curated fallback from the
// intelligence catalog so the page is always populated and crawlable.
import { NextResponse } from 'next/server'
import { scamLeaderboard, bigQueryReady } from '@/lib/store/bigquery'
import { INTEL_PAGES } from '@/lib/scam-intel/intel-pages'
import { enforceRateLimit, RateLimitError } from '@/lib/ai/rate-limit'
import { clientIp } from '@/lib/admin-auth'
import { jsonRoute } from '@/lib/api/json'

export const dynamic = 'force-dynamic'

function fallback() {
  const brands = new Map<string, number>()
  for (const p of INTEL_PAGES) p.brands.forEach((b, i) => brands.set(b, (brands.get(b) ?? 0) + (3 - Math.min(2, i))))
  return {
    live: false,
    total: INTEL_PAGES.length,
    topCampaigns: INTEL_PAGES.map((p) => ({ k: p.h1, n: 0, slug: p.slug })),
    topBrands: [...brands.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, n })),
    fastestGrowing: [],
  }
}

export const GET = jsonRoute('scam-intel/public-leaderboard', async (req) => {
  try { await enforceRateLimit({ key: `pub-lb:${clientIp(req)}`, limit: 60, windowMs: 60_000 }) }
  catch (e) { if (e instanceof RateLimitError) return NextResponse.json({ error: 'rate_limited' }, { status: 429 }) }

  const headers = { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' }
  if (bigQueryReady()) {
    try {
      const lb = await scamLeaderboard(90)
      if (lb.total > 0) return NextResponse.json({ live: true, ...lb }, { headers })
    } catch { /* fall through to curated */ }
  }
  return NextResponse.json(fallback(), { headers })
})
