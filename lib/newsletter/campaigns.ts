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

// ── Custom editorial issue → DRAFT only (never sends) ──────────────
/**
 * Create (idempotently) a DRAFT campaign from arbitrary, hand-authored content —
 * for one-off editorial issues that don't fit the fixed ISSUE_001 template. Same
 * draft-first safety as the other composers: refreshes ONLY while still a draft,
 * never touches an approved/sending/sent campaign. Sending still requires the
 * explicit approve → enqueue → drain path below. Nothing here sends anything.
 */
export async function composeCustomIssue(input: { id: string; subject: string; title: string; bodyHtml: string; brand?: CampaignBrand }): Promise<{ created: boolean; id: string; reason?: string }> {
  const store = getStore()
  const id = input.id
  const existing = await store.get<Campaign>(CAMPAIGNS, id)
  if (existing && existing.data.status !== 'draft') return { created: false, id, reason: `not-draft (${existing.data.status})` }
  const campaign: Campaign = {
    id, brand: input.brand || 'scamcheck',
    subject: input.subject, title: input.title, bodyHtml: input.bodyHtml,
    status: 'draft', source: 'manual:custom',
    createdAt: existing ? existing.data.createdAt : new Date().toISOString(),
  }
  await store.set<Campaign>(CAMPAIGNS, id, campaign)
  return { created: !existing, id, ...(existing ? { reason: 'draft-refreshed' } : {}) }
}

// ── Manual drain (admin-triggered) of ONE approved+enqueued campaign ──
/**
 * Send the queued recipients of a single campaign, invoked EXPLICITLY by an admin.
 * Unlike processCampaignSends (the daily cron, gated by WEEKLY_DIGEST_ENABLED), this
 * is a deliberate one-shot for a campaign that was already composed → approved →
 * enqueued (status must be 'sending'), so it does not depend on the cron flag. It
 * still refuses anything not in 'sending' — i.e. never sends without prior approval.
 */
export async function drainCampaign(id: string, maxBatch = 200): Promise<{ ok: boolean; processed: number; sent: number; failed: number; done: boolean; error?: string }> {
  const store = getStore()
  const c = await getCampaign(id)
  if (!c) return { ok: false, processed: 0, sent: 0, failed: 0, done: false, error: 'not_found' }
  if (c.status !== 'sending') return { ok: false, processed: 0, sent: 0, failed: 0, done: false, error: `not_sending (${c.status})` }

  const queued = await store.query<{ campaignId: string; email: string }>(
    CAMPAIGN_SENDS, { where: [{ field: 'campaignId', op: '==', value: id }, { field: 'status', op: '==', value: 'queued' }], limit: maxBatch },
  )
  let sent = 0, failed = 0, processed = 0
  for (let i = 0; i < queued.length; i++) {
    const row = queued[i]
    processed++
    const r = await sendListEmail({ to: row.data.email, subject: c.subject, title: c.title, bodyHtml: c.bodyHtml })
    if (r.ok) { sent++; await store.update(CAMPAIGN_SENDS, row.id, { status: 'sent', sentAt: new Date().toISOString() }) }
    else if (r.skipped) { /* no RESEND key configured — leave queued for a later run */ }
    else { failed++; await store.update(CAMPAIGN_SENDS, row.id, { status: 'failed', error: r.error?.slice(0, 200) }) }
    // Pace under Resend's ~2 req/sec rate limit — bursting causes 429s → failed sends.
    if (i < queued.length - 1) await new Promise((res) => setTimeout(res, 600))
  }
  const left = await store.query(CAMPAIGN_SENDS, { where: [{ field: 'campaignId', op: '==', value: id }, { field: 'status', op: '==', value: 'queued' }], limit: 1 })
  const done = left.length === 0
  if (done) {
    await store.update<Campaign>(CAMPAIGNS, id, { status: 'sent', sentAt: new Date().toISOString(), stats: { ...(c.stats || {}), sent: (c.stats?.sent || 0) + sent, failed: (c.stats?.failed || 0) + failed } })
  }
  return { ok: true, processed, sent, failed, done }
}

/** Reset a campaign's FAILED recipients back to 'queued' so drainCampaign can retry
 *  them (e.g. after a rate-limit batch of 429s). Puts the campaign back to 'sending'.
 *  Never touches 'sent' rows, so retry can't double-send. */
export async function requeueFailedSends(id: string): Promise<{ ok: boolean; requeued: number; error?: string }> {
  const store = getStore()
  const c = await getCampaign(id)
  if (!c) return { ok: false, requeued: 0, error: 'not_found' }
  const failed = await store.query<{ campaignId: string }>(CAMPAIGN_SENDS, { where: [{ field: 'campaignId', op: '==', value: id }, { field: 'status', op: '==', value: 'failed' }], limit: 1000 })
  let requeued = 0
  for (const row of failed) { await store.update(CAMPAIGN_SENDS, row.id, { status: 'queued', error: '' }); requeued++ }
  if (requeued > 0 && c.status !== 'sending') await store.update<Campaign>(CAMPAIGNS, id, { status: 'sending' })
  return { ok: true, requeued }
}

/** Read per-recipient send statuses for a campaign (owner diagnostics; email masked). */
export async function listCampaignSends(id: string, limit = 500): Promise<{ total: number; byStatus: Record<string, number>; rows: { email: string; status: string; error?: string }[] }> {
  const store = getStore()
  const rows = await store.query<{ email?: string; status?: string; error?: string }>(CAMPAIGN_SENDS, { where: [{ field: 'campaignId', op: '==', value: id }], limit })
  const byStatus: Record<string, number> = {}
  const out = rows.map((r) => {
    const st = String(r.data.status || '?'); byStatus[st] = (byStatus[st] || 0) + 1
    const em = String(r.data.email || ''); const mask = (em.split('@')[0] || '').slice(0, 3) + '***@' + (em.split('@')[1] || '?')
    return { email: mask, status: st, error: r.data.error ? String(r.data.error).slice(0, 160) : undefined }
  })
  return { total: rows.length, byStatus, rows: out }
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
