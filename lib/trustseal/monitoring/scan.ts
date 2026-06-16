// ─────────────────────────────────────────────────────────────────
// lib/trustseal/monitoring/scan.ts  (asq-trustseal-phase5)
// The monitoring engine: re-verifies the verified domains of monitoring-entitled
// (Business/Pro) accounts, diffs the result against the prior snapshot, and writes
// alerts + emails a digest on material changes. Invoked by the daily cron. Reuses
// the existing verify engine (forceRefresh) — which already appends the history
// the public timeline reads. Bounded per run for the serverless time budget.
// ─────────────────────────────────────────────────────────────────
import { getStore } from '@/lib/store/adapter'
import { getVerification } from '@/lib/trustseal/verify/service'
import { readVerificationHistory } from '@/lib/trustseal/verify/persistence'
import { getEntitlement } from '@/lib/billing/entitlement'
import { diffSnapshot, type MonSnapshot, type AlertEvent } from './diff'
import { writeAlert } from './alerts'
import { emailConfigured, sendListEmail } from '@/lib/email/notify'

const CLAIMS = 'ts_claims'
const ACCOUNTS = 'ts_accounts'
const MAX_DOMAINS = 25            // per-run cap (serverless budget)
const RECHECK_AFTER_MS = 20 * 60 * 60 * 1000 // re-verify if last check older than 20h
const REVERIFY_DUE_MS = 90 * 86_400_000      // verification-expiry window (matches the certificate)

interface StoredClaim { domain: string; accountId: string; status: string; verifiedAt?: number; lastCheckedAt?: number }

export interface ScanResult { scanned: number; reverified: number; alerts: number; emailed: number; skipped: number }

/** Run one monitoring pass. Best-effort throughout; never throws. */
export async function runMonitoringScan(now = Date.now()): Promise<ScanResult> {
  const res: ScanResult = { scanned: 0, reverified: 0, alerts: 0, emailed: 0, skipped: 0 }
  let claims: StoredClaim[] = []
  try {
    const rows = await getStore().query<StoredClaim>(CLAIMS, { where: [{ field: 'status', op: '==', value: 'verified' }] })
    claims = rows.map((r) => r.data)
  } catch { return res }

  // Resolve monitoring entitlement once per account (cache).
  const entitled = new Map<string, boolean>()
  const isEntitled = async (accountId: string): Promise<boolean> => {
    if (entitled.has(accountId)) return entitled.get(accountId)!
    let ok = false
    try { ok = (await getEntitlement(accountId)).features.monitoring === true } catch { ok = false }
    entitled.set(accountId, ok)
    return ok
  }

  const accountAlerts = new Map<string, { domain: string; ev: AlertEvent }[]>()

  for (const c of claims) {
    if (res.reverified >= MAX_DOMAINS) break
    if (!c.domain || !c.accountId) continue
    if (!(await isEntitled(c.accountId))) { res.skipped++; continue }
    res.scanned++

    // Only re-verify when due (bounds outbound work + cost).
    const due = !c.lastCheckedAt || now - c.lastCheckedAt > RECHECK_AFTER_MS
    if (!due) continue

    // Snapshot BEFORE the re-verify (latest existing history row).
    let before: MonSnapshot | null = null
    try {
      const hist = await readVerificationHistory(c.domain)
      const last = hist[hist.length - 1]
      if (last) before = { band: last.band, score: last.score, signals: last.signals }
    } catch { /* no prior history */ }

    // Force a fresh verification (re-checks DNS/SSL/reputation; appends history).
    try {
      await getVerification(c.domain, { forceRefresh: true, now })
      res.reverified++
    } catch { continue }

    // Snapshot AFTER, diff against before.
    let after: MonSnapshot | null = null
    try {
      const hist = await readVerificationHistory(c.domain)
      const last = hist[hist.length - 1]
      if (last) after = { band: last.band, score: last.score, signals: last.signals }
    } catch { /* skip */ }

    const events: AlertEvent[] = before && after ? diffSnapshot(before, after) : []
    // Verification-expiry (time-based) alert.
    if (c.verifiedAt && now - (c.lastCheckedAt ?? c.verifiedAt) > REVERIFY_DUE_MS) {
      events.push({ kind: 'reverify_due', severity: 'warning', detail: 'Verification is overdue for re-check.' })
    }

    for (const ev of events) {
      await writeAlert({ accountId: c.accountId, domain: c.domain, kind: ev.kind, severity: ev.severity, detail: ev.detail, from: ev.from, to: ev.to, createdAt: now })
      res.alerts++
      const list = accountAlerts.get(c.accountId) ?? []
      list.push({ domain: c.domain, ev })
      accountAlerts.set(c.accountId, list)
    }
  }

  // Email a digest per account on warning/critical alerts (best-effort, graceful).
  if (emailConfigured()) {
    for (const [accountId, list] of accountAlerts) {
      const material = list.filter((a) => a.ev.severity !== 'info')
      if (material.length === 0) continue
      let email = ''
      try { const acc = await getStore().get<{ email: string }>(ACCOUNTS, accountId); email = acc?.data?.email || '' } catch { /* */ }
      if (!email) continue
      const rows = material.map((a) => `<li><strong>${a.domain}</strong>: ${a.ev.detail}</li>`).join('')
      const r = await sendListEmail({
        to: email,
        subject: `TrustSeal monitoring: ${material.length} alert(s)`,
        title: 'TrustSeal monitoring alerts',
        bodyHtml: `<p>We detected changes on your verified domain(s):</p><ul>${rows}</ul><p>View details in your TrustSeal dashboard.</p>`,
      })
      if (r.ok) res.emailed++
    }
  }

  return res
}
