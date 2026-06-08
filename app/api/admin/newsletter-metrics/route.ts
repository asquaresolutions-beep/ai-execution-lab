// GET /api/admin/newsletter-metrics (ADMIN) — newsletter subscriber analytics for
// the dashboard. Bearer ADMIN_API_TOKEN required. Read-only.
// asq-newsletter-idemp-v1
//
// Returns: total subscribers, breakdown by verdict (scam/safe/suspicious/unknown),
// by source page, by device, and per-verdict conversion share (scan-sourced mix),
// plus the most recent signups (PII-light: email is included for the owner's own
// dashboard, which is already token-gated like /api/admin/leads).
import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store/adapter'
import { requireAdmin } from '@/lib/admin-auth'
import { summarizeSubscribers, type SubscriberRow } from '@/lib/newsletter/subscribers'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!requireAdmin(req).ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let docs: { id: string; data: Record<string, unknown> }[] = []
  try { docs = await getStore().query<Record<string, unknown>>('newsletter', { limit: 10000 }) } catch { docs = [] }

  const rows: (SubscriberRow & { email: string })[] = docs.map((d) => {
    const x = d.data || {}
    return {
      email: String(x.email ?? ''),
      verdict: x.verdict != null ? String(x.verdict) : undefined,
      source: x.source != null ? String(x.source) : undefined,
      device: x.device != null ? String(x.device) : undefined,
      createdAt: String(x.createdAt ?? ''),
    }
  })

  const summary = summarizeSubscribers(rows)
  const recent = [...rows]
    .sort((a, b) => ((b.createdAt || '') > (a.createdAt || '') ? 1 : -1))
    .slice(0, 50)
    .map((r) => ({ email: r.email, verdict: r.verdict ?? 'unknown', source: r.source ?? '', device: r.device ?? 'desktop', createdAt: r.createdAt }))

  return NextResponse.json({ ...summary, recent }, { headers: { 'Cache-Control': 'no-store' } })
}
