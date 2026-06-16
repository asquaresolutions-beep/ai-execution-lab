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
}

/** Write an alert (idempotent per domain+kind+day so a daily scan won't duplicate). */
export async function writeAlert(a: Omit<MonitorAlert, 'id'>): Promise<void> {
  const day = new Date(a.createdAt).toISOString().slice(0, 10)
  const id = `${a.accountId}__${a.domain}__${a.kind}__${day}`
  try {
    await getStore().set<MonitorAlert>(ALERTS, id, { ...a, id })
  } catch { /* best-effort */ }
}

/** Recent alerts for an account, NEWEST-first (capped). Equality-only query. */
export async function readAlerts(accountId: string, limit = 50): Promise<MonitorAlert[]> {
  try {
    const rows = await getStore().query<MonitorAlert>(ALERTS, {
      where: [{ field: 'accountId', op: '==', value: accountId }],
    })
    return rows.map((r) => r.data).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit)
  } catch {
    return []
  }
}
