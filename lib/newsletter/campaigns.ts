// ─────────────────────────────────────────────────────────────────
// lib/newsletter/campaigns.ts  (asq-scamcheck-digest-v1)
// Draft-first, manual-approval campaign engine for the weekly digest.
//
// Lifecycle:  draft ──approve──► approved ──send(enqueue)──► sending ──drain──► sent
//   • compose/createDraft   : builds a DRAFT only (never sends).
//   • approveCampaign        : draft → approved (admin).
//   • enqueueCampaign        : approved → sending; fans recipients into
//                              `campaign_sends` (idempotent per recipient).
//   • processCampaignSends   : drains `campaign_sends` via sendListEmail; only
//                              touches campaigns already in `sending`. Flag-gated
//                              (WEEKLY_DIGEST_ENABLED) — extra belt over the fact
//                              that nothing is enqueued without explicit approval.
//
// Reuse: sendListEmail (PR#9 deliverability), trending_snapshots (composer source),
// the daily cron, subscriberDocId (dedup). NOTE on publish_queue: that queue is
// bundle→channel (publishToChannel(bundleId)); per-recipient email fan-out is a
// different shape, so we use a thin `campaign_sends` queue that mirrors its proven
// status-machine pattern rather than overloading it (avoids a leaky abstraction).
// Nothing here deletes data.
// ─────────────────────────────────────────────────────────────────
import { getStore } from '@/lib/store/adapter'
import { sendListEmail } from '@/lib/email/notify'
import { subscriberDocId } from '@/lib/newsletter/subscribers'
import { latestTrendingSnapshot } from '@/lib/scam-intel/feed'
import { composeScamDigest } from './digest-copy'
import { composeNewsletterIssue, ISSUE_001 } from './issue-template'

export type CampaignBrand = 'scamcheck' | 'lab' | 'asquare' | 'trustseal'
export type CampaignStatus = 'draft' | 'approved' | 'sending' | 'sent' | 'canceled'

export const CAMPAIGNS = 'campaigns'
export const CAMPAIGN_SENDS = 'campaign_sends'

// brand → subscriber collection to target (reuse existing collections, no new store)
const BRAND_LIST: Record<CampaignBrand, string> = {
  scamcheck: 'newsletter', asquare: 'newsletter', lab: 'lab_subscribers', trustseal: 'subscribers',
}

export interface Campaign {
  id: string
  brand: CampaignBrand
  subject: string
  title: string
  bodyHtml: string
  status: CampaignStatus
  source?: string                 // e.g. trending snapshot id / week key
  createdAt: string
  approvedAt?: string
  approvedBy?: string
  sentAt?: string
  stats?: { recipients?: number; sent?: number; failed?: number }
}

interface SubDoc { email?: string; unsubscribed?: boolean }

const isoWeek = (now: number) => new Date(now).toISOString().slice(0, 10)

// ── Compose + create draft (NEVER sends) ───────────────────────────
/** Build (idempotently) this week's ScamCheck digest DRAFT from trending_snapshots. */
export async function composeWeeklyScamcheckDraft(now: number = Date.now()): Promise<{ created: boolean; id?: string; reason?: string }> {
  const store = getStore()
  const weekId = `scamcheck-weekly-${isoWeek(now)}`
  const existing = await store.get<Campaign>(CAMPAIGNS, weekId)
  if (existing) return { created: false, id: weekId, reason: 'draft-exists' }

  const snap = await latestTrendingSnapshot(12).catch(() => null)
  const composed = composeScamDigest((snap?.items as unknown as { title?: string; category?: string }[]) || [], now)
  if (!composed) return { created: false, reason: 'no-content' }

  const campaign: Campaign = {
    id: weekId, brand: 'scamcheck',
    subject: composed.subject, title: composed.title, bodyHtml: composed.bodyHtml,
    status: 'draft', source: `snapshot:${(snap as { generatedAt?: number })?.generatedAt ?? 'na'}`,
    createdAt: new Date(now).toISOString(),
  }
  await store.set<Campaign>(CAMPAIGNS, weekId, campaign)
  return { created: true, id: weekId }
}

