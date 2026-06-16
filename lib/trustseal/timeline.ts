// ─────────────────────────────────────────────────────────────────
// lib/trustseal/timeline.ts  (asq-trustseal-phase3)
// PURE derivation of a public trust timeline from verification-history snapshots.
// No imports → unit-testable under node --experimental-strip-types. The store
// read lives in persistence.readVerificationHistory; this turns those snapshots
// into human events: initial verification, reverifications, trust-level (band)
// changes, score changes, and SSL / DNS signal changes.
// ─────────────────────────────────────────────────────────────────
export interface TimelineRow {
  checkedAt: number
  band: string
  score: number
  signals: { id: string; status: string }[]
}

export type TimelineKind = 'verified' | 'reverified' | 'band' | 'score' | 'ssl' | 'dns'

export interface TimelineEvent {
  at: number
  kind: TimelineKind
  from?: string
  to?: string
}

const sigStatus = (row: TimelineRow, id: string): string | undefined =>
  row.signals.find((s) => s.id === id)?.status

/**
 * Build the timeline (NEWEST-first for display). `verifiedAt` is the ownership
 * confirmation instant; `rows` are history snapshots OLDEST-first.
 */
export function buildTimeline(verifiedAt: number, rows: TimelineRow[]): TimelineEvent[] {
  const events: TimelineEvent[] = [{ at: verifiedAt, kind: 'verified' }]
  let prev: TimelineRow | null = null
  for (const row of rows) {
    if (!prev) {
      // first recorded snapshot — a reverification baseline (skip if it coincides
      // with the ownership instant to avoid a duplicate marker).
      if (Math.abs(row.checkedAt - verifiedAt) > 60_000) events.push({ at: row.checkedAt, kind: 'reverified', to: row.band })
    } else {
      if (row.band !== prev.band) events.push({ at: row.checkedAt, kind: 'band', from: prev.band, to: row.band })
      else if (row.score !== prev.score) events.push({ at: row.checkedAt, kind: 'score', from: String(prev.score), to: String(row.score) })
      const sslNow = sigStatus(row, 'ssl.valid'), sslPrev = sigStatus(prev, 'ssl.valid')
      if (sslNow && sslPrev && sslNow !== sslPrev) events.push({ at: row.checkedAt, kind: 'ssl', from: sslPrev, to: sslNow })
      const dnsNow = sigStatus(row, 'dns.resolves'), dnsPrev = sigStatus(prev, 'dns.resolves')
      if (dnsNow && dnsPrev && dnsNow !== dnsPrev) events.push({ at: row.checkedAt, kind: 'dns', from: dnsPrev, to: dnsNow })
    }
    prev = row
  }
  // newest-first for display
  return events.sort((a, b) => b.at - a.at)
}
