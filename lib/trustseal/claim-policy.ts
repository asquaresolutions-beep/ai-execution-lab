// ─────────────────────────────────────────────────────────────────
// lib/trustseal/claim-policy.ts  (asq-trustseal-pr2)
// PURE claim-policy core — doc id, token, expected DNS records, TXT matching,
// and the ownership/state decision machine. No @/ imports (only node:crypto) so
// it loads under `node --experimental-strip-types` and is unit-tested standalone.
// All IO (store reads/writes, DNS lookups, audit) lives in claim.ts.
// ─────────────────────────────────────────────────────────────────
import { createHash, randomBytes } from 'node:crypto'

export type ClaimStatus = 'pending' | 'verified' | 'failed' | 'revoked'

/** Minimal shape the decision functions need (full record lives in claim.ts). */
export interface ClaimLike {
  accountId: string
  status: ClaimStatus
  createdAt: number
  token: string
  verifiedAt?: number
}

export const TXT_PREFIX = 'trustseal-verify='
export const PENDING_TTL_MS = 7 * 86_400_000 // pending claims expire after 7 days

/** Deterministic, domain-keyed claim doc id (one ownership record per domain). */
export function claimDocId(canonical: string): string {
  return 'clm_' + createHash('sha1').update(canonical).digest('hex').slice(0, 32)
}

/** High-entropy challenge token (48 hex chars). */
export function mintToken(): string {
  return randomBytes(24).toString('hex')
}

/** The DNS TXT records a claimant may add to prove control — apex + fallback. */
export function expectedRecords(domain: string, token: string) {
  const value = `${TXT_PREFIX}${token}`
  return {
    value,
    primary: { type: 'TXT' as const, name: domain, value },
    fallback: { type: 'TXT' as const, name: `_trustseal.${domain}`, value },
  }
}

/** Does any resolved (already-flattened) TXT string satisfy the challenge? */
export function txtMatches(txts: string[], token: string): boolean {
  const want = `${TXT_PREFIX}${token}`
  return txts.some((t) => t.trim() === want)
}

// ── Ownership / state decisions (the security-critical core) ──────
export type StartDecision = 'new' | 'reissue' | 'already_verified_self' | 'already_claimed'

/** Verified ownership by ANOTHER account is immutable → 'already_claimed' (409). */
export function decideStart(existing: ClaimLike | null, caller: string): StartDecision {
  if (!existing) return 'new'
  if (existing.status === 'verified') {
    return existing.accountId === caller ? 'already_verified_self' : 'already_claimed'
  }
  if (existing.accountId === caller && existing.status === 'pending') return 'reissue'
  return 'new' // pending by someone else (not verified) → caller may take a fresh pending
}

export type VerifyDecision = 'check_dns' | 'already_verified_self' | 'already_claimed' | 'no_claim' | 'expired'

/** Ownership-stealing guard: a domain verified by another account → 'already_claimed' (409). */
export function decideVerify(existing: ClaimLike | null, caller: string, now: number): VerifyDecision {
  if (!existing) return 'no_claim'
  if (existing.status === 'verified') {
    return existing.accountId === caller ? 'already_verified_self' : 'already_claimed'
  }
  if (existing.accountId !== caller) return 'no_claim' // pending by another → caller has no claim here
  if (now - existing.createdAt > PENDING_TTL_MS) return 'expired'
  return 'check_dns'
}
