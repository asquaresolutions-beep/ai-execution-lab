// ─────────────────────────────────────────────────────────────────
// lib/trustseal/rate-limit.ts  (asq-trustseal-phase2)
// Lightweight in-memory fixed-window rate limiter for the public Trust API.
// Per-instance (serverless): each warm instance keeps its own window, so the
// effective global limit is higher than the per-instance limit — acceptable for
// a public read API whose data is also CDN-cacheable. For strict global limits,
// swap the counter for the store adapter's increment() on a per-minute bucket key.
// ─────────────────────────────────────────────────────────────────
interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  ok: boolean
  limit: number
  remaining: number
  resetAt: number // epoch ms
}

/** Fixed-window limit. Default: 60 requests / 60s per key (e.g. client IP). */
export function rateLimit(key: string, limit = 60, windowMs = 60_000): RateLimitResult {
  const now = Date.now()
  let b = buckets.get(key)
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs }
    buckets.set(key, b)
  }
  b.count++
  // Opportunistic cleanup so the map can't grow unbounded on a long-lived instance.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k)
  }
  const remaining = Math.max(0, limit - b.count)
  return { ok: b.count <= limit, limit, remaining, resetAt: b.resetAt }
}

/** Best-effort client IP from standard proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}
