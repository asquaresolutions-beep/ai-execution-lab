// ─────────────────────────────────────────────────────────────────
// lib/credits/server-credits.ts
// Authoritative server-side credit enforcement. Counters live in the
// DocumentStore (Firestore when configured; atomic `increment`). Doc IDs
// include the local day, so credits reset automatically each day with no cron
// (Hobby-friendly). This is the source of truth — the client cannot bypass it.
// ─────────────────────────────────────────────────────────────────

import { getStore } from '@/lib/store/adapter'
import { SCAN_COST, quotaFor, dayKey, nextResetISO, type ScanType } from './credits'

const COLLECTION = '_credits'
function docId(subject: string, day: string): string {
  return `${subject.replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, 120)}__${day}`
}

export interface CreditState { used: number; remaining: number; quota: number; resetsAt: string; loggedIn: boolean }

/** Read current credit state (no spend). */
export async function getCreditState(subject: string, loggedIn: boolean): Promise<CreditState> {
  const quota = quotaFor(loggedIn)
  let used = 0
  try {
    const doc = await getStore().get<{ used?: number }>(COLLECTION, docId(subject, dayKey()))
    used = Number(doc?.data?.used ?? 0)
  } catch { /* store unavailable → treat as fresh */ }
  return { used, remaining: Math.max(0, quota - used), quota, resetsAt: nextResetISO(), loggedIn }
}

/**
 * Atomically consume credits for a scan. Increments first, then refunds if the
 * new total exceeds the quota (standard atomic-counter pattern) so concurrent
 * requests can't over-spend.
 */
export async function consumeCredits(subject: string, type: ScanType, loggedIn: boolean, opts: { failOpenOnError?: boolean } = {}): Promise<{ ok: boolean; transient?: boolean } & CreditState> {
  const quota = quotaFor(loggedIn)
  const cost = SCAN_COST[type]
  const id = docId(subject, dayKey())
  const store = getStore()
  let newUsed: number
  try {
    newUsed = await store.increment(COLLECTION, id, 'used', cost)
  } catch {
    // H2: expensive/AI callers opt into fail-CLOSED — never run an unmetered
    // paid scan when the credit write fails. `transient:true` lets the route
    // return a retryable 503 (not a hard "out of credits").
    if (opts.failOpenOnError === false) {
      return { ok: false, transient: true, used: 0, remaining: 0, quota, resetsAt: nextResetISO(), loggedIn }
    }
    // Default (free, deterministic text scans): fail OPEN for availability —
    // never hard-block a zero-cost scan on infra error; report best-effort state.
    return { ok: true, used: cost, remaining: Math.max(0, quota - cost), quota, resetsAt: nextResetISO(), loggedIn }
  }
  if (newUsed > quota) {
    await store.increment(COLLECTION, id, 'used', -cost).catch(() => {}) // refund
    return { ok: false, used: quota, remaining: 0, quota, resetsAt: nextResetISO(), loggedIn }
  }
  if (newUsed === cost) await store.update(COLLECTION, id, { subject, day: dayKey() }).catch(() => {})
  return { ok: true, used: newUsed, remaining: Math.max(0, quota - newUsed), quota, resetsAt: nextResetISO(), loggedIn }
}
