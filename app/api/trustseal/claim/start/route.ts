// POST /api/trustseal/claim/start  (asq-trustseal-pr2)
// Auth (Bearer ID token). Body: { domain }. Mints/returns the DNS TXT challenge
// for the caller to add. Verified-by-another → 409. Rate-limited per account.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/trustseal/account'
import { enforceRateLimit, RateLimitError } from '@/lib/ai/rate-limit'
import { startClaim, expectedRecords, ClaimError } from '@/lib/trustseal/claim'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { domain?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 }) }
  const domain = (body?.domain || '').trim()
  if (!domain) return NextResponse.json({ error: 'domain is required' }, { status: 400 })

  try {
    await enforceRateLimit({ key: `trustseal:claim:start:${user.uid}`, limit: 20, windowMs: 60_000 })
  } catch (e) {
    if (e instanceof RateLimitError) {
      const retryAfter = Math.max(1, Math.ceil((e.resetAt - Date.now()) / 1000))
      return NextResponse.json({ error: 'rate_limited', resetAt: e.resetAt }, { status: 429, headers: { 'retry-after': String(retryAfter) } })
    }
    throw e
  }

  try {
    const claim = await startClaim(domain, user.uid)
    const rec = expectedRecords(claim.domain, claim.token)
    return NextResponse.json(
      {
        domain: claim.domain,
        status: claim.status,
        token: claim.token,
        record: rec.primary,
        fallback: rec.fallback,
        instructions: `Add a DNS TXT record on "${rec.primary.name}" with value "${rec.value}", then call verify.`,
      },
      { status: 200, headers: { 'cache-control': 'private, no-store' } },
    )
  } catch (e) {
    if (e instanceof ClaimError) return NextResponse.json({ error: e.code }, { status: e.status })
    return NextResponse.json({ error: 'claim_failed' }, { status: 500 })
  }
}
