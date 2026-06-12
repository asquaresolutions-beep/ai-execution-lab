// GET /api/trustseal/claims  (asq-trustseal-pr2)
// Auth (Bearer ID token). Lists the caller's claims (newest first) for the
// dashboard "Domains" view. Uses the ts_claims (accountId, createdAt) composite
// index. Per-user → no cache.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/trustseal/account'
import { listClaims } from '@/lib/trustseal/claim'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const claims = await listClaims(user.uid)
  return NextResponse.json(
    {
      claims: claims.map((c) => ({
        domain: c.domain,
        status: c.status,
        method: c.method,
        verifiedAt: c.verifiedAt ?? null,
        createdAt: c.createdAt,
      })),
    },
    { status: 200, headers: { 'cache-control': 'private, no-store' } },
  )
}
