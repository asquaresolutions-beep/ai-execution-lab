// GET /api/trustseal/analytics  (asq-trustseal-revenue)
// Admin/ops analytics rollup: domains verified, certificates available, API keys
// provisioned, API requests this month, monitoring alerts (by severity), and paid
// subscriptions (pro/business). Guarded by the cron secret (isAuthorizedCron) —
// platform totals are not a public/user surface. Read-only aggregation.
import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { getPlatformAnalytics } from '@/lib/trustseal/analytics'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const data = await getPlatformAnalytics()
  return NextResponse.json(data, { headers: { 'cache-control': 'private, no-store' } })
}
