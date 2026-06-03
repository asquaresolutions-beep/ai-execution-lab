// ─────────────────────────────────────────────────────────────────
// lib/ai/cache.ts
// Content-addressed cache for AI generations. Keyed by a stable hash of
// (operation + inputs), so identical generation requests are free and
// instant. Persisted via the store with TTL. Cuts cost on retries,
// previews, and re-runs of the same scam input.
// ─────────────────────────────────────────────────────────────────

import { getStore } from '@/lib/store/adapter'
import { audit } from './audit'

const COLLECTION = '_ai_cache'
const DEFAULT_TTL_MS = 7 * 86_400_000 // 7 days

export interface CacheEntry<T> {
  key: string
  value: T
  createdAt: number
  expiresAt: number
  op: string
}

export function cacheKey(op: string, payload: unknown): string {
  return `${op}__${stableHash(payload)}`
}

export async function getCached<T>(key: string): Promise<T | null> {
  const doc = await getStore().get<CacheEntry<T>>(COLLECTION, key)
  if (!doc) return null
  if (doc.data.expiresAt < Date.now()) {
    await getStore().delete(COLLECTION, key)
    return null
  }
  return doc.data.value as T
}

export async function setCached<T>(
  key: string,
  op: string,
  value: T,
  ttlMs = DEFAULT_TTL_MS,
): Promise<void> {
  const now = Date.now()
  await getStore().set<CacheEntry<T>>(COLLECTION, key, {
    key, op, value, createdAt: now, expiresAt: now + ttlMs,
  })
}

/**
 * Wrap any async producer with read-through caching.
 *   const out = await cached('article', input, () => generateArticle(input))
 */
export async function cached<T>(
  op: string,
  payload: unknown,
  produce: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const key = cacheKey(op, payload)
  const hit = await getCached<T>(key)
  if (hit !== null) {
    await audit({ action: 'ai.cache_hit', actor: 'system', ok: true, message: op })
    return hit
  }
  const value = await produce()
  await setCached(key, op, value, ttlMs)
  return value
}

/**
 * Delete expired cache entries. Returns count removed. Called by the
 * stale-cache-cleanup cron. (On Firestore prefer a TTL policy on
 * `expiresAt`; this is the portable fallback + dev backend cleaner.)
 */
export async function cleanExpiredCache(limit = 1000): Promise<number> {
  const now = Date.now()
  const rows = await getStore().query<CacheEntry<unknown>>(COLLECTION, { limit })
  let removed = 0
  for (const r of rows) {
    if (r.data.expiresAt < now) {
      await getStore().delete(COLLECTION, r.id)
      removed++
    }
  }
  return removed
}

/** Delete expired fixed-window rate-limit counters. */
export async function cleanExpiredRateLimits(limit = 2000): Promise<number> {
  const now = Date.now()
  const rows = await getStore().query<{ resetAt?: number }>('_rate_limits', { limit })
  let removed = 0
  for (const r of rows) {
    if ((r.data.resetAt ?? 0) < now) {
      await getStore().delete('_rate_limits', r.id)
      removed++
    }
  }
  return removed
}

// FNV-1a over canonical JSON — stable across key ordering.
function stableHash(payload: unknown): string {
  const json = canonical(payload)
  let h = 0x811c9dc5
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  const keys = Object.keys(v as Record<string, unknown>).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`
}
