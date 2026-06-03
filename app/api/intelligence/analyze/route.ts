// POST /api/intelligence/analyze   { title?, text, url?, sourceType? }
// Full semantic enrichment for arbitrary text: topic classification, scam
// category + severity, trust signals (TrustSeal layer), GEO/SEO semantic tags,
// and GEO readiness scoring in one call. Deterministic (no Vertex cost).
// Powers ScamCheck pre-screening, TrustSeal trust analysis, and content audits.
import { NextResponse } from 'next/server'
import { enrich } from '@/lib/intelligence/enrichment'
import { geoScore } from '@/lib/intelligence/geo'
import { enforceRateLimit, RateLimitError } from '@/lib/ai/rate-limit'
import { clientIp } from '@/lib/admin-auth'
import { jsonRoute } from '@/lib/api/json'

export const dynamic = 'force-dynamic'

export const POST = jsonRoute('intelligence/analyze', async (req) => {
  try {
    await enforceRateLimit({ key: `analyze:${clientIp(req)}`, limit: 30, windowMs: 60_000 })
  } catch (e) {
    if (e instanceof RateLimitError) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  const body = await req.json().catch(() => ({})) as { title?: string; text?: string; url?: string; sourceType?: string }
  const text = (body.text || '').trim()
  if (text.length < 30) return NextResponse.json({ error: 'text too short (min 30 chars)' }, { status: 400 })
  const enrichment = enrich({ title: body.title, text, url: body.url, sourceType: body.sourceType })
  const geo = geoScore({ title: body.title, text })
  return NextResponse.json({ enrichment, geo }, { headers: { 'Cache-Control': 'no-store' } })
})
