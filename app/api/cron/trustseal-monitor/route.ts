// GET /api/cron/trustseal-monitor  (asq-trustseal-phase5)
// Daily monitoring pass: re-verifies monitoring-entitled (Business/Pro) domains,
// diffs against the prior snapshot, writes alerts, and emails digests. Authenticated
// via CRON_SECRET (isAuthorizedCron). Idempotent (alerts are deduped per
// domain+kind+day) and fail-closed. Daily schedule (Vercel Hobby-compatible).
import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { runMonitoringScan } from '@/lib/trustseal/monitoring/scan'
import { reportError } from '@/lib/observability/errors'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const result = await runMonitoringScan()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    await reportError('cron.trustseal_monitor', err, { severity: 'error' })
    return NextResponse.json({ error: 'monitor_failed' }, { status: 500 })
  }
}
