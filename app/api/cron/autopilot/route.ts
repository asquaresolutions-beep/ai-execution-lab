// GET /api/cron/autopilot — autonomous scam-alert generation.
// Selects fresh/trending clusters, generates bundles (article + Hindi +
// GEO + FAQ + schema + social), queues publishing + Shorts. Budget-capped.
import { NextResponse } from 'next/server'
import { runAutopilot } from '@/lib/scam-intel/autopilot'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { log } from '@/lib/observability/logger'
import { reportError } from '@/lib/observability/errors'

export const dynamic = 'force-dynamic'
// Vercel Hobby caps serverless functions at 60s (Pro allows up to 300). Keep 60
// for Hobby compatibility; the autopilot route early-exits within budget.
export const maxDuration = 60

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const started = Date.now()
  try {
    const result = await runAutopilot()
    log.info({ event: 'cron.autopilot', ms: Date.now() - started, generated: result.generated.length, skippedExisting: result.skippedExisting })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    await reportError('cron.autopilot', err, { severity: 'error' })
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
