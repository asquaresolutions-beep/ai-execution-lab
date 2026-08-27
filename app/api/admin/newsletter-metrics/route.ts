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
import { summarizeSubscribers, subscriberTrends, subscriberDocId, type SubscriberRow } from '@/lib/newsletter/subscribers'

export const dynamic = 'force-dynamic'

// `recent` was previously a hardcoded .slice(0, 50) with no way to see past it —
// so with 52 subscribers, two were invisible and the true eligible count could not
// be established before a send. It is now an explicit, capped `?limit=` (default 50
// to preserve the existing dashboard's behaviour), and `recentTotal` always states
// how many rows exist so truncation is never silent.
const RECENT_DEFAULT = 50
const RECENT_MAX = 500

// Source values written by internal delivery/SMTP test harnesses. Reported so the
// operator can SEE them; deliberately NOT auto-excluded — recipient selection is
// enqueueCampaign's job, and silently diverging from it is exactly the failure mode
// this endpoint exists to prevent.
const TEST_HARNESS_SOURCES = ['e2e-delivery-test', 'smtp-audit-verification']

export async function GET(req: Request) {
  if (!requireAdmin(req).ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  // NOTE: searchParams.get() returns null when the param is absent, and Number(null)
  // is 0 — which would silently pass a ">= 0" guard and return ZERO rows by default,
  // breaking the existing dashboard. Treat absent/empty as "not supplied" explicitly.
  const rawLimit = url.searchParams.get('limit')
  const parsedLimit = rawLimit === null || rawLimit.trim() === '' ? NaN : Number(rawLimit)
  const limit = Number.isFinite(parsedLimit) && parsedLimit >= 0
    ? Math.min(RECENT_MAX, Math.trunc(parsedLimit))
    : RECENT_DEFAULT

  let docs: { id: string; data: Record<string, unknown> }[] = []
  try { docs = await getStore().query<Record<string, unknown>>('newsletter', { limit: 10000 }) } catch { docs = [] }

  const rows: (SubscriberRow & { email: string; unsubscribed: boolean })[] = docs.map((d) => {
    const x = d.data || {}
    return {
      email: String(x.email ?? ''),
      unsubscribed: x.unsubscribed === true,
      verdict: x.verdict != null ? String(x.verdict) : undefined,
      source: x.source != null ? String(x.source) : undefined,
      device: x.device != null ? String(x.device) : undefined,
      createdAt: String(x.createdAt ?? ''),
    }
  })

  // ── Audience accounting — mirrors enqueueCampaign(campaigns.ts:126-137) exactly ──
  // enqueue skips a row when: no email OR unsubscribed. It then derives a
  // deterministic send id from subscriberDocId(email), so two rows normalising to
  // the same address collapse into ONE recipient. `eligible` therefore counts
  // DISTINCT doc ids, which is the number a fresh campaign would actually queue.
  const seen = new Set<string>()
  let blankEmail = 0, unsubscribed = 0, duplicateEmail = 0
  for (const r of rows) {
    const email = (r.email || '').toLowerCase()
    if (!email) { blankEmail++; continue }
    if (r.unsubscribed) { unsubscribed++; continue }
    const id = subscriberDocId(email)
    if (seen.has(id)) { duplicateEmail++; continue }
    seen.add(id)
  }
  const audience = {
    total: rows.length,                 // every stored row, opted-out included
    active: rows.length - unsubscribed - blankEmail,
    unsubscribed,
    blankEmail,
    duplicateEmail,
    eligible: seen.size,                // === recipients a NEW campaign would enqueue
    // Identified by doc id only — never the address. This is the same identifier the
    // unsubscribe route accepts, so a suppression can be verified without PII.
    testRecords: rows
      .filter((r) => TEST_HARNESS_SOURCES.some((s) => (r.source || '').includes(s)))
      .map((r) => ({ docId: subscriberDocId((r.email || '').toLowerCase()), source: r.source ?? '', unsubscribed: r.unsubscribed })),
  }

  const summary = summarizeSubscribers(rows)
  const trends = subscriberTrends(rows)            // asq-newsletter-dash-v1: daily/weekly/cumulative/topSources
  const sorted = [...rows].sort((a, b) => ((b.createdAt || '') > (a.createdAt || '') ? 1 : -1))
  const recent = sorted
    .slice(0, limit)
    .map((r) => ({ email: r.email, verdict: r.verdict ?? 'unknown', source: r.source ?? '', device: r.device ?? 'desktop', createdAt: r.createdAt, unsubscribed: r.unsubscribed }))

  return NextResponse.json(
    { ...summary, audience, trends, recent, recentTotal: rows.length, recentLimit: limit, recentTruncated: rows.length > recent.length },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
