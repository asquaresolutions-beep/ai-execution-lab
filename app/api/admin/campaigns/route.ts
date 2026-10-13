// /api/admin/campaigns (ADMIN)  (asq-scamcheck-digest-v1)
// GET  → list campaigns (+ optional ?id= single).
// POST → { action: 'compose' | 'approve' | 'send', id? }
//   compose : build this week's ScamCheck draft (draft only, never sends)
//   approve : draft → approved
//   send    : approved → sending (fans recipients into campaign_sends; the daily
//             cron then drains them via sendListEmail). Requires prior approval.
//             Returns how many were queued and how many were left out, by reason.
//   compose-custom : { id, subject, title, bodyHtml, preheader?, footer?, replaceDraft? } — draft only.
//             An id already in use is refused (HTTP 409) — a draft is replaced only
//             when replaceDraft is true; anything else under that id, never.
//             preheader = inbox preview line; footer 'no-link' drops the ScamCheck
//             site link for that campaign. Both optional; both refused if malformed.
//   set-exclusions : { id, exclusions: [{ recordId, reason, evidence, reviewedAt, reviewedBy? }] }
//             Reviewed list of subscriber record ids to leave out of THIS campaign.
//             Draft or approved only; replaces the list; refused whole if any entry is
//             malformed. Removes recipients only. Changes no subscriber record.
//   preflight : { id } — READ-ONLY. What a queue built now would hold: count, record
//             ids, fingerprints, who is left out and why, what each exclusion did,
//             anything that blocks a queue, and the `binding` to hand to `send`.
//   send    : REQUIRES expect: the `binding` of a recent preflight, unchanged. No
//             binding, a malformed or stale one, a changed recipient set or exclusion
//             list, an ambiguous exclusion or a campaign id already in use: nothing is
//             queued and the answer is not a success (HTTP 400 or 409).
//   drain   : sends queued recipients; optional batch (1-200) keeps a call short.
//             Each is re-checked against the current subscriber record immediately
//             before delivery and skipped, with the reason recorded, if no longer
//             eligible. Safe to repeat: refused while a run is alive, and no recipient
//             is handed to the provider twice for one attempt.
//   resolve-uncertain : { id, recordId, outcome: 'sent' | 'retry', evidence } — settles
//             ONE recipient whose outcome is unknown. Never automatic.
//   selfcheck : proves the live store's create-if-absent lets exactly one caller win.
//             Sends nothing; reads no subscriber or campaign.
//   test-send : { id, to } — ONE preview email to ONE address on
//               NEWSLETTER_TEST_RECIPIENTS. Reads only that campaign: never reads
//               subscribers, never enqueues, never changes status. Subject "[TEST] …".
//   cancel    : draft | approved → canceled (terminal; the record is kept).
// Bearer ADMIN_API_TOKEN. Draft-first: no send path exists without explicit approve+send.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { composeWeeklyScamcheckDraft, composeIssueOneDraft, composeCustomIssue, drainCampaign, requeueFailedSends, listCampaignSends, listCampaigns, getCampaign, approveCampaign, enqueueCampaign, cancelCampaign, sendCampaignTest, setCampaignExclusions, previewRecipients, resolveUncertain, storeSelfCheck } from '@/lib/newsletter/campaigns'

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
  const b = await req.json().catch(() => ({})) as { action?: string; id?: string; subject?: string; title?: string; bodyHtml?: string; to?: unknown; preheader?: unknown; footer?: unknown; replaceDraft?: unknown; exclusions?: unknown; expect?: unknown; batch?: unknown; recordId?: unknown; outcome?: unknown; evidence?: unknown; acceptDuplicateRisk?: unknown }
  switch (b.action) {
    case 'compose':
      return NextResponse.json(await composeWeeklyScamcheckDraft())
    case 'compose-issue':
      return NextResponse.json(await composeIssueOneDraft())
    case 'compose-custom': {
      if (!b.id || !b.subject || !b.title || !b.bodyHtml) return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 })
      // Optional per-campaign rendering options (asq-newsletter-send-eligibility-v1).
      // A malformed value is refused rather than silently dropped, so a draft never
      // renders differently from what was asked for.
      const preheader = b.preheader == null || b.preheader === '' ? undefined : b.preheader
      if (preheader !== undefined && (typeof preheader !== 'string' || preheader.length > 200 || /[\r\n<>]/.test(preheader))) return NextResponse.json({ ok: false, error: 'invalid_preheader' }, { status: 400 })
      const footer = b.footer == null || b.footer === '' ? undefined : b.footer
      if (footer !== undefined && footer !== 'default' && footer !== 'no-link') return NextResponse.json({ ok: false, error: 'invalid_footer' }, { status: 400 })
      if (b.replaceDraft != null && typeof b.replaceDraft !== 'boolean') return NextResponse.json({ ok: false, error: 'invalid_replace_draft' }, { status: 400 })
      const r = await composeCustomIssue({ id: b.id, subject: b.subject, title: b.title, bodyHtml: b.bodyHtml, ...(preheader ? { preheader } : {}), ...(footer ? { footer } : {}), ...(b.replaceDraft === true ? { replaceDraft: true } : {}) })
      // An id that is already in use is a refusal, not a result to be read past.
      if (!r.created && r.reason?.startsWith('id-in-use')) return NextResponse.json({ ok: false, error: 'campaign_id_in_use', ...r }, { status: 409 })
      return NextResponse.json(r)
    }
    case 'approve':
      if (!b.id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
      return NextResponse.json(await approveCampaign(b.id))
    case 'set-exclusions': {
      if (!b.id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
      const r = await setCampaignExclusions(b.id, b.exclusions)
      return NextResponse.json(r, { status: r.ok ? 200 : r.error === 'not_found' ? 404 : r.error?.startsWith('locked') ? 409 : 400 })
    }
    case 'preflight': {
      // Read-only: reviews the recipient list BEFORE anything is queued.
      if (!b.id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
      const r = await previewRecipients(b.id)
      return NextResponse.json(r, { status: r.ok ? 200 : 404, headers: { 'Cache-Control': 'no-store' } })
    }
    case 'send': {
      if (!b.id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
      // The binding of a recent preflight is REQUIRED here, for every campaign. Absent (or null) is
      // refused; malformed is refused, never ignored; and only a queue that was built answers 200.
      if (b.expect == null) return NextResponse.json({ ok: false, error: 'binding_required' }, { status: 400 })
      const e = b.expect as { recipients?: unknown; fingerprint?: unknown; exclusionsFingerprint?: unknown; preflightAt?: unknown }
      const okShape = typeof e === 'object' && !Array.isArray(e)
        && Number.isInteger(e.recipients) && (e.recipients as number) >= 0
        && typeof e.fingerprint === 'string' && /^[0-9a-f]{64}$/.test(e.fingerprint)
        && typeof e.exclusionsFingerprint === 'string' && /^[0-9a-f]{64}$/.test(e.exclusionsFingerprint)
        && typeof e.preflightAt === 'string' && Number.isFinite(Date.parse(e.preflightAt))
      if (!okShape) return NextResponse.json({ ok: false, error: 'invalid_expect' }, { status: 400 })
      const r = await enqueueCampaign(b.id, undefined, { recipients: e.recipients as number, fingerprint: e.fingerprint as string, exclusionsFingerprint: e.exclusionsFingerprint as string, preflightAt: e.preflightAt as string })
      return NextResponse.json(r, { status: r.ok ? 200 : r.error === 'not_found' ? 404 : r.error === 'binding_required' || r.error === 'invalid_binding' ? 400 : 409 })
    }
    case 'drain': {
      // Explicit, admin-triggered send of an approved+enqueued campaign (status 'sending').
      if (!b.id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
      if (b.batch != null && !(Number.isInteger(b.batch) && (b.batch as number) >= 1 && (b.batch as number) <= 200)) return NextResponse.json({ ok: false, error: 'invalid_batch' }, { status: 400 })
      return NextResponse.json(await drainCampaign(b.id, b.batch == null ? undefined : (b.batch as number)))
    }
    case 'resolve-uncertain': {
      if (!b.id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
      const r = await resolveUncertain(b.id, { recordId: b.recordId, outcome: b.outcome, evidence: b.evidence, acceptDuplicateRisk: b.acceptDuplicateRisk })
      return NextResponse.json(r, { status: r.ok ? 200 : r.error === 'not_found' || r.error === 'row_not_found' ? 404 : r.error?.startsWith('not_uncertain') || r.error?.startsWith('already_resolved') || r.error === 'provider_key_window_expired' ? 409 : 400 })
    }
    case 'selfcheck': {
      const r = await storeSelfCheck()
      return NextResponse.json(r, { status: r.ok ? 200 : 500 })
    }
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
