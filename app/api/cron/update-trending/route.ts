// GET /api/cron/update-trending — recomputes cluster trend scores and
// materializes a trending snapshot for fast public reads.
import { NextResponse } from 'next/server'
import { recomputeTrending } from '@/lib/scam-intel/feed'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { log } from '@/lib/observability/logger'
import { reportError } from '@/lib/observability/errors'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const started = Date.now()
  try {
    const result = await recomputeTrending()
    log.info({ event: 'cron.update_trending', ms: Date.now() - started, ...result })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    await reportError('cron.update_trending', err, { severity: 'error' })
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
