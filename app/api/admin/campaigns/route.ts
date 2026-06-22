// /api/admin/campaigns (ADMIN)  (asq-scamcheck-digest-v1)
// GET  → list campaigns (+ optional ?id= single).
// POST → { action: 'compose' | 'approve' | 'send', id? }
//   compose : build this week's ScamCheck draft (draft only, never sends)
//   approve : draft → approved
//   send    : approved → sending (fans recipients into campaign_sends; the daily
//             cron then drains them via sendListEmail). Requires prior approval.
// Bearer ADMIN_API_TOKEN. Draft-first: no send path exists without explicit approve+send.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { composeWeeklyScamcheckDraft, composeIssueOneDraft, listCampaigns, getCampaign, approveCampaign, enqueueCampaign } from '@/lib/newsletter/campaigns'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!requireAdmin(req).ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (id) return NextResponse.json({ campaign: await getCampaign(id) }, { headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json({ campaigns: await listCampaigns() }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: Request) {
  if (!requireAdmin(req).ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => ({})) as { action?: string; id?: string }
  switch (b.action) {
    case 'compose':
      return NextResponse.json(await composeWeeklyScamcheckDraft())
    case 'compose-issue':
      return NextResponse.json(await composeIssueOneDraft())
    case 'approve':
      if (!b.id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
      return NextResponse.json(await approveCampaign(b.id))
    case 'send':
      if (!b.id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
      return NextResponse.json(await enqueueCampaign(b.id))
    default:
      return NextResponse.json({ ok: false, error: 'bad_action' }, { status: 400 })
  }
}
