// ─────────────────────────────────────────────────────────────────
// lib/trustseal/verify/policy.ts  (asq-trustseal-c1c)
// PURE persistence-policy decisions: asymmetric result TTL, engine versioning /
// staleness, history retention selection, and the public report projection.
// Only `import type` → loadable under node --experimental-strip-types and unit
// tested independently of Firestore / the store adapter.
// ─────────────────────────────────────────────────────────────────
import type { VerifyResult, VerifyBand } from './types'

// ── Asymmetric result-cache TTL (freeze §7) ──────────────────────
// A RISK verdict is cached LONG (a bad domain rarely turns good quickly, and we
// save collector spend). A CLEAN verdict is cached SHORT so a freshly-weaponized
// "clean" domain cannot be masked by a stale good score. `limited` is treated as
// clean-side (uncertain → re-check soon).
export const RESULT_TTL_RISK_SECONDS = 86_400 // 24h — caution / high_risk
export const RESULT_TTL_CLEAN_SECONDS = 7_200 //  2h — verified / established / limited

export function resultTtlSeconds(band: VerifyBand): number {
  return band === 'high_risk' || band === 'caution' ? RESULT_TTL_RISK_SECONDS : RESULT_TTL_CLEAN_SECONDS
}

// ── Engine versioning / staleness (freeze §11) ───────────────────
export function engineVersion(signalSchemaVersion: string, weightsVersion: string): string {
  return `s${signalSchemaVersion}-w${weightsVersion}`
}

export function isExpired(expiresAt: number, now: number): boolean {
  return !(expiresAt > now)
}

export interface VersionedEnvelope { expiresAt: number; signalSchemaVersion: string; weightsVersion: string }

/** A cached result is reusable only if unexpired AND produced by the current engine. */
export function isReusable(env: VersionedEnvelope, curSignalV: string, curWeightsV: string, now: number): boolean {
  return !isExpired(env.expiresAt, now) && env.signalSchemaVersion === curSignalV && env.weightsVersion === curWeightsV
}

// ── History retention (freeze §9) ────────────────────────────────
export const HISTORY_MAX = 30
export const HISTORY_MAX_AGE_MS = 180 * 86_400_000 // 180 days

export interface HistoryRow { id: string; checkedAt: number; band: VerifyBand }

/**
 * Retention selection: keep the most-recent HISTORY_MAX snapshots and everything
 * within 180 days; rows beyond the recent window (or older than 180d) are
 * downsampled to band-change rows only — a row is retained iff its band differs
 * from the next-newer retained row. Returns the ids to DELETE.
 * `rows` MUST be sorted newest-first (checkedAt DESC).
 */
export function selectHistoryToPrune(rows: HistoryRow[], now: number): string[] {
  const del: string[] = []
  let kept = 0
  let lastKeptBand: VerifyBand | null = null
  for (const r of rows) {
    const tooOld = now - r.checkedAt > HISTORY_MAX_AGE_MS
    const isBandChange = r.band !== lastKeptBand // vs the previous (newer) retained row
    if (!tooOld && kept < HISTORY_MAX) {
      kept++; lastKeptBand = r.band            // inside the recent window: always keep
    } else if (isBandChange) {
      kept++; lastKeptBand = r.band            // older/overflow but a band transition: keep
    } else {
      del.push(r.id)                            // older/overflow and no transition: prune
    }
  }
  return del
}

// ── Public report projection ─────────────────────────────────────
// Omits the caller's own input (inputDomain / inputName / country) and internal
// scoring internals (baseScore / caps / opacity); exposes the verdict + the
// per-signal proof that backs it.
export interface PublicReport {
  domain: string
  band: VerifyBand
  score: number
  confidence: number
  badges: string[]
  tier: string
  partial: boolean
  checkedAt: number
  ttlSeconds: number
  signalSchemaVersion: string
  weightsVersion: string
  categories: { category: string; subScore: number; covered: boolean }[]
  signals: { id: string; category: string; status: string; value?: unknown; evidence?: string }[]
}

export function publicReport(r: VerifyResult): PublicReport {
  return {
    domain: r.domain,
    band: r.band,
    score: r.score,
    confidence: r.confidence,
    badges: r.badges,
    tier: r.tier,
    partial: r.partial,
    checkedAt: r.checkedAt,
    ttlSeconds: r.ttlSeconds,
    signalSchemaVersion: r.signalSchemaVersion,
    weightsVersion: r.weightsVersion,
    categories: r.categories.map((c) => ({ category: c.category, subScore: c.subScore, covered: c.covered })),
    signals: r.signals.map((s) => ({ id: s.id, category: s.category, status: s.status, value: s.value, evidence: s.evidence })),
  }
}
