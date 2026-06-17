// ─────────────────────────────────────────────────────────────────
// lib/trustseal/analytics.ts  (asq-trustseal-revenue)
// READ-ONLY platform analytics — aggregates from existing collections without
// touching the completed verification / certificate / API / monitoring / billing
// code. No event counters, no schema changes: counts are derived from stored
// state. Admin/ops surface (guarded by the cron secret).
// ─────────────────────────────────────────────────────────────────
import { getStore } from '@/lib/store/adapter'
import { usagePeriod } from '@/lib/trustseal/quota'

export interface PlatformAnalytics {
  generatedAt: number
  period: string
  domainsVerified: number
  certificatesAvailable: number // 1 per verified domain (downloadable on demand)
  apiKeysProvisioned: number    // every account has a deterministic key
  apiRequestsThisMonth: number
  monitoringAlerts: { total: number; critical: number; warning: number; info: number }
  subscriptions: { pro: number; business: number; totalPaid: number }
}

async function safeQuery<T extends object>(collection: string, limit = 5000): Promise<{ id: string; data: T }[]> {
  try { return await getStore().query<T>(collection, { limit }) } catch { return [] }
}

export async function getPlatformAnalytics(now = Date.now()): Promise<PlatformAnalytics> {
  const period = usagePeriod(now)
  const [claims, subs, alerts, usage, accounts] = await Promise.all([
    safeQuery<{ status?: string }>('ts_claims'),
    safeQuery<{ status?: string; plan?: string }>('ts_subscriptions'),
    safeQuery<{ severity?: string }>('ts_alerts'),
    safeQuery<{ count?: number }>('ts_api_usage'),
    safeQuery<object>('ts_accounts'),
  ])

  const domainsVerified = claims.filter((c) => c.data.status === 'verified').length
  const paid = subs.filter((s) => s.data.status === 'active' || s.data.status === 'past_due')
  const pro = paid.filter((s) => s.data.plan === 'pro').length
  const business = paid.filter((s) => s.data.plan === 'business').length
  const sev = (k: string) => alerts.filter((a) => a.data.severity === k).length
  const apiRequestsThisMonth = usage
    .filter((u) => u.id.endsWith(`__${period}`))
    .reduce((n, u) => n + (u.data.count ?? 0), 0)

  return {
    generatedAt: now,
    period,
    domainsVerified,
    certificatesAvailable: domainsVerified,
    apiKeysProvisioned: accounts.length,
    apiRequestsThisMonth,
    monitoringAlerts: { total: alerts.length, critical: sev('critical'), warning: sev('warning'), info: sev('info') },
    subscriptions: { pro, business, totalPaid: pro + business },
  }
}
