// ─────────────────────────────────────────────────────────────────
// GET /api/trustseal/command/access  (asq-trustseal-billing-b4)
// Server-authoritative entitlement gate for the Trust Intelligence Command Center
// (a Pro capability). Authenticated (Firebase Bearer). Returns 403 for non-Pro
// accounts; 200 { entitled: true } for Pro. The Command Center page is a static
// shell that calls this on mount and renders the surface only on 200 — but the
// AUTHORITY is here, server-side. Future command data APIs must gate the same way.
// ─────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/trustseal/account'
import { isCommandCenterEntitled } from '@/lib/billing/enforce'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: { 'cache-control': 'private, no-store' } })

  const entitled = await isCommandCenterEntitled(user.uid)
  if (!entitled) {
    return NextResponse.json({ entitled: false, error: 'pro_required' }, { status: 403, headers: { 'cache-control': 'private, no-store' } })
  }
  return NextResponse.json({ entitled: true }, { headers: { 'cache-control': 'private, no-store' } })
}
