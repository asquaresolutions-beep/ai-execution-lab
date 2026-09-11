// /api/admin/campaigns (ADMIN)  (asq-scamcheck-digest-v1)
// GET  → list campaigns (+ optional ?id= single).
// POST → { action: 'compose' | 'approve' | 'send', id? }
//   compose : build this week's ScamCheck draft (draft only, never sends)
//   approve : draft → approved
//   send    : approved → sending (fans recipients into campaign_sends; the daily
//             cron then drains them via sendListEmail). Requires prior approval.
//   test-send : { id, to } — ONE preview email to ONE address on
//               NEWSLETTER_TEST_RECIPIENTS. Reads only that campaign: never reads
//               subscribers, never enqueues, never changes status. Subject "[TEST] …".
//   cancel    : draft | approved → canceled (terminal; the record is kept).
// Bearer ADMIN_API_TOKEN. Draft-first: no send path exists without explicit approve+send.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { composeWeeklyScamcheckDraft, composeIssueOneDraft, composeCustomIssue, drainCampaign, requeueFailedSends, listCampaignSends, listCampaigns, getCampaign, approveCampaign, enqueueCampaign, cancelCampaign, sendCampaignTest } from '@/lib/newsletter/campaigns'

export const dynamic = 'force-dynamic'

// sendCampaignTest failures caused by the request's recipient (→ 400) vs. by missing
// server configuration (→ 503). Anything else is a provider-side failure (→ 502).
const TEST_RECIPIENT_ERRORS = new Set(['recipient_required', 'single_recipient_only', 'invalid_recipient', 'recipient_not_allowlisted'])

export async function GET(req: Request) {
  if (!requireAdmin(req).ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const url = new URL(req.url)
  const sends = url.searchParams.get('sends')
  if (sends) return NextResponse.json(await listCampaignSends(sends), { headers: { 'Cache-Control': 'no-store' } })
  const id = url.searchParams.get('id')
  if (id) return NextResponse.json({ campaign: await getCampaign(id) }, { headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json({ campaigns: await listCampaigns() }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: Request) {
  if (!requireAdmin(req).ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => ({})) as { action?: string; id?: string; subject?: string; title?: string; bodyHtml?: string; to?: unknown }
  switch (b.action) {
    case 'compose':
      return NextResponse.json(await composeWeeklyScamcheckDraft())
    case 'compose-issue':
      return NextResponse.json(await composeIssueOneDraft())
    case 'compose-custom':
      if (!b.id || !b.subject || !b.title || !b.bodyHtml) return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 })
      return NextResponse.json(await composeCustomIssue({ id: b.id, subject: b.subject, title: b.title, bodyHtml: b.bodyHtml }))
    case 'approve':
      if (!b.id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
      return NextResponse.json(await approveCampaign(b.id))
    case 'send':
      if (!b.id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
      return NextResponse.json(await enqueueCampaign(b.id))
    case 'drain':
      // Explicit, admin-triggered send of an approved+enqueued campaign (status 'sending').
      if (!b.id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
      return NextResponse.json(await drainCampaign(b.id))
    case 'requeue-failed':
      // Reset FAILED recipients → queued (retry after rate-limit); never re-sends 'sent'.
      if (!b.id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
      return NextResponse.json(await requeueFailedSends(b.id))
    case 'test-send': {
      // Single-recipient preview. Deliberately NOT routed through enqueue or drain.
      if (!b.id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
      const r = await sendCampaignTest(b.id, b.to)
      const status = r.ok ? 200
        : TEST_RECIPIENT_ERRORS.has(r.error || '') ? 400
        : r.error === 'not_found' ? 404
        : r.error === 'test_recipients_not_configured' || r.skipped ? 503
        : 502
      return NextResponse.json(r, { status })
    }
    case 'cancel':
      if (!b.id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
      return NextResponse.json(await cancelCampaign(b.id))
    default:
      return NextResponse.json({ ok: false, error: 'bad_action' }, { status: 400 })
  }
}
