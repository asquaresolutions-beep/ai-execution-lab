// POST /api/trustseal/claim/verify  (asq-trustseal-pr2)
// Auth (Bearer ID token). Body: { domain }. Checks the domain's TXT records for
// the caller's challenge token and promotes the claim to verified. Ownership of a
// domain verified by ANOTHER account is immutable → 409. Rate-limited per account
// (stricter than start, to avoid DNS hammering).
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/trustseal/account'
import { enforceRateLimit, RateLimitError } from '@/lib/ai/rate-limit'
import { verifyClaim, ClaimError } from '@/lib/trustseal/claim'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { domain?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 }) }
  const domain = (body?.domain || '').trim()
  if (!domain) return NextResponse.json({ error: 'domain is required' }, { status: 400 })

  try {
    await enforceRateLimit({ key: `trustseal:claim:verify:${user.uid}`, limit: 10, windowMs: 60_000 })
  } catch (e) {
    if (e instanceof RateLimitError) {
      const retryAfter = Math.max(1, Math.ceil((e.resetAt - Date.now()) / 1000))
      return NextResponse.json({ error: 'rate_limited', resetAt: e.resetAt }, { status: 429, headers: { 'retry-after': String(retryAfter) } })
    }
    throw e
  }

  try {
    const claim = await verifyClaim(domain, user.uid)
    return NextResponse.json(
      { domain: claim.domain, status: claim.status, verifiedAt: claim.verifiedAt ?? null },
      { status: 200, headers: { 'cache-control': 'private, no-store' } },
    )
  } catch (e) {
    if (e instanceof ClaimError) return NextResponse.json({ error: e.code }, { status: e.status })
    return NextResponse.json({ error: 'verify_failed' }, { status: 500 })
  }
}
