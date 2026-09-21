// ─────────────────────────────────────────────────────────────────
// lib/trustseal/monitoring/reverify-due.ts
// PURE verification-expiry rule for the monitoring scan. No imports → unit-testable.
//
// "Overdue" is measured from the latest SUCCESSFUL monitoring re-verification
// (ts_verification_history / ts_verifications checkedAt). It deliberately does NOT
// take ts_claims.lastCheckedAt: that field records the DNS-ownership (TXT) check,
// which the monitoring re-verification never advances — reading it here made every
// domain "overdue" 90 days after its claim even while it was re-verified daily.
// ─────────────────────────────────────────────────────────────────

/** Verification-expiry window (matches the certificate's 90-day reverification cadence). */
export const REVERIFY_DUE_MS = 90 * 86_400_000

/** A usable verification timestamp: a finite epoch-ms number (rejects NaN, ±Infinity, strings, null). */
export const isTimestamp = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export interface ExpiryBasis {
  /** False when this run cannot tell when the last successful verification was → skip the overdue check. */
  known: boolean
  /** Latest successful verification time; null = none recorded (only meaningful when known). */
  lastVerifiedAt: number | null
  /** History rows whose checkedAt is not a valid timestamp (never used in the calculation). */
  malformed: number
}

/**
 * What the expiry rule may rely on this run.
 *  • A successful re-verification this run is authoritative → known (latest of it and valid history).
 *  • Otherwise the history must be readable (null = read failed) and free of malformed
 *    timestamps (a bad row could hide the real latest success) — else unknown.
 *  • Readable history with no rows → known, no successful verification recorded.
 */
export function resolveExpiryBasis(reverifiedAt: number | null, historyCheckedAt: readonly unknown[] | null): ExpiryBasis {
  const valid = (historyCheckedAt ?? []).filter(isTimestamp)
  const malformed = historyCheckedAt ? historyCheckedAt.length - valid.length : 0
  const latest = valid.length ? Math.max(...valid) : null
  if (isTimestamp(reverifiedAt)) return { known: true, lastVerifiedAt: latest == null ? reverifiedAt : Math.max(reverifiedAt, latest), malformed }
  if (historyCheckedAt == null || malformed > 0) return { known: false, lastVerifiedAt: null, malformed }
  return { known: true, lastVerifiedAt: latest, malformed }
}

export interface ReverifyDueInput {
  /** checkedAt of the latest successful verification of the domain, if any. */
  lastVerifiedAt: number | null | undefined
  /** ts_claims.verifiedAt — the initial ownership verification; the floor for newly claimed domains. */
  verifiedAt: number | null | undefined
  now: number
}

/** True when the domain's most recent successful verification is older than the window. */
export function isReverifyOverdue({ lastVerifiedAt, verifiedAt, now }: ReverifyDueInput, windowMs = REVERIFY_DUE_MS): boolean {
  if (!isTimestamp(verifiedAt) || !isTimestamp(now)) return false // not a (validly) verified domain → never overdue
  if (lastVerifiedAt != null && !isTimestamp(lastVerifiedAt)) return false // malformed → unknown, never guessed
  const base = lastVerifiedAt == null ? verifiedAt : Math.max(lastVerifiedAt, verifiedAt)
  return now - base > windowMs
}
