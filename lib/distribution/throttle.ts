// ─────────────────────────────────────────────────────────────────
// lib/distribution/throttle.ts
// Publish throttling + cheap "has work" checks for low-cost autonomous
// operation. Keeps spend predictable on free/hobby plans by capping how
// much we generate and publish per window, and by skipping cron work
// entirely when there is nothing to do (avoids waking functions for free).
// ─────────────────────────────────────────────────────────────────

import { getStore } from '@/lib/store/adapter'
import { checkRateLimit } from '@/lib/ai/rate-limit'

function num(key: string, fallback: number): number {
  const v = Number(process.env[key])
  return Number.isFinite(v) && v > 0 ? v : fallback
}

// Caps (env-overridable) — tuned for hobby-plan economics.
export const THROTTLE = {
  publishesPerHour: num('PUBLISH_PER_HOUR', 12),
  bundlesPerDay: num('BUNDLES_PER_DAY', 20),
  autopilotPerRun: num('AUTOPILOT_PER_RUN', 3),
} as const

/** Returns true if a publish is allowed now (and consumes a slot). */
export async function allowPublish(): Promise<boolean> {
  const r = await checkRateLimit({ key: 'publish:throttle', limit: THROTTLE.publishesPerHour, windowMs: 3_600_000 })
  return r.allowed
}

/** Returns true if a new bundle generation is within the daily budget. */
export async function allowBundle(): Promise<boolean> {
  const r = await checkRateLimit({ key: 'bundle:daily', limit: THROTTLE.bundlesPerDay, windowMs: 86_400_000 })
  return r.allowed
}

/**
 * Cheap pre-check: is there any due work in the publish queue?
 * One small indexed query instead of waking the full drain machinery.
 */
export async function hasQueueWork(): Promise<boolean> {
  const rows = await getStore().query('publish_queue', {
    where: [{ field: 'status', op: '==', value: 'queued' }],
    limit: 1,
  })
  return rows.length > 0
}
