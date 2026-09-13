// ─────────────────────────────────────────────────────────────────
// lib/trustseal/command/types.ts
// Response shape of GET /api/trustseal/command/overview — the signed-in account's
// own Command Center data. Type-only (no runtime imports) so client components can
// use it without pulling in server modules.
//
// Deliberately minimal: no account ids, emails, tokens, API keys or alert ids.
// ─────────────────────────────────────────────────────────────────

export type CommandMode = 'live' | 'preview'

export interface CommandCategory { category: string; subScore: number; covered: boolean }
export interface CommandSignal { id: string; category: string; status: string; evidence?: string }

export interface CommandDomain {
  domain: string
  status: string // claim status: pending | verified | failed | revoked
  method: string
  claimedAt: number
  verifiedAt: number | null
  /** Latest stored verification (verified domains only; null if none recorded yet). */
  report: null | {
    band: string
    score: number
    confidence: number
    checkedAt: number
    partial: boolean
    categories: CommandCategory[]
    signals: CommandSignal[]
  }
  /** Certificates are generated on demand for verified domains — this is the stable id, not a stored record. */
  certificate: null | { id: string }
}

export interface CommandVerification { domain: string; checkedAt: number; band: string; score: number }

export interface CommandAlert {
  domain: string
  kind: string
  severity: 'info' | 'warning' | 'critical'
  detail: string
  from?: string
  to?: string
  createdAt: number
  read: boolean
}

export interface CommandRiskSignal { domain: string; id: string; category: string; status: string; evidence?: string }

export type CommandEventKind = 'claim_started' | 'verified' | 'reverified' | 'band' | 'score' | 'ssl' | 'dns' | 'alert'

export interface CommandTimelineEvent {
  at: number
  domain: string
  kind: CommandEventKind
  from?: string
  to?: string
  severity?: string
  detail?: string
}

export interface CommandOverview {
  mode: CommandMode
  generatedAt: number
  entitlement: {
    plan: string
    status: string
    active: boolean
    inGrace: boolean
    currentEnd: number | null
    monitoring: boolean
    maxDomains: number
  }
  summary: {
    verifiedDomains: number
    pendingClaims: number
    certificatesAvailable: number
    monitoredDomains: number
    alerts: { total: number; unread: number; critical: number; warning: number; info: number }
    lastCheckedAt: number | null
  }
  domains: CommandDomain[]
  verifications: CommandVerification[]
  risk: { alerts: CommandAlert[]; signals: CommandRiskSignal[] }
  network: { domain: string; band: string; score: number; checkedAt: number; categories: CommandCategory[] }[]
  timeline: CommandTimelineEvent[]
}
