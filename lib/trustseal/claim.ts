// ─────────────────────────────────────────────────────────────────
// lib/trustseal/claim.ts  (asq-trustseal-pr2)
// DNS domain-claim IO orchestration. A business proves control of a domain by
// adding a TXT record (apex `trustseal-verify=<token>`, or `_trustseal.<domain>`
// as a fallback); the first account to verify OWNS it, and verified ownership is
// immutable by other accounts (ownership-stealing → 409). Single ts_claims
// collection, doc id = clm_<sha1(canonical)> (one record per domain).
// Pure decisions live in claim-policy.ts; this file does the store + DNS + audit.
// ─────────────────────────────────────────────────────────────────
import { resolveTxt } from 'node:dns/promises'
import { getStore } from '@/lib/store/adapter'
import { normalizeDomain } from '@/lib/trustseal/verify/normalize'
import { audit } from '@/lib/ai/audit'
import {
  claimDocId, mintToken, expectedRecords, txtMatches,
  decideStart, decideVerify, type ClaimStatus,
} from './claim-policy'

export { expectedRecords } from './claim-policy'
export const CLAIMS = 'ts_claims'

export type ClaimMethod = 'dns'

export interface Claim {
  id: string // clm_<sha1(canonical)>
  domain: string // canonical eTLD+1
  accountId: string
  method: ClaimMethod
  token: string
  status: ClaimStatus
  createdAt: number
  verifiedAt?: number
  lastCheckedAt?: number
  attempts: number
}

export class ClaimError extends Error {
  code: string
  status: number
  constructor(code: string, status: number) {
    super(code)
    this.code = code
    this.status = status
    this.name = 'ClaimError'
  }
}

function canon(raw: string): string {
  const n = normalizeDomain(raw)
  if (!n) throw new ClaimError('invalid_domain', 400)
  return n.canonical
}

async function dnsHasToken(domain: string, token: string): Promise<boolean> {
  const flat = async (name: string) =>
    (await resolveTxt(name).catch(() => [] as string[][])).map((chunks) => chunks.join(''))
  const txts = [...(await flat(domain)), ...(await flat(`_trustseal.${domain}`))]
  return txtMatches(txts, token)
}

/** Start (or re-issue) a pending claim for the caller. Verified-by-another → 409. */
export async function startClaim(rawDomain: string, accountId: string, now = Date.now()): Promise<Claim> {
  const domain = canon(rawDomain)
  const id = claimDocId(domain)
  const store = getStore()
  const existing = (await store.get<Claim>(CLAIMS, id))?.data ?? null

  switch (decideStart(existing, accountId)) {
    case 'already_claimed':
      throw new ClaimError('already_claimed', 409)
    case 'already_verified_self':
    case 'reissue':
      return existing as Claim // idempotent: keep token + instructions
    case 'new': {
      const claim: Claim = {
        id, domain, accountId, method: 'dns',
        token: mintToken(), status: 'pending', createdAt: now, attempts: 0,
      }
      await store.set<Claim>(CLAIMS, id, claim)
      await audit({ action: 'claim.start', actor: `uid:${accountId}`, subject: domain, ok: true })
      return claim
    }
  }
}

/** Verify a pending claim by checking the domain's TXT records. Promotes to verified. */
export async function verifyClaim(rawDomain: string, accountId: string, now = Date.now()): Promise<Claim> {
  const domain = canon(rawDomain)
  const id = claimDocId(domain)
  const store = getStore()
  const existing = (await store.get<Claim>(CLAIMS, id))?.data ?? null

  switch (decideVerify(existing, accountId, now)) {
    case 'already_claimed':
      throw new ClaimError('already_claimed', 409)
    case 'no_claim':
      throw new ClaimError('no_claim', 404)
    case 'already_verified_self':
      return existing as Claim
    case 'expired': {
      await store.update<Claim>(CLAIMS, id, { status: 'failed', lastCheckedAt: now })
      await audit({ action: 'claim.failed', actor: `uid:${accountId}`, subject: domain, ok: false, message: 'token_expired' })
      throw new ClaimError('token_expired', 410)
    }
    case 'check_dns': {
      const claim = existing as Claim
      const attempts = claim.attempts + 1
      if (!(await dnsHasToken(domain, claim.token))) {
        await store.update<Claim>(CLAIMS, id, { lastCheckedAt: now, attempts })
        await audit({ action: 'claim.failed', actor: `uid:${accountId}`, subject: domain, ok: false, message: 'txt_not_found' })
        throw new ClaimError('txt_not_found', 422)
      }
      const verified: Claim = { ...claim, status: 'verified', verifiedAt: now, lastCheckedAt: now, attempts }
      await store.set<Claim>(CLAIMS, id, verified)
      await audit({ action: 'claim.verified', actor: `uid:${accountId}`, subject: domain, ok: true })
      return verified
    }
  }
}

/**
 * Hard-delete a NON-verified claim owned by the caller. Owner-only and
 * verified-protected: verified ownership can NEVER be deleted here (→ 409), and a
 * missing or not-owned claim is indistinguishable (→ 404, no existence leak). Hard
 * delete (not soft) is consistent with the deterministic doc id — removing a stale
 * pending/failed record lets the same domain be claimed fresh later.
 */
export async function removeClaim(rawDomain: string, accountId: string): Promise<{ domain: string; removed: true }> {
  const domain = canon(rawDomain)
  const id = claimDocId(domain)
  const store = getStore()
  const existing = (await store.get<Claim>(CLAIMS, id))?.data ?? null

  if (!existing || existing.accountId !== accountId) throw new ClaimError('no_claim', 404)
  if (existing.status === 'verified') throw new ClaimError('cannot_delete_verified', 409)

  await store.delete(CLAIMS, id)
  await audit({ action: 'claim.removed', actor: `uid:${accountId}`, subject: domain, ok: true })
  return { domain, removed: true }
}

/** The caller's own claim for a domain (null if none / owned by another). */
export async function getClaim(rawDomain: string, accountId: string): Promise<Claim | null> {
  const n = normalizeDomain(rawDomain)
  if (!n) return null
  const doc = await getStore().get<Claim>(CLAIMS, claimDocId(n.canonical))
  return doc && doc.data.accountId === accountId ? doc.data : null
}

/** All claims owned/attempted by an account, newest first. Needs the composite index. */
export async function listClaims(accountId: string): Promise<Claim[]> {
  const rows = await getStore().query<Claim>(CLAIMS, {
    where: [{ field: 'accountId', op: '==', value: accountId }],
    orderBy: { field: 'createdAt', dir: 'desc' },
    limit: 100,
  })
  return rows.map((r) => r.data)
}
