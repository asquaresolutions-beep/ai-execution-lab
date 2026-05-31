// GET /api/cron/drain-queue — processes due publishing jobs.
// Scheduled by vercel.json. Authenticated via CRON_SECRET.
import { NextResponse } from 'next/server'
import { drainQueue } from '@/lib/distribution/queue'
import { hasQueueWork } from '@/lib/distribution/throttle'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { log } from '@/lib/observability/logger'
import { reportError } from '@/lib/observability/errors'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const started = Date.now()
  try {
    // Cheap pre-check: exit early when there is no work (saves cost).
    if (!(await hasQueueWork())) {
      return NextResponse.json({ ok: true, processed: 0, skipped: 'no-work' })
    }
    const processed = await drainQueue(20)
    const summary = {
      processed: processed.length,
      published: processed.filter((j) => j.status === 'published').length,
      requeued: processed.filter((j) => j.status === 'queued').length,
      failed: processed.filter((j) => j.status === 'failed').length,
    }
    log.info({ event: 'cron.drain_queue', ms: Date.now() - started, ...summary })
    return NextResponse.json({ ok: true, ...summary })
  } catch (err) {
    await reportError('cron.drain_queue', err, { severity: 'error' })
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
