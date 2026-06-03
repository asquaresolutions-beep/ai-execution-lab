// POST /api/geo-score   { title?, text }   (public, rate-limited)
// GEO / AI-search readiness audit: AI-Overview readiness, citation
// probability, semantic authority + answer-first suggestions. Deterministic
// (no Vertex cost) — a monetizable content-audit endpoint.
import { NextResponse } from 'next/server'
import { geoScore } from '@/lib/intelligence/geo'
import { enforceRateLimit, RateLimitError } from '@/lib/ai/rate-limit'
import { clientIp } from '@/lib/admin-auth'
import { jsonRoute } from '@/lib/api/json'

export const dynamic = 'force-dynamic'

export const POST = jsonRoute('geo-score', async (req) => {
  try {
    await enforceRateLimit({ key: `geo-score:${clientIp(req)}`, limit: 30, windowMs: 60_000 })
  } catch (e) {
    if (e instanceof RateLimitError) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  const body = await req.json().catch(() => ({})) as { title?: string; text?: string }
  const text = (body.text || '').trim()
  if (text.length < 50) return NextResponse.json({ error: 'text too short (min 50 chars)' }, { status: 400 })
  const score = geoScore({ title: body.title, text })
  return NextResponse.json({ ...score }, { headers: { 'Cache-Control': 'no-store' } })
})