// ── Manual editorial issue (Issue #1) → DRAFT only (never sends) ────
/** Create (idempotently) the ScamCheck Issue #1 campaign DRAFT from ISSUE_001. */
export async function composeIssueOneDraft(now: number = Date.now()): Promise<{ created: boolean; id?: string; reason?: string }> {
  const store = getStore()
  const id = `scamcheck-issue-${ISSUE_001.number}`
  const existing = await store.get<Campaign>(CAMPAIGNS, id)
  // Refresh content ONLY while still a draft. Never overwrite an approved/sending/sent
  // campaign (protects an in-flight send); idempotent for non-draft states.
  if (existing && existing.data.status !== 'draft') return { created: false, id, reason: `not-draft (${existing.data.status})` }
  const c = composeNewsletterIssue(ISSUE_001)
  const campaign: Campaign = {
    id, brand: 'scamcheck', subject: c.subject, title: c.title, bodyHtml: c.bodyHtml,
    status: 'draft', source: `manual:issue-${ISSUE_001.number}`,
    createdAt: existing ? existing.data.createdAt : new Date(now).toISOString(),
  }
  await store.set<Campaign>(CAMPAIGNS, id, campaign)
  return { created: !existing, id, ...(existing ? { reason: 'draft-refreshed' } : {}) }
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const d = await getStore().get<Campaign>(CAMPAIGNS, id)
  return d ? d.data : null
}
export async function listCampaigns(limit = 50): Promise<Campaign[]> {
  const rows = await getStore().query<Campaign>(CAMPAIGNS, { orderBy: { field: 'createdAt', dir: 'desc' }, limit })
  return rows.map((r) => r.data)
}

// ── Approval (draft → approved). Admin only. ───────────────────────
export async function approveCampaign(id: string, actor = 'admin'): Promise<{ ok: boolean; error?: string }> {
  const c = await getCampaign(id)
  if (!c) return { ok: false, error: 'not_found' }
  if (c.status !== 'draft') return { ok: false, error: `not_draft (${c.status})` }
  await getStore().update<Campaign>(CAMPAIGNS, id, { status: 'approved', approvedAt: new Date().toISOString(), approvedBy: actor })
  return { ok: true }
}

// ── Enqueue (approved → sending). Fans recipients into campaign_sends. ──
export async function enqueueCampaign(id: string, maxRecipients = 5000): Promise<{ ok: boolean; recipients?: number; error?: string }> {
  const store = getStore()
  const c = await getCampaign(id)
  if (!c) return { ok: false, error: 'not_found' }
  if (c.status !== 'approved') return { ok: false, error: `not_approved (${c.status})` } // hard gate: never send an unapproved campaign

  const coll = BRAND_LIST[c.brand]
  const subs = await store.query<SubDoc>(coll, { limit: maxRecipients })
  let recipients = 0
  for (const s of subs) {
    const email = (s.data?.email || '').toLowerCase()
    if (!email || s.data?.unsubscribed) continue
    // deterministic id → idempotent (re-enqueue won't duplicate a recipient)
    const sendId = `cs_${id}_${subscriberDocId(email)}`
    const exists = await store.get(CAMPAIGN_SENDS, sendId)
    if (exists) continue
    await store.set(CAMPAIGN_SENDS, sendId, { id: sendId, campaignId: id, email, status: 'queued', createdAt: new Date().toISOString() })
    recipients++
  }
  await store.update<Campaign>(CAMPAIGNS, id, { status: 'sending', stats: { ...(c.stats || {}), recipients } })
  return { ok: true, recipients }
}

// ── Drain (cron). Sends queued recipients; flag-gated; never auto-progresses a draft. ──
export interface SendRunResult { enabled: boolean; processed: number; sent: number; failed: number; campaignsCompleted: number }

export async function processCampaignSends(maxBatch = 80): Promise<SendRunResult> {
  const res: SendRunResult = { enabled: false, processed: 0, sent: 0, failed: 0, campaignsCompleted: 0 }
  if (process.env.WEEKLY_DIGEST_ENABLED !== 'true') return res          // belt: disabled by default
  res.enabled = true
  const store = getStore()

  const queued = await store.query<{ campaignId: string; email: string; status: string }>(
    CAMPAIGN_SENDS, { where: [{ field: 'status', op: '==', value: 'queued' }], limit: maxBatch },
  )
  const touched = new Set<string>()
  for (const row of queued) {
    const { campaignId, email } = row.data
    const c = await getCampaign(campaignId)
    if (!c || c.status !== 'sending') continue   // only send for campaigns explicitly approved+enqueued
    touched.add(campaignId)
    res.processed++
    const r = await sendListEmail({ to: email, subject: c.subject, title: c.title, bodyHtml: c.bodyHtml })
    if (r.ok) { res.sent++; await store.update(CAMPAIGN_SENDS, row.id, { status: 'sent', sentAt: new Date().toISOString() }) }
    else if (r.skipped) { /* no RESEND key — leave queued, retry next run */ }
    else { res.failed++; await store.update(CAMPAIGN_SENDS, row.id, { status: 'failed', error: r.error?.slice(0, 200) }) }
  }

  // mark campaigns done when no queued recipients remain
  for (const cid of touched) {
    const left = await store.query(CAMPAIGN_SENDS, { where: [{ field: 'campaignId', op: '==', value: cid }, { field: 'status', op: '==', value: 'queued' }], limit: 1 })
    if (left.length === 0) { await store.update<Campaign>(CAMPAIGNS, cid, { status: 'sent', sentAt: new Date().toISOString() }); res.campaignsCompleted++ }
  }
  return res
}
