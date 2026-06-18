// ─────────────────────────────────────────────────────────────────
// lib/trustseal/rate-limit-store.ts  (asq-trustseal-hardening)
// Persistent, store-backed fixed-window rate limiter — a global counter (atomic
// increment) so the limit holds ACROSS serverless instances, unlike the in-memory
// limiter. Used for authenticated (keyed) Trust API requests, which are uncached
// and already do a store read/write, so the extra increment is in budget.
// Anonymous traffic stays on the in-memory limiter (it's CDN-cached anyway).
// Separate from the pure rate-limit.ts so its @/store import can't break tests.
// Fail-OPEN on store error (availability > strictness for a read API).
// ─────────────────────────────────────────────────────────────────
import { getStore } from '@/lib/store/adapter'
import type { RateLimitResult } from '@/lib/trustseal/rate-limit'

const BUCKETS = 'ts_rate_limits'

/** Global fixed-window limit via store.increment. windowMs default 60s. */
export async function storeRateLimit(key: string, limit = 60, windowMs = 60_000): Promise<RateLimitResult> {
  const now = Date.now()
  const windowStart = Math.floor(now / windowMs) * windowMs
  const bucket = `${key}__${windowStart}`
  try {
    const count = await getStore().increment(BUCKETS, bucket, 'count', 1)
    const resetAt = windowStart + windowMs
    return { ok: count <= limit, limit, remaining: Math.max(0, limit - count), resetAt }
  } catch {
    // Fail-open: a store hiccup must not 500 the public API.
    return { ok: true, limit, remaining: limit, resetAt: now + windowMs }
  }
}
