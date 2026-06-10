// GET /api/cron/drain-queue — processes due publishing jobs, then runs daily
// maintenance (trending recompute + cache cleanup) in the SAME invocation.
// Consolidated so all 4 jobs fit Vercel's 2-cron budget without a Pro upgrade
// (autopilot 06:00 generates → this 07:00 publishes + maintains). The standalone
// /api/cron/update-trending and /api/cron/clean-cache routes remain for manual/
// Pro use. Authenticated via CRON_SECRET (isAuthorizedCron). asq-cron-consolidate-v1
import { NextResponse } from 'next/server'
import { drainQueue } from '@/lib/distribution/queue'
import { hasQueueWork } from '@/lib/distribution/throttle'
import { recomputeTrending } from '@/lib/scam-intel/feed'
import { cleanExpiredCache, cleanExpiredRateLimits } from '@/lib/ai/cache'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { log } from '@/lib/observability/logger'
import { reportError } from '@/lib/observability/errors'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const started = Date.now()
  const out: Record<string, unknown> = { ok: true }

  // 1) Primary: drain the publishing queue (behavior unchanged; early-exits when idle).
  try {
    if (await hasQueueWork()) {
      const processed = await drainQueue(20)
      out.queue = {
        processed: processed.length,
        published: processed.filter((j) => j.status === 'published').length,
        requeued: processed.filter((j) => j.status === 'queued').length,
        failed: processed.filter((j) => j.status === 'failed').length,
      }
    } else {
      out.queue = { processed: 0, skipped: 'no-work' }
    }
  } catch (err) {
    await reportError('cron.drain_queue', err, { severity: 'error' })
    out.queue = { error: (err as Error).message }
  }

  // 2) Consolidated daily maintenance — each isolated so a failure never fails the
  //    cron, throws, or blocks the next step. Idempotent (recompute = last-write-wins;
  //    cleanup = delete-expired), so safe under Vercel at-most-once + any overlap.
  try {
    out.trending = await recomputeTrending()
  } catch (err) {
    await reportError('cron.update_trending', err, { severity: 'warning' })
    out.trending = { error: (err as Error).message }
  }
  try {
    const [cache, rateLimits] = await Promise.all([cleanExpiredCache(), cleanExpiredRateLimits()])
    out.cleaned = { cache, rateLimits }
  } catch (err) {
    await reportError('cron.clean_cache', err, { severity: 'warning' })
    out.cleaned = { error: (err as Error).message }
  }

  log.info({ event: 'cron.daily_maintenance', ms: Date.now() - started, ...out })
  return NextResponse.json(out)
}
