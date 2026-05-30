// GET /api/cron/clean-cache — removes expired AI cache entries and stale
// rate-limit counters. (On Firestore, TTL policies handle this too; this
// keeps the dev/memory backend tidy and acts as a portable fallback.)
import { NextResponse } from 'next/server'
import { cleanExpiredCache, cleanExpiredRateLimits } from '@/lib/ai/cache'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { log } from '@/lib/observability/logger'
import { reportError } from '@/lib/observability/errors'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const started = Date.now()
  try {
    const [cache, rateLimits] = await Promise.all([cleanExpiredCache(), cleanExpiredRateLimits()])
    log.info({ event: 'cron.clean_cache', ms: Date.now() - started, cache, rateLimits })
    return NextResponse.json({ ok: true, removed: { cache, rateLimits } })
  } catch (err) {
    await reportError('cron.clean_cache', err, { severity: 'warning' })
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
