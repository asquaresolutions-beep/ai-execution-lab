// GET /api/admin/email-events?campaignId=<id>&limit=2000   (ADMIN, read-only)
// asq-email-observability-v1
//
// Aggregate email engagement telemetry from the `email_events` collection, which
// the Resend webhook (app/api/webhooks/resend) fills via recordEmailEvent().
// Read-only: this route never writes, sends, enqueues or modifies anything.
//
// ── PII position ──────────────────────────────────────────────────
// NO subscriber address is ever returned. Recipients are reported as a COUNT
// (`distinctRecipients`) derived in-process and discarded. There is deliberately
// no `recent events` array and no per-recipient breakdown: an event row's only
// identifying field IS the address, so any row-level view would be a PII surface.
//
// ── Three distinct states, never collapsed ────────────────────────
//   unavailable      — the store threw; we do not know anything
//   no_events        — the query succeeded and returned zero rows in scope
//   events_available — rows exist in scope
// "Broken" and "zero" look identical to a caller that only reports a number, and
// that ambiguity is the whole reason this endpoint exists.
//
// ── Why the query has no `where` clause ───────────────────────────
// lib/email/events.ts#recentEmailEvents combines `where campaignId == X` with
// `orderBy ts desc`. On Firestore that pair requires a COMPOSITE index, which is
// not provisioned — the query would fail with FAILED_PRECONDITION and this route
// would report `unavailable` permanently. So we order by `ts` alone (a
// single-field index Firestore maintains automatically) and filter by campaign
// in-process. `orderBy` is NOT optional here: without it Firestore returns rows
// in `__name__` order, and because genId() prefixes a base36 timestamp that is
// effectively OLDEST-first — so a truncated window would summarise the wrong
// events entirely.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getStore } from '@/lib/store/adapter'
import { EMAIL_EVENTS } from '@/lib/email/events'
import { summarizeEmailEvents } from '@/lib/email/webhook'

export const dynamic = 'force-dynamic'

const LIMIT_DEFAULT = 2000
const LIMIT_MAX = 5000

// A row written by a malformed webhook payload: webhook.ts coerced an empty
// `to` array to the literal string "undefined". Counted so the operator can see
// whether that defect ever fired in production, and excluded from recipient counts.
const MALFORMED_EMAILS = new Set(['', 'undefined', 'null'])

interface EmailEventRow {
  type?: string
  email?: string
  campaignId?: string
  ts?: number
}

export async function GET(req: Request) {
  if (!requireAdmin(req).ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const campaignId = (url.searchParams.get('campaignId') || '').trim() || null
  // searchParams.get() is null when absent and Number(null) is 0 — which would
  // silently pass a ">= 0" guard and scan nothing. Treat absent/blank as unset.
  const rawLimit = url.searchParams.get('limit')
  const parsed = rawLimit === null || rawLimit.trim() === '' ? NaN : Number(rawLimit)
  const limit = Number.isFinite(parsed) && parsed > 0
    ? Math.min(LIMIT_MAX, Math.trunc(parsed))
    : LIMIT_DEFAULT

  let rows: { data: EmailEventRow }[]
  try {
    rows = await getStore().query<EmailEventRow>(EMAIL_EVENTS, {
      orderBy: { field: 'ts', dir: 'desc' },   // see header note — not optional
      limit,
    })
  } catch (e) {
    // State 1: we genuinely do not know. Never report this as "no events".
    return NextResponse.json({
      status: 'unavailable',
      reason: String((e as Error)?.message ?? e).slice(0, 200),
      campaignId,
    }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const all = rows.map((r) => r.data || {})
  const tagged = all.filter((r) => !!r.campaignId)
  const byCampaign: Record<string, number> = {}
  for (const r of tagged) byCampaign[String(r.campaignId)] = (byCampaign[String(r.campaignId)] || 0) + 1

  // When a campaign is requested the scope is EXACTLY its tagged events. There is
  // deliberately no fallback to "all events" — inferring that untagged events
  // belong to the requested campaign would be inventing attribution.
  const scoped = campaignId ? all.filter((r) => r.campaignId === campaignId) : all

  const emails = scoped.map((r) => String(r.email ?? '').toLowerCase())
  const malformedRecipientRows = emails.filter((e) => MALFORMED_EMAILS.has(e)).length
  const distinctRecipients = new Set(emails.filter((e) => !MALFORMED_EMAILS.has(e))).size

  const ts = scoped.map((r) => Number(r.ts)).filter((n) => Number.isFinite(n) && n > 0)

  return NextResponse.json({
    status: scoped.length ? 'events_available' : 'no_events',
    campaignId,
    window: { limit, scanned: all.length, truncated: all.length >= limit },
    summary: summarizeEmailEvents(scoped.map((r) => ({ type: String(r.type || 'unknown') }))),
    distinctRecipients,          // COUNT ONLY — no address is ever returned
    malformedRecipientRows,
    firstEventAt: ts.length ? new Date(Math.min(...ts)).toISOString() : null,
    lastEventAt: ts.length ? new Date(Math.max(...ts)).toISOString() : null,
    // ── Attribution context ──────────────────────────────────────
    // Without this block a 404ing webhook and a campaign that predates tagging
    // both render as `no_events`, and the operator cannot tell which. These
    // counts are over the whole window, NOT the requested campaign.
    attribution: {
      totalEventsStored: all.length,
      taggedWithCampaignId: tagged.length,
      untagged: all.length - tagged.length,
      taggingActive: tagged.length > 0,
      campaigns: byCampaign,
      note: all.length === 0
        ? 'No events stored in this window. Either the webhook has never delivered, or nothing has been sent. This endpoint cannot distinguish those two.'
        : tagged.length === 0
          ? 'Events are arriving, but none carry a campaignId — these sends predate campaign tagging. Per-campaign attribution is not recoverable for them.'
          : `${tagged.length} of ${all.length} events carry a campaignId; the other ${all.length - tagged.length} predate tagging.`,
      scopeNote: !campaignId
        ? undefined
        : scoped.length > 0
          ? undefined
          : tagged.length === 0
            ? 'No stored event carries ANY campaignId, so this campaign cannot be attributed — its emails were sent before tagging shipped. This is NOT evidence of zero delivery.'
            : 'Tagging is active, but no stored event in this window carries this campaignId.',
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
