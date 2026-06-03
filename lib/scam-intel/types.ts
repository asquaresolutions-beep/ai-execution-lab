// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/types.ts
// Types for the scam intelligence ingestion + moderation system.
// ─────────────────────────────────────────────────────────────────

export type ScamCategory =
  | 'phishing'
  | 'otp_fraud'
  | 'whatsapp_scam'
  | 'fake_job'
  | 'investment_fraud'
  | 'upi_fraud'
  | 'loan_scam'
  | 'lottery_prize'
  | 'tech_support'
  | 'romance'
  | 'courier_customs'
  | 'other'

export type Severity = 'low' | 'medium' | 'high' | 'critical'
export type ReportStatus = 'pending' | 'approved' | 'rejected' | 'duplicate' | 'spam'
export type ModerationVerdict = 'allow' | 'review' | 'block'

/** Raw inbound report (public form or API). */
export interface RawReport {
  text: string
  platform?: string
  region?: string
  reporterContactHint?: string  // never store raw PII; hashed/omitted downstream
  sourceUrl?: string
  submittedAt?: number
  ip?: string                   // used only to derive a hashed rate-limit key
}

/** Output of spam/abuse pre-filter. */
export interface SpamAssessment {
  isSpam: boolean
  score: number          // 0..1
  reasons: string[]
}

/** Output of AI classification. */
export interface Classification {
  category: ScamCategory
  confidence: number     // 0..1
  platform: string
  region: string
  tactics: string[]      // e.g. ["urgency", "impersonation", "fake link"]
  indicators: string[]   // observable signals: urls, phone patterns, etc.
  summary: string        // one-line neutral summary
}

/** AI / rule moderation result. */
export interface Moderation {
  verdict: ModerationVerdict
  toxic: boolean
  containsPII: boolean
  reasons: string[]
}

export interface SeverityScore {
  severity: Severity
  score: number          // 0..100
  factors: Record<string, number>
}

/** Persisted, processed report. */
export interface ScamReport {
  id: string
  text: string
  status: ReportStatus
  category: ScamCategory
  classification: Classification
  severity: SeverityScore
  moderation: Moderation
  spam: SpamAssessment
  clusterId: string | null
  isCanonical: boolean   // first/representative report of its cluster
  duplicateOf: string | null
  vector: number[]
  platform: string
  region: string
  createdAt: number
  updatedAt: number
  reporterHash: string | null
  metrics: { reportCount: number }  // de-duplicated count for the cluster
}

/** A cluster groups semantically-similar reports = one "scam pattern". */
export interface ScamCluster {
  id: string
  category: ScamCategory
  canonicalReportId: string
  title: string
  centroid: number[]
  reportCount: number
  severity: Severity
  platforms: string[]
  regions: string[]
  firstSeen: number
  lastSeen: number
  trendScore: number
}

export interface IngestResult {
  status: 'accepted' | 'duplicate' | 'spam' | 'blocked' | 'queued_for_review'
  reportId?: string
  clusterId?: string
  duplicateOf?: string
  classification?: Classification
  severity?: SeverityScore
  message: string
}

export interface TrendingItem {
  clusterId: string
  title: string
  category: ScamCategory
  reportCount: number
  severity: Severity
  trendScore: number
  velocity: number       // reports in trailing window
  platforms: string[]
  regions: string[]
  viral: boolean         // momentum spike → "viral" badge
  momentum: number       // 0..1 normalized growth signal
  lastSeen: number       // last report timestamp (freshness)
  active: boolean        // reported within the active window
}

export interface HeatmapCell {
  region: string
  category: ScamCategory
  count: number
  severityWeighted: number
}
