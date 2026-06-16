// ─────────────────────────────────────────────────────────────────
// lib/trustseal/monitoring/diff.ts  (asq-trustseal-phase5)
// PURE diff of two verification snapshots → monitoring alert events. No imports →
// unit-testable. The scan persists the alerts; this only decides what changed:
// trust-level (band) up/down, score drops, SSL changes, DNS changes. Verification-
// expiry (reverify-due) is time-based and computed in the scan, not here.
// ─────────────────────────────────────────────────────────────────
export interface MonSnapshot {
  band: string
  score: number
  signals: { id: string; status: string }[]
}

export type AlertKind = 'band_down' | 'band_up' | 'score_drop' | 'ssl_changed' | 'dns_changed' | 'reverify_due'
export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface AlertEvent {
  kind: AlertKind
  severity: AlertSeverity
  from?: string
  to?: string
  detail: string
}

// Higher = more trustworthy.
const BAND_RANK: Record<string, number> = { verified: 5, established: 4, limited: 3, caution: 2, high_risk: 1 }
const SCORE_DROP_THRESHOLD = 10

const status = (s: MonSnapshot, id: string): string | undefined => s.signals.find((x) => x.id === id)?.status
const ok = (st: string | undefined) => st === 'ok' || st === 'pass'

/** Compare the previous snapshot to the current one and emit alert events. */
export function diffSnapshot(prev: MonSnapshot, cur: MonSnapshot): AlertEvent[] {
  const out: AlertEvent[] = []

  // Trust-level (band) transition
  if (cur.band !== prev.band) {
    const pr = BAND_RANK[prev.band] ?? 0, cr = BAND_RANK[cur.band] ?? 0
    if (cr < pr) out.push({ kind: 'band_down', severity: cr <= 2 ? 'critical' : 'warning', from: prev.band, to: cur.band, detail: `Trust level dropped from ${prev.band} to ${cur.band}` })
    else out.push({ kind: 'band_up', severity: 'info', from: prev.band, to: cur.band, detail: `Trust level improved from ${prev.band} to ${cur.band}` })
  } else if (cur.score - prev.score <= -SCORE_DROP_THRESHOLD) {
    // Only flag a score drop when the band held (a band change already says more).
    out.push({ kind: 'score_drop', severity: 'warning', from: String(prev.score), to: String(cur.score), detail: `Trust score dropped ${prev.score} → ${cur.score}` })
  }

  // SSL validity transition
  const sslPrev = status(prev, 'ssl.valid'), sslCur = status(cur, 'ssl.valid')
  if (sslPrev != null && sslCur != null && sslPrev !== sslCur) {
    const broke = ok(sslPrev) && !ok(sslCur)
    out.push({ kind: 'ssl_changed', severity: broke ? 'critical' : 'info', from: sslPrev, to: sslCur, detail: broke ? 'SSL certificate is no longer valid' : `SSL status changed (${sslPrev} → ${sslCur})` })
  }

  // DNS transition (resolution or mail)
  for (const id of ['dns.resolves', 'dns.mx'] as const) {
    const p = status(prev, id), c = status(cur, id)
    if (p != null && c != null && p !== c) {
      const broke = ok(p) && !ok(c)
      out.push({ kind: 'dns_changed', severity: broke ? 'warning' : 'info', from: p, to: c, detail: `${id} changed (${p} → ${c})` })
    }
  }

  return out
}

export const ALERT_RANK: Record<AlertSeverity, number> = { critical: 3, warning: 2, info: 1 }
