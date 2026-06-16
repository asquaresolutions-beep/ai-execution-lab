// GET /api/trustseal/monitoring  (asq-trustseal-phase5)
// Authenticated: returns whether the account has monitoring (Business value prop)
// and its recent alerts for the dashboard. Per-user, never cached.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/trustseal/account'
import { isMonitoringEntitled } from '@/lib/billing/enforce'
import { readAlerts } from '@/lib/trustseal/monitoring/alerts'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const entitled = await isMonitoringEntitled(user.uid)
  const alerts = entitled ? await readAlerts(user.uid, 50) : []
  return NextResponse.json({ entitled, alerts }, { status: 200, headers: { 'cache-control': 'private, no-store' } })
}
