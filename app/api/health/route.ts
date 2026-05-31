// GET /api/health — readiness probe. Public, but only exposes coarse
// status (no secrets). Returns 200 healthy / 503 unhealthy.
import { NextResponse } from 'next/server'
import { validateProductionEnv } from '@/lib/env'
import { getStore } from '@/lib/store/adapter'
import { getProvider } from '@/lib/ai/provider'
import { queueHealth } from '@/lib/analytics'

export const dynamic = 'force-dynamic'

export async function GET() {
  const envReport = validateProductionEnv()

  // Probe the store with a cheap round-trip.
  let storeOk = false
  try {
    await getStore().query('_health_probe', { limit: 1 })
    storeOk = true
  } catch { storeOk = false }

  let queue
  try { queue = await queueHealth() } catch { queue = null }

  const provider = getProvider()
  const healthy = storeOk && (queue?.status !== 'unhealthy')

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'unhealthy',
      mode: {
        ai: envReport.aiLive ? 'live' : 'mock',
        persistence: envReport.persistence,
        provider: provider.name,
      },
      env: {
        ok: envReport.ok,
        missingRequired: envReport.missingRequired,
        warnings: envReport.warnings,
      },
      store: { ok: storeOk, backend: getStore().name },
      queue: queue ? { status: queue.status, queued: queue.queued, dlq: queue.dlq, failureRate: queue.failureRate } : null,
      ts: Date.now(),
    },
    { status: healthy ? 200 : 503 },
  )
}
