// /api/distribution/queue
//   GET            -> list jobs (?status=)
//   POST {action:'enqueue', bundleId, channels[], locale?, runAt?}
//   POST {action:'drain', max?}  -> process due jobs (cron-friendly)
import { NextResponse } from 'next/server'
import { enqueue, drainQueue, listJobs, type QueueStatus } from '@/lib/distribution/queue'
import type { Channel } from '@/lib/distribution/integrations'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const status = new URL(req.url).searchParams.get('status') as QueueStatus | null
  const jobs = await listJobs(status ?? undefined)
  return NextResponse.json({ jobs })
}

export async function POST(req: Request) {
  const auth = requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as {
    action?: string; bundleId?: string; channels?: Channel[]; locale?: 'en' | 'hi'; runAt?: number; max?: number
  }
  try {
    if (body.action === 'enqueue') {
      if (!body.bundleId || !body.channels?.length) {
        return NextResponse.json({ error: 'bundleId and channels[] required' }, { status: 400 })
      }
      const jobs = await enqueue(body.bundleId, { channels: body.channels, locale: body.locale, runAt: body.runAt })
      return NextResponse.json({ jobs }, { status: 201 })
    }
    if (body.action === 'drain') {
      const processed = await drainQueue(body.max ?? 10)
      return NextResponse.json({ processed })
    }
    return NextResponse.json({ error: 'action must be enqueue|drain' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
