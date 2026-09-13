// ─────────────────────────────────────────────────────────────────
// GET /api/trustseal/command/overview
// The signed-in account's own Command Center data. Gated EXACTLY like
// /api/trustseal/command/access: Firebase Bearer token (401) + Command Center
// entitlement (403), fail-closed. The account is taken from the verified token
// only — this route reads nothing from the query string, headers (other than the
// token) or body. Read-only; never cached.
// ─────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/trustseal/account'
import { isCommandCenterEntitled } from '@/lib/billing/enforce'
import { buildCommandOverview } from '@/lib/trustseal/command/overview'
import { log } from '@/lib/observability/logger'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'cache-control': 'private, no-store' }

export async function GET(req: Request) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE })

  const entitled = await isCommandCenterEntitled(user.uid)
  if (!entitled) {
    return NextResponse.json({ entitled: false, error: 'pro_required' }, { status: 403, headers: NO_STORE })
  }

  try {
    const overview = await buildCommandOverview(user.uid)
    return NextResponse.json(overview, { headers: NO_STORE })
  } catch (e) {
    // stdout log only — this endpoint performs no store writes, even on failure.
    log.error({ event: 'api.trustseal.command.overview.failed', detail: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: 'overview_unavailable' }, { status: 500, headers: NO_STORE })
  }
}
