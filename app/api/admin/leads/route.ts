// GET /api/admin/leads (ADMIN) — returns all leads + newsletter subscribers for
// the lead analytics dashboard. Bearer ADMIN_API_TOKEN required. Read-only.
import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store/adapter'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

type Row = {
  id: string; collection: string; name: string; email: string; service: string;
  message: string; source: string; createdAt: string; status: string; notes: string; spam: boolean
}

function spamFlag(email: string, message: string, source: string): boolean {
  if (/^(test|qa|demo|spam)/i.test(email) || /(example|test|mailinator|tempmail)\.(com|net|org)$/i.test(email)) return true
  if (/(https?:\/\/|\[url=|viagra|casino|crypto giveaway)/i.test(message)) return true
  if (!source) return false
  return false
}

async function read(collection: string): Promise<Row[]> {
  try {
    const docs = await getStore().query<Record<string, unknown>>(collection, { limit: 5000 })
    return docs.map((d) => {
      const x = d.data || {}
      const email = String(x.email ?? '')
      const message = String(x.message ?? '')
      const source = String(x.source ?? '')
      return {
        id: d.id, collection,
        name: String(x.name ?? ''), email,
        service: String(x.service ?? ''), message, source,
        createdAt: String(x.createdAt ?? ''),
        status: String(x.status ?? 'New'),
        notes: String(x.notes ?? ''),
        spam: spamFlag(email, message, source),
      }
    })
  } catch { return [] }
}

export async function GET(req: Request) {
  if (!requireAdmin(req).ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const [leads, contact, newsletter, subscribers, lab] = await Promise.all([
    read('leads'), read('_contact'), read('newsletter'), read('subscribers'), read('lab_subscribers'),
  ])
  return NextResponse.json({
    leads: [...leads, ...contact].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)),
    newsletter: [...newsletter, ...subscribers, ...lab].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
