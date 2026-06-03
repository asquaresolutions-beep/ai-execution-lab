// GET /api/scam-intel/search?q=...  (PUBLIC, cached) — searchable scam database.
// Deterministic search over the public scam knowledge base (always-on, free).
import { NextResponse } from 'next/server'
import { searchScams } from '@/lib/scamcheck/search'
import { enforceRateLimit, RateLimitError } from '@/lib/ai/rate-limit'
import { clientIp } from '@/lib/admin-auth'
import { jsonRoute } from '@/lib/api/json'

export const dynamic = 'force-dynamic'

export const GET = jsonRoute('scam-intel/search', async (req) => {
  try { await enforceRateLimit({ key: `scamsearch:${clientIp(req)}`, limit: 60, windowMs: 60_000 }) }
  catch (e) { if (e instanceof RateLimitError) return NextResponse.json({ error: 'rate_limited' }, { status: 429 }) }
  const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 120)
  const results = searchScams(q, 25)
  return NextResponse.json({ query: q, count: results.length, results }, { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } })
})
