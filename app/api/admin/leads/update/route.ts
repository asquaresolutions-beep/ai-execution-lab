// POST /api/admin/leads/update (ADMIN) — set lead status / notes for follow-up.
// Body: { collection, id, status?, notes? }. Bearer ADMIN_API_TOKEN required.
import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store/adapter'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const STATUSES = new Set(['New', 'Contacted', 'Qualified', 'Won', 'Lost'])
const COLLECTIONS = new Set(['leads', '_contact', 'newsletter', 'subscribers', 'lab_subscribers'])

export async function POST(req: Request) {
  if (!requireAdmin(req).ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => ({})) as { collection?: string; id?: string; status?: string; notes?: string }
  if (!b.collection || !COLLECTIONS.has(b.collection) || !b.id) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  }
  const patch: Record<string, unknown> = {}
  if (typeof b.status === 'string') {
    if (!STATUSES.has(b.status)) return NextResponse.json({ ok: false, error: 'bad_status' }, { status: 400 })
    patch.status = b.status
  }
  if (typeof b.notes === 'string') patch.notes = b.notes.slice(0, 4000)
  if (!Object.keys(patch).length) return NextResponse.json({ ok: false, error: 'nothing_to_update' }, { status: 400 })
  patch.updatedAt = new Date().toISOString()
  try {
    await getStore().update(b.collection, b.id, patch)
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message?.slice(0, 200) }, { status: 500 })
  }
}
