// /api/distribution/dlq  (ADMIN)
//   GET                              -> list dead letters
//   POST { action:'replay', dlqId }  -> re-enqueue
//   POST { action:'discard', dlqId } -> delete
import { NextResponse } from 'next/server'
import { listDeadLetters, replayDeadLetter, discardDeadLetter } from '@/lib/distribution/dlq'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json({ deadLetters: await listDeadLetters() })
}

export async function POST(req: Request) {
  const auth = requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { action?: string; dlqId?: string }
  if (!body.dlqId) return NextResponse.json({ error: 'dlqId required' }, { status: 400 })
  if (body.action === 'replay') return NextResponse.json(await replayDeadLetter(body.dlqId))
  if (body.action === 'discard') { await discardDeadLetter(body.dlqId); return NextResponse.json({ ok: true }) }
  return NextResponse.json({ error: 'action must be replay|discard' }, { status: 400 })
}
