// ─────────────────────────────────────────────────────────────────
// lib/trustseal/seal-sign.ts  (asq-trustseal-pr5)
// HMAC-SHA256 signature over the public seal status — anti-forgery defense-in-depth
// + third-party verification. Secret in env (TRUSTSEAL_SEAL_SECRET); node:crypto only.
// PRODUCTION-SAFE: degrades gracefully when the secret is unset — signSeal() returns
// null and the badge still renders on live-status + origin-binding (the primary
// defenses), so a missing env var never breaks the widget.
// ─────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual } from 'node:crypto'

export const SEAL_SIG_VERSION = 'v1'
const SECRET = process.env.TRUSTSEAL_SEAL_SECRET || ''

export interface SealClaimParts { domain: string; status: string; issuedAt: number }

export function sealConfigured(): boolean { return !!SECRET }

function message(p: SealClaimParts): string {
  return `${SEAL_SIG_VERSION}|${p.domain}|${p.status}|${p.issuedAt}`
}

/** Domain-bound signature, or null if no secret configured (graceful degradation). */
export function signSeal(p: SealClaimParts): string | null {
  if (!SECRET) return null
  return `${SEAL_SIG_VERSION}.${createHmac('sha256', SECRET).update(message(p)).digest('hex')}`
}

/** Constant-time verification (for third parties / self-check). False if unsigned/unset. */
export function verifySeal(p: SealClaimParts, signature: string | null | undefined): boolean {
  if (!SECRET || !signature) return false
  const expected = signSeal(p)
  if (!expected) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}
