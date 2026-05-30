// ─────────────────────────────────────────────────────────────────
// lib/ai/rate-limit.ts
// Token-bucket-ish fixed-window rate limiting, persisted via the store
// so it works across requests (and across instances on Firestore).
// Protects both the AI providers (cost) and the public ingestion API
// (abuse / spam).
// ─────────────────────────────────────────────────────────────────

import { getStore } from '@/lib/store/adapter'

export interface RateLimitConfig {
  /** Logical bucket key, e.g. `ai:generate` or `ingest:<ip>`. */
  key: string
  /** Max actions allowed per window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
}

const COLLECTION = '_rate_limits'

export async function checkRateLimit(cfg: RateLimitConfig): Promise<RateLimitResult> {
  const store = getStore()
  const now = Date.now()
  const windowId = Math.floor(now / cfg.windowMs)
  const docId = `${sanitize(cfg.key)}__${windowId}`
  const resetAt = (windowId + 1) * cfg.windowMs

  const count = await store.increment(COLLECTION, docId, 'count', 1)
  // Stamp window metadata on first hit (best-effort).
  if (count === 1) {
    await store.update(COLLECTION, docId, { key: cfg.key, resetAt, windowId })
  }
  const allowed = count <= cfg.limit
  return { allowed, remaining: Math.max(0, cfg.limit - count), resetAt, limit: cfg.limit }
}

/** Throwing variant for use at the top of API handlers / generators. */
export async function enforceRateLimit(cfg: RateLimitConfig): Promise<void> {
  const r = await checkRateLimit(cfg)
  if (!r.allowed) {
    throw new RateLimitError(cfg.key, r.resetAt)
  }
}

export class RateLimitError extends Error {
  resetAt: number
  status = 429
  constructor(key: string, resetAt: number) {
    super(`Rate limit exceeded for "${key}". Retry after ${new Date(resetAt).toISOString()}`)
    this.name = 'RateLimitError'
    this.resetAt = resetAt
  }
}

// Sensible defaults the engines reference.
export const RATE_LIMITS = {
  aiGenerate: { limit: 30, windowMs: 60_000 },      // 30 AI calls / min
  aiGenerateDaily: { limit: 1000, windowMs: 86_400_000 },
  publicIngest: { limit: 20, windowMs: 60_000 },     // per identity / min
  queueDrain: { limit: 10, windowMs: 60_000 },
} as const

function sanitize(k: string): string {
  return k.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 120)
}
