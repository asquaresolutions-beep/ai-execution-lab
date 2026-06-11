// ─────────────────────────────────────────────────────────────────
// lib/trustseal/verify/service.ts  (asq-trustseal-c1c)
// Cached + persisted verification entry point used by the API routes.
//   getVerification(): normalize → service single-flight → read-through cache →
//     verifyBusiness(MVP_COLLECTORS) → asymmetric-TTL stamp → persist → return.
//   getStoredReport(): read-only fetch of the latest persisted result (live seal).
// The service-level single-flight covers cache-read + compute + write (wider than
// verifyBusiness's inner collector dedupe), so concurrent callers share one run and
// one write.
// ─────────────────────────────────────────────────────────────────
import { verifyBusiness, InvalidDomainError, type VerifyOptions } from './verify'
import { normalizeDomain, verifyDocId } from './normalize'
import { MVP_COLLECTORS } from './registry'
import { readVerification, readEnvelope, writeVerification } from './persistence'
import { isReusable, resultTtlSeconds } from './policy'
import { SIGNAL_SCHEMA_VERSION, WEIGHTS_VERSION } from './score'
import type { VerifyResult } from './types'

export { InvalidDomainError }

export interface VerificationOutcome extends VerifyResult { fromCache: boolean }
export interface GetVerificationOptions extends VerifyOptions { forceRefresh?: boolean }

const inflight = new Map<string, Promise<VerificationOutcome>>()

export async function getVerification(rawDomain: string, opts: GetVerificationOptions = {}): Promise<VerificationOutcome> {
  const norm = normalizeDomain(rawDomain)
  if (!norm) throw new InvalidDomainError('invalid_domain')
  const tier = opts.tier ?? 'mvp'
  const key = `${norm.canonical}|${tier}|${opts.country ?? ''}`
  const existing = inflight.get(key)
  if (existing) return existing // service single-flight: share cache-read + compute + write

  const run = (async (): Promise<VerificationOutcome> => {
    const now = opts.now ?? Date.now()
    const id = verifyDocId(norm.canonical)

    if (!opts.forceRefresh) {
      const cached = await readVerification(id, now)
      if (cached) return { ...cached, fromCache: true }
    }

    const result = await verifyBusiness(rawDomain, { collectors: MVP_COLLECTORS }, { ...opts, now })
    // Asymmetric TTL by verdict overrides the engine's flat default.
    const stamped: VerifyResult = { ...result, ttlSeconds: resultTtlSeconds(result.band) }
    await writeVerification(stamped, now)
    return { ...stamped, fromCache: false }
  })()

  inflight.set(key, run)
  try { return await run } finally { inflight.delete(key) }
}

/** Latest persisted result for the public seal/report (no recompute). `stale` flags
 *  past-TTL or superseded-engine envelopes so the UI can show a "re-verify" hint. */
export async function getStoredReport(rawDomain: string, now = Date.now()): Promise<{ report: VerifyResult; stale: boolean } | null> {
  const norm = normalizeDomain(rawDomain)
  if (!norm) return null
  const env = await readEnvelope(verifyDocId(norm.canonical))
  if (!env) return null
  return { report: env.result, stale: !isReusable(env, SIGNAL_SCHEMA_VERSION, WEIGHTS_VERSION, now) }
}
