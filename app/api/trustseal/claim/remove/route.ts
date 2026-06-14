// POST /api/trustseal/claim/remove  (asq-trustseal-pending-removal)
// Auth (Bearer ID token). Body: { domain }. Owner-only hard-delete of a
// NON-verified claim. Verified domains are protected (→ 409 cannot_delete_verified);
// a missing/not-owned claim → 404. Per-user, never cached.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/trustseal/account'
import { removeClaim, ClaimError } from '@/lib/trustseal/claim'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { domain?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 }) }
  const domain = (body?.domain || '').trim()
  if (!domain) return NextResponse.json({ error: 'domain is required' }, { status: 400 })

  try {
    const res = await removeClaim(domain, user.uid)
    return NextResponse.json({ ok: true, domain: res.domain }, { status: 200, headers: { 'cache-control': 'private, no-store' } })
  } catch (e) {
    if (e instanceof ClaimError) return NextResponse.json({ error: e.code }, { status: e.status })
    return NextResponse.json({ error: 'remove_failed' }, { status: 500 })
  }
}
