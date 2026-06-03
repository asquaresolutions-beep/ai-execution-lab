// POST /api/trustscore  (PUBLIC, rate-limited, cached)
// Body: { input: string, platform?: string, region?: string }
// → { trustScore, scamProbability, verdict, category, signals, explanation }
// The TrustScore / ScamCheck API surface (Cloud Run-ready via the Next app).
import { NextResponse } from 'next/server'
import { computeTrustScore } from '@/lib/scam-intel/trustscore'
import { enforceRateLimit, RATE_LIMITS, RateLimitError } from '@/lib/ai/rate-limit'
import { clientIp } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(36)
}

export async function POST(req: Request) {
  let body: { input?: string; platform?: string; region?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }
  const input = (body.input || '').trim()
  if (input.length < 4) return NextResponse.json({ error: 'input required (min 4 chars)' }, { status: 400 })

  try {
    await enforceRateLimit({ key: `trustscore:${hash(clientIp(req))}`, ...RATE_LIMITS.publicIngest })
  } catch (e) {
    if (e instanceof RateLimitError) return NextResponse.json({ error: 'rate limited' }, { status: 429 })
    throw e
  }

  const result = await computeTrustScore(input, { platform: body.platform, region: body.region })
  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
  })
}
