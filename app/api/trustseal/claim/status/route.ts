// GET /api/trustseal/claim/status?domain=  (asq-trustseal-pr2)
// Auth (Bearer ID token). Returns the CALLER's claim state for a domain, or
// { status: 'unclaimed' } if the caller has no claim on it. Per-user → no cache.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/trustseal/account'
import { getClaim } from '@/lib/trustseal/claim'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const domain = (new URL(req.url).searchParams.get('domain') || '').trim()
  if (!domain) return NextResponse.json({ error: 'domain is required' }, { status: 400 })

  const claim = await getClaim(domain, user.uid)
  const payload = claim
    ? { domain: claim.domain, status: claim.status, method: claim.method, verifiedAt: claim.verifiedAt ?? null, createdAt: claim.createdAt }
    : { domain, status: 'unclaimed' as const }

  return NextResponse.json(payload, { status: 200, headers: { 'cache-control': 'private, no-store' } })
}
