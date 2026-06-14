// ─────────────────────────────────────────────────────────────────
// GET /api/trustseal/billing/status  (asq-trustseal-billing-b3)
// Authenticated DISPLAY projection for the dashboard billing section. Read-only —
// this is NOT entitlement enforcement (B4); it only surfaces the account's current
// plan/status/renewal for rendering. Resolves via the B1 entitlement model.
// ─────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/trustseal/account'
import { getEntitlement, getSubscription } from '@/lib/billing/entitlement'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const [ent, sub] = await Promise.all([getEntitlement(user.uid), getSubscription(user.uid)])

  return NextResponse.json(
    {
      plan: ent.plan,
      status: ent.status,
      active: ent.active,
      inGrace: ent.inGrace,
      currentEnd: ent.currentEnd,
      interval: sub?.interval ?? null,
      cancelAtCycleEnd: sub?.cancelAtCycleEnd ?? false,
    },
    { headers: { 'cache-control': 'private, no-store' } },
  )
}
