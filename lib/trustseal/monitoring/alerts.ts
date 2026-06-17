// ─────────────────────────────────────────────────────────────────
// lib/trustseal/monitoring/alerts.ts  (asq-trustseal-phase5)
// Persistence for monitoring alerts (ts_alerts). Equality-only queries (by
// accountId) so NO composite index is needed — sorted in memory (lesson from the
// timeline regression). All reads/writes are best-effort; monitoring must never
// break a request path.
// ─────────────────────────────────────────────────────────────────
import { getStore } from '@/lib/store/adapter'
import type { AlertKind, AlertSeverity } from './diff'

const ALERTS = 'ts_alerts'

export interface MonitorAlert {
  id: string
  accountId: string
  domain: string
  kind: AlertKind | 'reverify_due'
  severity: AlertSeverity
  detail: string
  from?: string
  to?: string
  createdAt: number
  read?: boolean // dismissed/seen by the owner (Monitoring UX)
}

/** Write an alert (idempotent per domain+kind+day so a daily scan won't duplicate). New alerts are unread. */
export async function writeAlert(a: Omit<MonitorAlert, 'id'>): Promise<void> {
  const day = new Date(a.createdAt).toISOString().slice(0, 10)
  const id = `${a.accountId}__${a.domain}__${a.kind}__${day}`
  try {
    await getStore().set<MonitorAlert>(ALERTS, id, { ...a, id, read: false })
  } catch { /* best-effort */ }
}

/** All alerts for an account, NEWEST-first (capped). Equality-only query. */
export async function readAlerts(accountId: string, limit = 100): Promise<MonitorAlert[]> {
  try {
    const rows = await getStore().query<MonitorAlert>(ALERTS, {
      where: [{ field: 'accountId', op: '==', value: accountId }],
    })
    return rows.map((r) => r.data).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit)
  } catch {
    return []
  }
}

/** Mark one alert read (owner-scoped: the id is namespaced by accountId, re-checked). */
export async function markAlertRead(accountId: string, alertId: string): Promise<boolean> {
  if (!alertId.startsWith(`${accountId}__`)) return false // ownership guard
  try { await getStore().update<MonitorAlert>(ALERTS, alertId, { read: true }); return true } catch { return false }
}

/** Mark every alert for an account read. Returns the count updated. */
export async function markAllAlertsRead(accountId: string): Promise<number> {
  try {
    const rows = await getStore().query<MonitorAlert>(ALERTS, { where: [{ field: 'accountId', op: '==', value: accountId }] })
    let n = 0
    for (const r of rows) if (!r.data.read) { await getStore().update<MonitorAlert>(ALERTS, r.id, { read: true }); n++ }
    return n
  } catch { return 0 }
}
