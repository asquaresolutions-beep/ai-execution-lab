// POST /api/trustseal/verify  (PUBLIC, rate-limited)
// Body: { domain: string, name?: string, country?: string }
// Returns the public verification report (cached read-through + asymmetric TTL).
import { NextResponse } from 'next/server'
import { clientIp } from '@/lib/admin-auth'
import { enforceRateLimit, RateLimitError } from '@/lib/ai/rate-limit'
import { reportError } from '@/lib/observability/errors'
import { getVerification, InvalidDomainError } from '@/lib/trustseal/verify/service'
import { publicReport } from '@/lib/trustseal/verify/policy'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: Request) {
  let body: { domain?: string; name?: string; country?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  const domain = (body?.domain || '').trim()
  if (!domain) {
    return NextResponse.json({ error: 'domain is required' }, { status: 400 })
  }

  const ip = clientIp(req)
  try {
    await enforceRateLimit({ key: `trustseal:verify:${ip}`, limit: 10, windowMs: 60_000 })
  } catch (e) {
    if (e instanceof RateLimitError) {
      const retryAfter = Math.max(1, Math.ceil((e.resetAt - Date.now()) / 1000))
      return NextResponse.json(
        { error: 'rate_limited', resetAt: e.resetAt },
        { status: 429, headers: { 'retry-after': String(retryAfter) } },
      )
    }
    throw e
  }

  try {
    const outcome = await getVerification(domain, { name: body.name, country: body.country })
    const ttl = outcome.ttlSeconds
    return NextResponse.json(
      { ...publicReport(outcome), fromCache: outcome.fromCache },
      {
        status: 200,
        // Browsers cache briefly; the CDN may hold for the full verdict TTL.
        headers: { 'cache-control': `public, max-age=${Math.min(ttl, 300)}, s-maxage=${ttl}` },
      },
    )
  } catch (e) {
    if (e instanceof InvalidDomainError) {
      return NextResponse.json({ error: 'invalid_domain' }, { status: 400 })
    }
    await reportError('api.trustseal.verify', e, { meta: { ip } })
    return NextResponse.json({ error: 'verification_failed' }, { status: 500 })
  }
}
