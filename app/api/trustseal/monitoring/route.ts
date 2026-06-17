// GET/POST /api/trustseal/monitoring  (asq-trustseal-phase5 + hardening)
// GET: { entitled, alerts, unread } for the dashboard. POST: mark an alert read
// ({alertId}) or mark all read ({all:true}). Per-user, auth-guarded, never cached.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/trustseal/account'
import { isMonitoringEntitled } from '@/lib/billing/enforce'
import { readAlerts, markAlertRead, markAllAlertsRead } from '@/lib/trustseal/monitoring/alerts'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const entitled = await isMonitoringEntitled(user.uid)
  const alerts = entitled ? await readAlerts(user.uid, 100) : []
  const unread = alerts.filter((a) => !a.read).length
  return NextResponse.json({ entitled, alerts, unread }, { status: 200, headers: { 'cache-control': 'private, no-store' } })
}

export async function POST(req: Request) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await isMonitoringEntitled(user.uid))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let body: { alertId?: string; all?: boolean } = {}
  try { body = (await req.json()) as typeof body } catch { /* */ }

  if (body.all) {
    const updated = await markAllAlertsRead(user.uid)
    return NextResponse.json({ ok: true, updated }, { headers: { 'cache-control': 'private, no-store' } })
  }
  if (body.alertId) {
    const ok = await markAlertRead(user.uid, body.alertId)
    return NextResponse.json({ ok }, { status: ok ? 200 : 400, headers: { 'cache-control': 'private, no-store' } })
  }
  return NextResponse.json({ error: 'bad_request' }, { status: 400 })
}
