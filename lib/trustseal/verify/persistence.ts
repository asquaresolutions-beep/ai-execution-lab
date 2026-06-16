// ─────────────────────────────────────────────────────────────────
// lib/trustseal/verify/persistence.ts  (asq-trustseal-c1c)
// Firestore-shaped persistence for verification results + history, via the shared
// store adapter (MemoryStore in dev/tests, FirestoreStore in prod).
//   • ts_verifications        — one envelope per domain (the result cache; doc id = vs_<sha1>)
//   • ts_verification_history — per-signal snapshots for monitoring/diffing (C1D+)
// Implements: asymmetric TTL (via policy.resultTtlSeconds), single-flight WRITE
// guard (never clobber a newer doc with a staler compute), and history retention.
// ─────────────────────────────────────────────────────────────────
import { getStore } from '@/lib/store/adapter'
import { SIGNAL_SCHEMA_VERSION, WEIGHTS_VERSION } from './score'
import { isReusable, resultTtlSeconds, selectHistoryToPrune, HISTORY_MAX_AGE_MS, type HistoryRow } from './policy'
import type { VerifyResult, VerifyBand } from './types'

export const VERIFICATIONS = 'ts_verifications'
export const HISTORY = 'ts_verification_history'

export interface VerificationEnvelope {
  id: string
  domain: string
  band: VerifyBand
  checkedAt: number
  expiresAt: number
  signalSchemaVersion: string
  weightsVersion: string
  result: VerifyResult
}

interface HistorySnapshot {
  domain: string
  verificationId: string
  checkedAt: number
  band: VerifyBand
  score: number
  confidence: number
  opacity: boolean
  signalSchemaVersion: string
  weightsVersion: string
  // per-signal values + statuses (freeze §8 — diffing needs more than the score)
  signals: { id: string; category: string; status: string; value: unknown }[]
  expiresAt: number // 180d history TTL (Firestore TTL policy on this field)
}

/** Raw envelope (no freshness gating) — for the public report endpoint. */
export async function readEnvelope(id: string): Promise<VerificationEnvelope | null> {
  const doc = await getStore().get<VerificationEnvelope>(VERIFICATIONS, id)
  return doc ? doc.data : null
}

/** Gated read for the result cache: returns the result only if fresh AND current-engine. */
export async function readVerification(id: string, now: number): Promise<VerifyResult | null> {
  const env = await readEnvelope(id)
  if (!env) return null
  return isReusable(env, SIGNAL_SCHEMA_VERSION, WEIGHTS_VERSION, now) ? env.result : null
}

/**
 * Persist a verification. Single-flight WRITE guard: if an equal-or-newer doc from
 * the SAME engine already exists, skip the write (a concurrent run already wrote a
 * result at least as fresh — avoid hot-doc contention). A newer engine version
 * always overwrites (silent re-baseline). Appends a history snapshot + prunes.
 */
export async function writeVerification(result: VerifyResult, now: number): Promise<void> {
  const id = result.id
  const ttl = resultTtlSeconds(result.band)
  const expiresAt = result.checkedAt + ttl * 1000

  const existing = await readEnvelope(id)
  if (existing) {
    const sameEngine =
      existing.signalSchemaVersion === result.signalSchemaVersion &&
      existing.weightsVersion === result.weightsVersion
    if (sameEngine && existing.checkedAt >= result.checkedAt) return // newer/equal already persisted
  }

  const envelope: VerificationEnvelope = {
    id,
    domain: result.domain,
    band: result.band,
    checkedAt: result.checkedAt,
    expiresAt,
    signalSchemaVersion: result.signalSchemaVersion,
    weightsVersion: result.weightsVersion,
    result: { ...result, ttlSeconds: ttl },
  }
  await getStore().set<VerificationEnvelope>(VERIFICATIONS, id, envelope)
  await appendHistory(result)
  await pruneHistory(result.domain, now)
}

async function appendHistory(result: VerifyResult): Promise<void> {
  const snapshot: HistorySnapshot = {
    domain: result.domain,
    verificationId: result.id,
    checkedAt: result.checkedAt,
    band: result.band,
    score: result.score,
    confidence: result.confidence,
    opacity: result.opacity,
    signalSchemaVersion: result.signalSchemaVersion,
    weightsVersion: result.weightsVersion,
    signals: result.signals.map((s) => ({ id: s.id, category: s.category, status: s.status, value: s.value ?? null })),
    expiresAt: result.checkedAt + HISTORY_MAX_AGE_MS,
  }
  // Doc id = <vid>__<checkedAt> → idempotent per (domain, instant): a duplicate
  // verify at the same checkedAt overwrites rather than double-appending.
  await getStore().set<HistorySnapshot>(HISTORY, `${result.id}__${result.checkedAt}`, snapshot)
}

/** Apply the retention policy (freeze §9). Returns the number of rows pruned. */
export async function pruneHistory(domain: string, now: number): Promise<number> {
  const rows = await getStore().query<HistorySnapshot>(HISTORY, {
    where: [{ field: 'domain', op: '==', value: domain }],
    orderBy: { field: 'checkedAt', dir: 'desc' },
  })
  const hist: HistoryRow[] = rows.map((r) => ({ id: r.id, checkedAt: r.data.checkedAt, band: r.data.band }))
  const toDelete = selectHistoryToPrune(hist, now)
  for (const id of toDelete) await getStore().delete(HISTORY, id)
  return toDelete.length
}

/** Public history projection for the trust timeline (no caller input, no internals). */
export interface PublicHistoryRow {
  checkedAt: number
  band: VerifyBand
  score: number
  signals: { id: string; status: string }[]
}

/**
 * Read a domain's verification-history snapshots, OLDEST-first, for the public
 * trust timeline. Store reads only (no outbound) — safe on the public seal page.
 */
export async function readVerificationHistory(domain: string): Promise<PublicHistoryRow[]> {
  // Equality-only query (no orderBy) so it needs NO composite index — sort in
  // memory. A where+orderBy on different fields would require a (domain, checkedAt)
  // composite index that isn't provisioned, which would throw on the public page.
  const rows = await getStore().query<HistorySnapshot>(HISTORY, {
    where: [{ field: 'domain', op: '==', value: domain }],
  })
  return rows
    .map((r) => ({
      checkedAt: r.data.checkedAt,
      band: r.data.band,
      score: r.data.score,
      signals: (r.data.signals || []).map((s) => ({ id: s.id, status: s.status })),
    }))
    .sort((a, b) => a.checkedAt - b.checkedAt) // oldest-first
}

/**
 * Purge the cached result for a domain (freeze §7 — a negative monitoring event,
 * e.g. a fresh blocklist hit, must invalidate a previously-good cached score).
 * History is retained. Exposed as a primitive for the C1D monitoring loop.
 */
export async function purgeVerification(id: string): Promise<void> {
  await getStore().delete(VERIFICATIONS, id)
}
