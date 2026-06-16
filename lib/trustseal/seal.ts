// ─────────────────────────────────────────────────────────────────
// lib/trustseal/seal.ts  (asq-trustseal-pr4)
// Public, read-only data layer for the seal page (/{locale}/trust/{domain}).
// SSRF-FREE BY CONSTRUCTION: it imports NO outbound-capable module (no node:dns,
// no verify engine, no fetch) — only Firestore doc-id reads via the store adapter:
//   • ts_claims        (clm_<sha1>)  — public verified-ownership gate
//   • ts_verifications (vs_<sha1>)   — the trust verdict, if one exists
// No auth: exposes only the public projection (domain, method, dates, verdict);
// never the claim's accountId/token.
// ─────────────────────────────────────────────────────────────────
import { getStore } from '@/lib/store/adapter'
import { normalizeDomain, verifyDocId } from '@/lib/trustseal/verify/normalize'
import { claimDocId } from '@/lib/trustseal/claim-policy'
import { readEnvelope, readVerificationHistory } from '@/lib/trustseal/verify/persistence'
import { publicReport, type PublicReport } from '@/lib/trustseal/verify/policy'
import { buildTimeline, type TimelineEvent } from '@/lib/trustseal/timeline'

// Mirrors claim.ts CLAIMS — declared locally so this module does NOT import
// claim.ts (which pulls in node:dns), keeping the seal page provably SSRF-free.
const CLAIMS = 'ts_claims'

interface StoredClaim {
  domain: string
  accountId: string
  method: string
  status: 'pending' | 'verified' | 'failed' | 'revoked'
  createdAt: number
  verifiedAt?: number
  lastCheckedAt?: number
}

export interface SealData {
  domain: string // canonical eTLD+1
  verified: true
  method: string
  verifiedAt: number
  createdAt: number
  lastCheckedAt: number | null
  /** The trust verdict (band/score/badges/signals), if a verification exists yet. */
  report: PublicReport | null
}

/** Public verified-ownership record for a domain (account/token NOT exposed). */
async function getPublicVerifiedClaim(canonical: string): Promise<StoredClaim | null> {
  const doc = await getStore().get<StoredClaim>(CLAIMS, claimDocId(canonical))
  if (!doc || doc.data.status !== 'verified') return null
  return doc.data
}

/**
 * SERVER-ONLY: the owning accountId for a verified domain, or null. Used for badge
 * entitlement enforcement (domain → account → Pro check). The accountId is NEVER
 * returned to clients — only the resulting boolean entitlement is exposed.
 */
export async function getVerifiedClaimAccountId(rawDomain: string): Promise<string | null> {
  const n = normalizeDomain(rawDomain)
  if (!n) return null
  const claim = await getPublicVerifiedClaim(n.canonical)
  return claim?.accountId ?? null
}

/**
 * Assemble the public seal data for a domain, or null when the domain has no
 * verified ownership claim (→ the page 404s). Pure Firestore reads by doc id.
 */
export async function getSealData(rawDomain: string): Promise<SealData | null> {
  const n = normalizeDomain(rawDomain)
  if (!n) return null

  const claim = await getPublicVerifiedClaim(n.canonical)
  if (!claim || claim.verifiedAt == null) return null

  const env = await readEnvelope(verifyDocId(n.canonical))
  const report = env ? publicReport(env.result) : null

  return {
    domain: n.canonical,
    verified: true,
    method: claim.method,
    verifiedAt: claim.verifiedAt,
    createdAt: claim.createdAt,
    lastCheckedAt: report?.checkedAt ?? claim.lastCheckedAt ?? null,
    report,
  }
}

/**
 * Public trust timeline for a verified domain (ownership + reverification /
 * band / score / SSL / DNS changes), NEWEST-first. Store reads only (SSRF-free).
 * Returns [] when the domain has no verified claim.
 */
export async function getSealTimeline(rawDomain: string): Promise<TimelineEvent[]> {
  const n = normalizeDomain(rawDomain)
  if (!n) return []
  const claim = await getPublicVerifiedClaim(n.canonical)
  if (!claim || claim.verifiedAt == null) return []
  const history = await readVerificationHistory(n.canonical)
  return buildTimeline(claim.verifiedAt, history)
}
