// /api/scam-intel/moderate  (ADMIN)
//   GET  ?status=pending          -> moderation queue + summary
//   POST { reportId, decision:'approved'|'rejected', note? }
import { NextResponse } from 'next/server'
import { moderationQueue, moderateReport, queueSummary } from '@/lib/scam-intel/feed'
import type { ReportStatus } from '@/lib/scam-intel/types'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const status = (new URL(req.url).searchParams.get('status') as ReportStatus) || 'pending'
  const [queue, summary] = await Promise.all([moderationQueue(status), queueSummary()])
  return NextResponse.json({ queue, summary })
}

export async function POST(req: Request) {
  const auth = requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { reportId?: string; decision?: 'approved' | 'rejected'; note?: string }
  if (!body.reportId || (body.decision !== 'approved' && body.decision !== 'rejected')) {
    return NextResponse.json({ error: 'reportId and decision(approved|rejected) required' }, { status: 400 })
  }
  await moderateReport(body.reportId, body.decision, auth.adminId, body.note)
  return NextResponse.json({ ok: true })
}
