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
// Send-time eligibility (asq-newsletter-send-eligibility-v1): a queue row is only a
// snapshot from enqueue time. Both send loops therefore re-read the recipient's
// CURRENT subscriber record immediately before each delivery and skip — recording
// why on the row — anyone who has since unsubscribed, whose record is gone, or whose
// address is clearly invalid. Rows end as 'sent', 'failed' or 'skipped'; campaign
// totals are counted from the rows. This code never writes to a subscriber record.
// It does NOT act on stored bounce or complaint events (a stored event does not say
// whether a bounce was permanent) and it has no provider suppression data.
//
// Per-campaign exclusions (asq-newsletter-send-safety-v2): a campaign may carry a
// reviewed list of subscriber record ids to leave out, each with a reason, the
// evidence it rests on and the time it was reviewed. The list only ever REMOVES
// recipients, is applied when the queue is built and again before each delivery, and
// is frozen once the campaign is queued. No subscriber record is changed. The code
// decides nothing about who belongs on the list.
//
// Review fixes (asq-newsletter-send-safety-v3):
//   • binding   — the admin route builds a queue only against the `binding` of a
//                 recent preflight: same recipients, same exclusion list. No binding,
//                 no queue (see enqueueCampaign).
//   • one queue — a campaign id gets one queue. Its queue record (store.create)
//                 freezes the exclusion list; the send path reads the list from there.
//                 Rows left under an id by anything else refuse the queue.
//   • identity  — a recipient is an address, not a record: when an address has
//                 several records the strictest of them rules (see selectRecipients).
//   • decisions — requeue-failed and resolve-uncertain re-read each row before
//                 changing it, keep one transition record per attempt, and reopen
//                 the campaign before they touch a row.
//
// Duplicate-send protection (asq-newsletter-send-safety-v2):
//   • run lock      — one run per campaign at a time; a second action is refused
//                     while a run is alive. Each run takes the next number in the
//                     campaign's chain of lock documents (store.create) and marks
//                     its own document released at the end; none is ever deleted.
//   • attempt claim — before a recipient is handed to the provider, the run must
//                     CREATE that attempt's claim document (store.create: the first
//                     caller wins, atomically). No claim, no delivery. A row is
//                     therefore handed to the provider at most once per attempt, by
//                     at most one run, however many runs or retries there are.
//   • outcomes      — 'sent' (provider accepted), 'failed' (provider definitely
//                     refused: safe to retry), 'uncertain' (no definite answer, or a
//                     claim with no recorded outcome). An uncertain recipient may or
//                     may not have been sent to; it is NEVER retried automatically.
//   • provider key  — each delivery carries an Idempotency-Key the provider documents
//                     as honoured for 24 hours. A second line of defence only.
// What this does NOT give: exactly-once delivery. If the provider accepts a message
// and the answer never reaches this code, the row is 'uncertain' and stays so until
// a person resolves it. At-most-once per attempt is what the claim guarantees.
// Like the rest of this file, none of it deletes anything: a lock is marked released,
// an abandoned attempt moves its row to the next attempt number.
//
// Reuse: sendListEmail (PR#9 deliverability), trending_snapshots (composer source),
// the daily cron, subscriberDocId (dedup). NOTE on publish_queue: that queue is
// bundle→channel (publishToChannel(bundleId)); per-recipient email fan-out is a
// different shape, so we use a thin `campaign_sends` queue that mirrors its proven
// status-machine pattern rather than overloading it (avoids a leaky abstraction).
// Nothing here deletes data.
// ─────────────────────────────────────────────────────────────────
import { createHash, randomUUID } from 'node:crypto'
import { getStore, type StoredDoc } from '@/lib/store/adapter'
import { sendListEmail, type ListFooter, type ListRenderOptions } from '@/lib/email/notify'
import { subscriberDocId, normalizeEmail, isValidEmail, clearlyInvalidEmail } from '@/lib/newsletter/subscribers'
import { latestTrendingSnapshot } from '@/lib/scam-intel/feed'
import { composeScamDigest } from './digest-copy'
import { composeNewsletterIssue, ISSUE_001 } from './issue-template'

export type CampaignBrand = 'scamcheck' | 'lab' | 'asquare' | 'trustseal'
export type CampaignStatus = 'draft' | 'approved' | 'sending' | 'sent' | 'canceled'

export const CAMPAIGNS = 'campaigns'
export const CAMPAIGN_SENDS = 'campaign_sends'
/** One document per delivery attempt (`<row id>__a<attempt>`), created before the provider is called. */
export const CAMPAIGN_SEND_CLAIMS = 'campaign_send_claims'
/** One document per run of a campaign (`<campaign id>__run<n>`), kept as a record and marked released when the run ends. */
export const CAMPAIGN_RUN_LOCKS = 'campaign_run_locks'
/** Probe documents written by storeSelfCheck. */
export const STORE_SELFCHECKS = 'store_selfchecks'
/** One document per campaign id (the id itself), created when its queue is first built: the frozen exclusion list and what the queue was bound to. */
export const CAMPAIGN_QUEUES = 'campaign_queues'
/** One document per admin decision that moves a row on: `<row id>__a<attempt>__requeue` or `…__resolve`. */
export const CAMPAIGN_SEND_TRANSITIONS = 'campaign_send_transitions'

/** A run takes no new recipient after this long, so it always ends before its lock expires. */
const RUN_BUDGET_MS = 240_000
/** How long a run lock is honoured. Longer than a run can live (budget above; the hosting limit recorded for this route is 300 s). */
const RUN_LOCK_TTL_MS = 330_000
/** Upper bound on the runs one campaign can have; far above any real number. */
const MAX_RUNS_PER_CAMPAIGN = 1000
/** A claim with no recorded outcome after this long belongs to a run that is certainly dead. */
const CLAIM_STALE_MS = 15 * 60_000
/** The provider documents a 24-hour life for an idempotency key; an hour's margin is left. */
const PROVIDER_KEY_WINDOW_MS = 23 * 60 * 60_000
/** A preflight older than this cannot bind a queue; it has to be taken again. */
const PREFLIGHT_MAX_AGE_MS = 30 * 60_000

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
  canceledAt?: string
  canceledBy?: string
  /** Optional inbox preview line (see ListRenderOptions in lib/email/notify.ts). */
  preheader?: string
  /** Optional footer variant; 'no-link' drops the ScamCheck site link for this campaign only. */
  footer?: ListFooter
  /**
   * Reviewed list of subscriber records to leave out of THIS campaign (see
   * setCampaignExclusions). Subtractive only; frozen once the campaign is queued.
   */
  exclusions?: CampaignExclusion[]
  exclusionsSetAt?: string
  exclusionsSetBy?: string
  /** What the queue was built for (a copy of the queue record's summary, for reading; the queue record is the authority). */
  queuedWith?: { recipients: number; fingerprint: string; exclusionsFingerprint: string; bound: boolean; preflightAt?: string; queuedAt: string }
  /**
   * recipients — rows that exist for the recipients selected by the last enqueue.
   * notQueued — subscribers left out of the queue, by reason. sent / failed /
   * skipped / uncertain — per-recipient outcomes counted from the rows at the end of
   * every run (a skipped recipient is never counted as a failure, a failure that was
   * retried and sent is not a failure, and an uncertain one is neither).
   */
  stats?: { recipients?: number; sent?: number; failed?: number; skipped?: number; uncertain?: number; notQueued?: Partial<Record<NotQueuedReason, number>> }
}

interface SubDoc { email?: string; unsubscribed?: boolean }

/** Why a stored subscriber was left out of a campaign queue. */
export type NotQueuedReason = 'no_email' | 'unsubscribed' | 'invalid_address' | 'excluded' | 'duplicate_address'

/** Why a queued recipient was not sent to. Stored on the row as `skipReason`. */
export type SendSkipReason = 'unsubscribed' | 'not_subscribed' | 'invalid_address' | 'excluded'

/**
 * A campaign_sends row. `subscriberId` is the subscriber document it was queued from.
 * status: queued → sent | failed | skipped | uncertain. `attempt` numbers the delivery
 * attempts (each has its own claim); `keyGen` numbers the provider idempotency keys
 * (a new one only after a definite refusal). Both are 1 when absent.
 * `keyFirstUsedAtMs` is when the row FIRST became uncertain under its current key —
 * the start of that key's life at the provider. It is written once per key and is
 * cleared only when the key itself is replaced.
 */
interface SendRow {
  campaignId: string; email: string; status?: string; subscriberId?: string
  attempt?: number; keyGen?: number; error?: string
  uncertainReason?: string; uncertainAt?: string; attemptedAtMs?: number
  keyFirstUsedAtMs?: number; uncertainRetries?: number; resolution?: string
}

// ── Per-campaign exclusions ────────────────────────────────────────
export const EXCLUSION_REASONS = ['provider_suppression', 'confirmed_permanent_bounce', 'spam_complaint', 'owner_decision'] as const
export type ExclusionReason = typeof EXCLUSION_REASONS[number]

/**
 * One reviewed exclusion. `recordId` is a subscriber record id — the id derived from
 * the address (what the admin listings show) or the stored document id — never an
 * address. `evidence` says what the finding rests on (a file and its hash, a
 * dashboard reading and its date); `reviewedAt` is when a person reviewed it.
 */
export interface CampaignExclusion { recordId: string; reason: ExclusionReason; evidence: string; reviewedAt: string; reviewedBy?: string }

const RECORD_ID_RE = /^[A-Za-z0-9_-]{1,128}$/
const LOOKS_LIKE_ADDRESS = /[^\s@]+@[^\s@]+\.[^\s@]+/
const MAX_EXCLUSIONS = 2000

/** Free text that must say something, fit on a line, and never carry an address. */
function evidenceError(v: unknown): string | null {
  if (typeof v !== 'string' || v.trim().length < 10) return 'evidence_required'
  if (v.length > 500 || /[\u0000-\u001f\u007f]/.test(v)) return 'evidence_malformed'
  if (LOOKS_LIKE_ADDRESS.test(v)) return 'evidence_contains_address'
  return null
}

/** Validate an exclusion list as supplied. Nothing is corrected or dropped: one bad entry refuses the whole list. */
export function validateExclusions(input: unknown, now: number = Date.now()): { ok: true; list: CampaignExclusion[] } | { ok: false; error: string; index?: number } {
  if (!Array.isArray(input)) return { ok: false, error: 'exclusions_must_be_a_list' }
  if (input.length > MAX_EXCLUSIONS) return { ok: false, error: 'too_many_exclusions' }
  const list: CampaignExclusion[] = []
  const seen = new Set<string>()
  for (let index = 0; index < input.length; index++) {
    const e = input[index] as Partial<Record<keyof CampaignExclusion, unknown>> | null
    if (!e || typeof e !== 'object' || Array.isArray(e)) return { ok: false, error: 'entry_malformed', index }
    if (typeof e.recordId !== 'string' || !RECORD_ID_RE.test(e.recordId)) return { ok: false, error: 'record_id_malformed', index }
    if (seen.has(e.recordId)) return { ok: false, error: 'record_id_repeated', index }
    if (!EXCLUSION_REASONS.includes(e.reason as ExclusionReason)) return { ok: false, error: 'reason_unknown', index }
    const ev = evidenceError(e.evidence)
    if (ev) return { ok: false, error: ev, index }
    const at = typeof e.reviewedAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(e.reviewedAt) ? Date.parse(e.reviewedAt) : NaN
    if (!Number.isFinite(at)) return { ok: false, error: 'reviewed_at_required', index }
    if (at > now + 5 * 60_000) return { ok: false, error: 'reviewed_at_in_future', index }
    if (e.reviewedBy !== undefined && (typeof e.reviewedBy !== 'string' || !e.reviewedBy.trim() || e.reviewedBy.length > 80 || LOOKS_LIKE_ADDRESS.test(e.reviewedBy))) return { ok: false, error: 'reviewed_by_malformed', index }
    seen.add(e.recordId)
    list.push({ recordId: e.recordId, reason: e.reason as ExclusionReason, evidence: (e.evidence as string).trim(), reviewedAt: e.reviewedAt as string, ...(e.reviewedBy ? { reviewedBy: (e.reviewedBy as string).trim() } : {}) })
  }
  return { ok: true, list }
}

/** The campaign's exclusions, by record id. Empty for a campaign that has none. */
const exclusionIndex = (c: Campaign): Map<string, CampaignExclusion> => new Map((c.exclusions || []).map((e) => [e.recordId, e]))

/**
 * Replace a campaign's exclusion list (an empty list clears it). Allowed only while
 * the campaign is a draft or approved AND no queue has been built for its id: the
 * queue record freezes the list it was built with, and that frozen copy — not the
 * campaign's — is what the send path reads. Writes the campaign document and
 * nothing else.
 */
export async function setCampaignExclusions(id: string, input: unknown, actor = 'admin'): Promise<{ ok: boolean; count?: number; error?: string; index?: number }> {
  const c = await getCampaign(id)
  if (!c) return { ok: false, error: 'not_found' }
  if (c.status !== 'draft' && c.status !== 'approved') return { ok: false, error: `locked (${c.status})` }
  if (await queueRecordOf(id)) return { ok: false, error: 'locked (queued)' }
  const v = validateExclusions(input)
  if (!v.ok) return v
  await getStore().update<Campaign>(CAMPAIGNS, id, { exclusions: v.list, exclusionsSetAt: new Date().toISOString(), exclusionsSetBy: actor })
  // A queue action may have frozen the list while this was being written. The frozen list is the one that
  // applies; the campaign's copy is put back to it so the two cannot be read as different, and the caller is told.
  const frozen = await queueRecordOf(id)
  if (frozen) {
    await getStore().update<Campaign>(CAMPAIGNS, id, { exclusions: frozen.exclusions })
    return { ok: false, error: 'locked (queued)' }
  }
  return { ok: true, count: v.list.length }
}

/** Rendering options a campaign carries, passed identically to the preview and the real send. Empty when it sets none. */
const renderOptions = (c: Campaign): ListRenderOptions =>
  ({ ...(c.preheader ? { preheader: c.preheader } : {}), ...(c.footer ? { footer: c.footer } : {}) })

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

// ── Cancellation (draft | approved → canceled). Admin only. ──────────
/**
 * Retire a campaign permanently. 'canceled' was already part of CampaignStatus and
 * every send-side guard already rejects it — approve needs 'draft', enqueue needs
 * 'approved', drain and the cron need 'sending', compose refuses non-drafts — so
 * setting it leaves no path to a send. The record and its content are kept.
 *
 * Deliberately refuses:
 *  • 'sent'    — that is delivery history; rewriting it would falsify the record.
 *  • 'sending' — an in-flight campaign may own failed rows, and requeueFailedSends
 *                moves a campaign back to 'sending' when it resets them. Cancelling
 *                one safely would mean changing that send path, which this does not.
 * In the normal lifecycle a draft or approved campaign owns no failed rows (failures
 * are only written while 'sending'), but a status edited back by hand could leave
 * some — so that is checked, read-only, rather than assumed. With no failed rows,
 * requeueFailedSends has nothing to reset, and the cancel is terminal without
 * touching any existing send code. Idempotent: cancelling a canceled campaign is a no-op.
 */
export async function cancelCampaign(id: string, actor = 'admin'): Promise<{ ok: boolean; status?: CampaignStatus; alreadyCanceled?: boolean; error?: string }> {
  const c = await getCampaign(id)
  if (!c) return { ok: false, error: 'not_found' }
  if (c.status === 'canceled') return { ok: true, status: 'canceled', alreadyCanceled: true }
  if (c.status === 'sent') return { ok: false, error: 'already_sent' }
  if (c.status !== 'draft' && c.status !== 'approved') return { ok: false, error: `in_flight (${c.status})` }
  const store = getStore()
  const failed = await store.query(CAMPAIGN_SENDS, { where: [{ field: 'campaignId', op: '==', value: id }, { field: 'status', op: '==', value: 'failed' }], limit: 1 })
  if (failed.length > 0) return { ok: false, error: 'has_failed_sends' }
  await store.update<Campaign>(CAMPAIGNS, id, { status: 'canceled', canceledAt: new Date().toISOString(), canceledBy: actor })
  return { ok: true, status: 'canceled' }
}

// ── Single-recipient TEST send. Admin only. ──────────────────────────
/** Addresses allowed to receive a test send: NEWSLETTER_TEST_RECIPIENTS, comma-separated. Read per call. */
function testRecipientAllowlist(): Set<string> {
  return new Set((process.env.NEWSLETTER_TEST_RECIPIENTS || '').split(',').map(normalizeEmail).filter(Boolean))
}

/**
 * Send ONE preview of a campaign to ONE allowlisted address, so the real rendered
 * email — brand shell, List-Unsubscribe, footer, Reply-To — can be inspected before
 * any broadcast. It is isolated from the broadcast path by construction:
 *  • the recipient is validated BEFORE the store is touched at all;
 *  • it reads only the named campaign — never a subscriber collection, never
 *    campaign_sends — and writes nothing: no queue row, no status, no stats;
 *  • the subject is prefixed "[TEST]" and no campaignId is passed, so provider
 *    events from a preview never count toward the campaign's attribution.
 * Works in any status, so a draft can be previewed before it is approved.
 */
export async function sendCampaignTest(id: string, to: unknown): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (typeof to !== 'string' || !to.trim()) return { ok: false, error: 'recipient_required' }
  if (/[,;\s]/.test(to.trim())) return { ok: false, error: 'single_recipient_only' }
  const email = normalizeEmail(to)
  if (!isValidEmail(email)) return { ok: false, error: 'invalid_recipient' }
  const allow = testRecipientAllowlist()
  if (allow.size === 0) return { ok: false, error: 'test_recipients_not_configured' }
  if (!allow.has(email)) return { ok: false, error: 'recipient_not_allowlisted' }

  const c = await getCampaign(id)
  if (!c) return { ok: false, error: 'not_found' }
  const r = await sendListEmail({ to: email, subject: `[TEST] ${c.subject}`, title: c.title, bodyHtml: c.bodyHtml, ...renderOptions(c) })
  return { ok: r.ok, ...(r.skipped ? { skipped: true } : {}), ...(r.error ? { error: r.error } : {}) }
}

// ── Recipient selection (shared by the preflight and the enqueue) ──
type ExclusionEffect = 'applied' | NotQueuedReason | 'no_matching_record' | 'ambiguous'

interface Selection {
  /** Recipients a queue would hold, in list order. `id` is the address-derived record id (also the tail of the row id). */
  recipients: { id: string; email: string; subscriberId: string }[]
  /** Records left out, by reason. Every record read is counted exactly once, here or as a recipient. */
  notQueued: Partial<Record<NotQueuedReason, number>>
  /** What each exclusion did — 'applied' only when it removed an address that was otherwise eligible. */
  exclusionEffects: Map<string, ExclusionEffect>
  /** The addresses (as address-derived ids) the list excludes, resolved against the records read. Frozen with the queue. */
  excludedIdentities: string[]
  /** Exclusions that cannot be tied to exactly one address. Any entry here refuses the queue. */
  ambiguous: string[]
  /** Exclusions that match no subscriber record at all, so they exclude nobody. Any entry here refuses a new queue. */
  unmatched: string[]
  /** Addresses held by more than one record. */
  duplicateAddresses: number
}

/**
 * Decide, from the CURRENT subscriber records, who a queue for this campaign would
 * hold. Pure: nothing is read or written here.
 *
 * IDENTITY. A recipient is an ADDRESS, not a record. Two records are the same
 * recipient when their addresses are equal after normalizeEmail — surrounding
 * whitespace removed, then lower-cased — which is exactly what subscriberDocId hashes,
 * so the identity of an address IS its address-derived record id. Nothing else is
 * folded: no dots or "+tags" are removed, no Unicode or domain forms are unified.
 * Addresses that differ after that step are different recipients here even if a mail
 * provider would deliver them to one inbox.
 *
 * ONE RULING PER ADDRESS. When an address has several records, the strictest of them
 * rules all of them: unsubscribed on any record, or excluded through any record,
 * leaves the whole address out. A second record can therefore never keep an address
 * eligible that another of its records rules out. No record is merged or changed.
 *
 * EXCLUSIONS name a record by its address-derived id or by its stored document id;
 * either way the exclusion applies to the address. An exclusion that could mean two
 * different addresses is 'ambiguous' and is never guessed at: the queue is refused.
 * Reasons are reported strongest first — a blank address, an unsubscribe and an
 * invalid address are reported as such even when the address is also excluded, so an
 * exclusion never hides one of them. An exclusion can only remove; nothing adds.
 * (/api/admin/newsletter-metrics mirrors the first three rules for its audience count.)
 */
function selectRecipients(list: CampaignExclusion[], subs: StoredDoc<SubDoc>[]): Selection {
  const sel: Selection = { recipients: [], notQueued: {}, exclusionEffects: new Map(), excludedIdentities: [], ambiguous: [], unmatched: [], duplicateAddresses: 0 }
  const leaveOut = (reason: NotQueuedReason, n: number) => { sel.notQueued[reason] = (sel.notQueued[reason] || 0) + n }

  // 1 · group the records by address
  const groups = new Map<string, { email: string; records: StoredDoc<SubDoc>[]; unsubscribed: boolean }>()
  const identityOfStoredId = new Map<string, string>()
  const blankIds = new Set<string>()
  for (const s of subs) {
    const raw = (s.data?.email || '').toLowerCase()
    if (!raw) { leaveOut('no_email', 1); blankIds.add(s.id); continue }
    const email = normalizeEmail(raw)
    const identity = subscriberDocId(email)
    let g = groups.get(identity)
    if (!g) { g = { email, records: [], unsubscribed: false }; groups.set(identity, g) }
    g.records.push(s)
    if (s.data?.unsubscribed) g.unsubscribed = true
    identityOfStoredId.set(s.id, identity)
  }

  // 2 · tie each exclusion to exactly one address
  const namedBy = new Map<string, string[]>()   // address → the exclusion ids that resolve to it
  for (const e of list) {
    const hits = new Set<string>()
    if (groups.has(e.recordId)) hits.add(e.recordId)                 // it is an address-derived id
    const viaStored = identityOfStoredId.get(e.recordId)
    if (viaStored) hits.add(viaStored)                                // it is a stored document id
    if (hits.size > 1) { sel.ambiguous.push(e.recordId); sel.exclusionEffects.set(e.recordId, 'ambiguous'); continue }
    if (hits.size === 0) {
      sel.exclusionEffects.set(e.recordId, blankIds.has(e.recordId) ? 'no_email' : 'no_matching_record')
      if (!blankIds.has(e.recordId)) sel.unmatched.push(e.recordId)
      continue
    }
    const identity = [...hits][0]
    namedBy.set(identity, [...(namedBy.get(identity) || []), e.recordId])
  }

  // 3 · one ruling per address
  for (const [identity, g] of groups) {
    const named = namedBy.get(identity)
    const reason: NotQueuedReason | null =
      g.unsubscribed ? 'unsubscribed'
      : clearlyInvalidEmail(g.email) ? 'invalid_address'
      : named ? 'excluded'
      : null
    if (named) {
      sel.excludedIdentities.push(identity)
      for (const recordId of named) sel.exclusionEffects.set(recordId, reason === 'excluded' ? 'applied' : (reason as NotQueuedReason))
    }
    if (g.records.length > 1) sel.duplicateAddresses++
    if (reason) { leaveOut(reason, g.records.length); continue }
    if (g.records.length > 1) leaveOut('duplicate_address', g.records.length - 1)
    sel.recipients.push({ id: identity, email: g.email, subscriberId: g.records[0].id })
  }
  return sel
}

/** Order-independent fingerprint of a recipient set: SHA-256 over the sorted record ids. No address goes into it. */
const recipientFingerprint = (ids: string[]): string => createHash('sha256').update([...ids].sort().join('\n')).digest('hex')

/** Fingerprint of an exclusion list as reviewed: every field of every entry, in id order. An empty or absent list has one fixed value. */
const exclusionsFingerprint = (list: CampaignExclusion[]): string =>
  createHash('sha256').update(JSON.stringify(
    [...list].sort((a, b) => (a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0))
      .map((e) => [e.recordId, e.reason, e.evidence, e.reviewedAt, e.reviewedBy || '']),
  )).digest('hex')

/**
 * What a queue is bound to: the four values a preflight returns as `binding`. A queue
 * is built only if a selection made at that moment gives the same recipient count and
 * fingerprint, the exclusion list is the one that was preflighted, and the preflight
 * is recent.
 */
export interface QueueBinding { recipients: number; fingerprint: string; exclusionsFingerprint: string; preflightAt: string }

/**
 * The record of a campaign id's queue, created (store.create) the first time a queue
 * is built for that id and never rewritten. It is what freezes the exclusion list —
 * the send path reads the list from here, not from the campaign — and what makes a
 * campaign id usable for one queue only.
 */
interface QueueRecord {
  campaignId: string; campaignCreatedAt: string
  recipients: number; fingerprint: string
  exclusionsFingerprint: string; exclusions: CampaignExclusion[]; excludedIdentities: string[]
  bound: boolean; preflightAt?: string; queuedAt: string
}

const queueRecordOf = async (campaignId: string): Promise<QueueRecord | null> =>
  (await getStore().get<QueueRecord>(CAMPAIGN_QUEUES, campaignId))?.data ?? null

const hasRows = async (campaignId: string): Promise<boolean> =>
  (await getStore().query(CAMPAIGN_SENDS, { where: [{ field: 'campaignId', op: '==', value: campaignId }], limit: 1 })).length > 0

export interface RecipientPreview {
  ok: boolean; error?: string
  campaignId?: string; status?: CampaignStatus
  /** Subscriber records read. */
  records?: number
  /** Recipients a queue built now would hold, and their fingerprint. */
  recipients?: number; fingerprint?: string
  /** Fingerprint of the exclusion list this preflight used. */
  exclusionsFingerprint?: string
  /** What the `send` action must be given, unchanged, as `expect`. Absent while something blocks the queue. */
  binding?: QueueBinding
  /** Why a queue could not be built now, whatever binding is presented. Empty when nothing blocks it. */
  blockers?: { kind: 'exclusion_ambiguous' | 'exclusion_unmatched' | 'campaign_id_in_use' | 'queue_exists_for_other_recipients'; recordId?: string }[]
  notQueued?: Partial<Record<NotQueuedReason, number>>
  /** The record ids behind `recipients`, sorted. Ids only, never addresses. */
  recipientIds?: string[]
  /** Every exclusion that applies and what it did. */
  exclusions?: { recordId: string; reason: ExclusionReason; reviewedAt: string; effect: ExclusionEffect }[]
  /** Addresses held by more than one record. Each is ruled by the strictest of its records. */
  duplicateAddresses?: number
  /** Rows that already exist for this campaign id (0 unless it was queued before). */
  rowsAlreadyQueued?: number
  /** True once a queue has been built for this id: the exclusion list shown is then the frozen one. */
  queued?: boolean
  /** True when the read hit its limit and the figures may be incomplete. */
  truncated?: boolean
}

/**
 * READ-ONLY preflight: what a queue for this campaign would hold if it were built
 * now. Runs the same selection as enqueueCampaign, so its `binding` is exactly what
 * `send` would compute a moment later — which lets the list be reviewed, and compared
 * with a provider export by record id, BEFORE queueing (a queued campaign cannot be
 * cancelled). Writes nothing.
 */
export async function previewRecipients(id: string, maxRecipients = 5000): Promise<RecipientPreview> {
  const store = getStore()
  const c = await getCampaign(id)
  if (!c) return { ok: false, error: 'not_found' }
  const subs = await store.query<SubDoc>(BRAND_LIST[c.brand], { limit: maxRecipients })
  const record = await queueRecordOf(id)
  const list = record ? record.exclusions : (c.exclusions || [])
  const sel = selectRecipients(list, subs)
  const ids = sel.recipients.map((r) => r.id).sort()
  const fingerprint = recipientFingerprint(ids)
  const exFp = exclusionsFingerprint(list)
  const rows = await store.query(CAMPAIGN_SENDS, { where: [{ field: 'campaignId', op: '==', value: id }], limit: 10000 })
  const blockers: NonNullable<RecipientPreview['blockers']> = sel.ambiguous.map((recordId) => ({ kind: 'exclusion_ambiguous' as const, recordId }))
  // An exclusion that matches no record excludes nobody: a new queue is not built until the list is corrected.
  if (!record) for (const recordId of sel.unmatched) blockers.push({ kind: 'exclusion_unmatched', recordId })
  // Rows without a queue record, or a queue record made for another campaign, mean the id was used before.
  const own = !!record && record.campaignCreatedAt === (c.createdAt || '')
  if ((rows.length > 0 && !record) || (record && !own)) blockers.push({ kind: 'campaign_id_in_use' })
  // This campaign's own queue exists, but the people selected now are not the people it was built for.
  else if (record && (record.fingerprint !== fingerprint || record.exclusionsFingerprint !== exFp)) blockers.push({ kind: 'queue_exists_for_other_recipients' })
  return {
    ok: true, campaignId: id, status: c.status, records: subs.length,
    recipients: ids.length, fingerprint, exclusionsFingerprint: exFp,
    ...(blockers.length ? {} : { binding: { recipients: ids.length, fingerprint, exclusionsFingerprint: exFp, preflightAt: new Date().toISOString() } }),
    blockers,
    notQueued: sel.notQueued, recipientIds: ids,
    exclusions: list.map((e) => ({ recordId: e.recordId, reason: e.reason, reviewedAt: e.reviewedAt, effect: sel.exclusionEffects.get(e.recordId) || 'no_matching_record' })),
    duplicateAddresses: sel.duplicateAddresses,
    rowsAlreadyQueued: rows.length, queued: !!record, truncated: subs.length >= maxRecipients,
  }
}

// ── Enqueue (approved → sending). Fans recipients into campaign_sends. ──
export interface EnqueueResult {
  ok: boolean; error?: string
  recipients?: number; alreadyQueued?: number
  notQueued?: Partial<Record<NotQueuedReason, number>>
  fingerprint?: string; exclusionsFingerprint?: string
  /** Whether the queue was built against a preflight binding. */
  bound?: boolean
  /** With error 'identity_ambiguous': the exclusion ids that could not be tied to one address. */
  ambiguous?: string[]
  /** With error 'exclusion_unmatched': the exclusion ids that match no subscriber record. */
  unmatched?: string[]
}

/** Is `b` a complete, well-formed binding? Shape only. */
const wellFormedBinding = (b: unknown): b is QueueBinding => {
  const x = b as Partial<Record<keyof QueueBinding, unknown>> | null
  return !!x && typeof x === 'object' && !Array.isArray(x)
    && Number.isInteger(x.recipients) && (x.recipients as number) >= 0
    && typeof x.fingerprint === 'string' && /^[0-9a-f]{64}$/.test(x.fingerprint)
    && typeof x.exclusionsFingerprint === 'string' && /^[0-9a-f]{64}$/.test(x.exclusionsFingerprint)
    && typeof x.preflightAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(x.preflightAt) && Number.isFinite(Date.parse(x.preflightAt))
}

/**
 * Build the queue for an approved campaign. Nothing is written unless every check
 * below passes; a refusal leaves the campaign approved and returns the current values.
 *
 *  1. BINDING. `expect` is the `binding` of a preflight. The admin route requires it
 *     for every campaign. This function also refuses to go on without it whenever the
 *     campaign carries an exclusion list. (It can still be called without one, from
 *     code, for a campaign that has no list: an existing test does, and no other
 *     caller exists.) A binding is refused when it is malformed, when its preflight
 *     is older than PREFLIGHT_MAX_AGE_MS or dated in the future, when the exclusion
 *     list is not the one preflighted, or when the recipients selected now differ in
 *     number or identity.
 *  2. IDENTITY. An exclusion that could mean two addresses refuses the queue.
 *  3. THE CAMPAIGN ID. An id gets one queue. Rows that exist under the id without
 *     a queue record, or a queue record made for another campaign, refuse the queue
 *     ('campaign_id_in_use'): old rows are never taken over. So does this campaign's
 *     own queue record when the people selected now are not the people it was built
 *     for ('queue_exists_for_other_recipients'): a half-built queue is completed for
 *     the same list or not at all. The queue record is created with store.create, so
 *     of two queue actions arriving together one creates it and the other can only
 *     join that same queue.
 *  4. THE ROWS. Created with store.create: a row that exists is never overwritten.
 */
export async function enqueueCampaign(id: string, maxRecipients = 5000, expect?: QueueBinding): Promise<EnqueueResult> {
  const store = getStore()
  const c = await getCampaign(id)
  if (!c) return { ok: false, error: 'not_found' }
  if (c.status !== 'approved') return { ok: false, error: `not_approved (${c.status})` } // hard gate: never send an unapproved campaign

  const coll = BRAND_LIST[c.brand]
  const subs = await store.query<SubDoc>(coll, { limit: maxRecipients })
  const existing = await queueRecordOf(id)
  // The list that counts is the one frozen when this id was first queued; before that, the campaign's own.
  const list = existing ? existing.exclusions : (c.exclusions || [])
  // Left out of the queue and counted by reason. No subscriber record is touched.
  const sel = selectRecipients(list, subs)
  const fingerprint = recipientFingerprint(sel.recipients.map((r) => r.id))
  const exFp = exclusionsFingerprint(list)
  const current = { recipients: sel.recipients.length, notQueued: sel.notQueued, fingerprint, exclusionsFingerprint: exFp }

  // 1 · the binding
  if (expect === undefined || expect === null) {
    if (c.exclusions !== undefined || list.length > 0) return { ok: false, error: 'binding_required', ...current }
  } else {
    if (!wellFormedBinding(expect)) return { ok: false, error: 'invalid_binding', ...current }
    const age = Date.now() - Date.parse(expect.preflightAt)
    if (age > PREFLIGHT_MAX_AGE_MS || age < -5 * 60_000) return { ok: false, error: 'binding_stale', ...current }
    if (expect.exclusionsFingerprint !== exFp) return { ok: false, error: 'exclusions_changed', ...current }
    if (expect.recipients !== sel.recipients.length || expect.fingerprint !== fingerprint) return { ok: false, error: 'recipient_set_changed', ...current }
  }

  // 2 · identity
  if (sel.ambiguous.length > 0) return { ok: false, error: 'identity_ambiguous', ambiguous: sel.ambiguous, ...current }
  // An exclusion that matches no subscriber record would exclude nobody while looking as if it did. A NEW
  // queue is refused until the list is corrected. (Completing this campaign's own half-built queue is not held
  // up by a record deleted since: its list is frozen, and its recipients are checked against the queue record.)
  if (!existing && sel.unmatched.length > 0) return { ok: false, error: 'exclusion_unmatched', unmatched: sel.unmatched, ...current }

  // 3 · the campaign id
  const createdAt = c.createdAt || ''
  let record = existing
  if (!record) {
    if (await hasRows(id)) return { ok: false, error: 'campaign_id_in_use', ...current }
    const fresh: QueueRecord = {
      campaignId: id, campaignCreatedAt: createdAt, recipients: sel.recipients.length, fingerprint,
      exclusionsFingerprint: exFp, exclusions: list, excludedIdentities: sel.excludedIdentities,
      bound: !!expect, ...(expect ? { preflightAt: expect.preflightAt } : {}), queuedAt: new Date().toISOString(),
    }
    record = (await store.create(CAMPAIGN_QUEUES, id, fresh)) ? fresh : await queueRecordOf(id)   // lost to a queue action that arrived with this one
  }
  if (!record || record.campaignCreatedAt !== createdAt) return { ok: false, error: 'campaign_id_in_use', ...current }
  if (record.fingerprint !== fingerprint || record.exclusionsFingerprint !== exFp) return { ok: false, error: 'queue_exists_for_other_recipients', ...current }

  // 4 · the rows
  let recipients = 0, alreadyQueued = 0
  for (const { email, subscriberId } of sel.recipients) {
    // deterministic id → idempotent (re-enqueue won't duplicate a recipient). create,
    // not get-then-set: a row that exists is never overwritten, whatever its status,
    // even when two enqueue actions run at the same moment.
    const sendId = `cs_${id}_${subscriberDocId(email)}`
    if (await store.create(CAMPAIGN_SENDS, sendId, { id: sendId, campaignId: id, email, subscriberId, status: 'queued', attempt: 1, keyGen: 1, createdAt: new Date().toISOString() })) recipients++
    else alreadyQueued++
  }
  await store.update<Campaign>(CAMPAIGNS, id, {
    status: 'sending',
    // The campaign's copy of the list is put back to the frozen one, so the two can never be read as different.
    ...(c.exclusions !== undefined || record.exclusions.length > 0 ? { exclusions: record.exclusions } : {}),
    queuedWith: { recipients: record.recipients, fingerprint: record.fingerprint, exclusionsFingerprint: record.exclusionsFingerprint, bound: record.bound, ...(record.preflightAt ? { preflightAt: record.preflightAt } : {}), queuedAt: record.queuedAt },
    stats: { ...(c.stats || {}), recipients: recipients + alreadyQueued, notQueued: sel.notQueued },
  })
  return { ok: true, recipients, notQueued: sel.notQueued, fingerprint, exclusionsFingerprint: exFp, bound: record.bound, ...(alreadyQueued ? { alreadyQueued } : {}) }
}

// ── Send-time eligibility ──────────────────────────────────────────
/**
 * The check made immediately before each delivery. Re-reads the recipient's CURRENT
 * subscriber record — never the queue row's snapshot — and returns why this recipient
 * must not be sent to, or null. The unsubscribe link marks the record stored under
 * the id derived from the address, so that record is always read; when the row was
 * queued from a record stored under a different id, that one is read as well.
 * The exclusion list is consulted LAST, so it can add a reason not to send but never
 * replaces an invalid address, an unsubscribe or a missing record. The list used is
 * the one FROZEN in the campaign's queue record — the addresses it excluded when the
 * queue was built — so nothing written to the campaign afterwards can change who is
 * sent to. (A queue built before queue records existed has none; the campaign's own
 * list is then matched by either id, as before.)
 * Read-only: no subscriber record, event or timestamp is written here.
 */
async function sendSkipReason(c: Campaign, row: SendRow, queue: QueueRecord | null): Promise<SendSkipReason | null> {
  if (clearlyInvalidEmail(row.email)) return 'invalid_address'
  const store = getStore()
  const coll = BRAND_LIST[c.brand]
  const ids = [subscriberDocId(row.email)]
  if (row.subscriberId && row.subscriberId !== ids[0]) ids.push(row.subscriberId)
  let found = false
  for (const sid of ids) {
    const doc = await store.get<SubDoc>(coll, sid)
    if (!doc) continue
    found = true
    if (doc.data?.unsubscribed) return 'unsubscribed'
  }
  if (!found) return 'not_subscribed'
  if (queue) return queue.excludedIdentities.includes(ids[0]) ? 'excluded' : null
  const excluded = exclusionIndex(c)
  return ids.some((sid) => excluded.has(sid)) ? 'excluded' : null
}

/**
 * Run that check for one queued row. If the recipient is no longer eligible, mark the
 * row 'skipped' with the reason and return it; the caller then makes no delivery
 * attempt. Shared by both send loops so they cannot diverge. A skip is not a failure.
 * If the check itself fails (a store error), nothing has been handed to the provider,
 * so the attempt is abandoned before the error is passed on: a later run can then
 * take this recipient normally instead of finding it claimed with no outcome.
 */
async function skipIfIneligible(c: Campaign, row: { id: string; data: SendRow }, queue: QueueRecord | null): Promise<SendSkipReason | null> {
  try {
    const reason = await sendSkipReason(c, row.data, queue)
    if (reason) await getStore().update(CAMPAIGN_SENDS, row.id, { status: 'skipped', skipReason: reason, skippedAt: new Date().toISOString() })
    return reason
  } catch (err) {
    await abandonAttempt(row)
    throw err
  }
}

// ── Duplicate-send protection ──────────────────────────────────────
type RunLock = { ok: true; runId: string; lockId: string } | { ok: false; retryAfterSeconds: number }
interface RunLockDoc { runId?: string; expiresAtMs?: number; releasedAt?: string }

/**
 * Take the run lock for a campaign, or say how long the current holder may still run.
 * A campaign's lock documents form a numbered chain. A number is spent once its run
 * has released it or its time has run out; a run takes the first number that is
 * free, and it takes it with store.create — so of two runs arriving together exactly
 * one gets the number and the other finds a live lock in front of it. A live lock
 * anywhere in the chain refuses the caller. Nothing is deleted or overwritten.
 * (A run that outlives its lock's time — it should not, see RUN_BUDGET_MS — could
 * find a second run beside it; the attempt claim below is what keeps either of them
 * from handing the same recipient to the provider twice.)
 */
async function acquireRunLock(campaignId: string): Promise<RunLock> {
  const store = getStore()
  const runId = randomUUID()
  for (let n = 1; n <= MAX_RUNS_PER_CAMPAIGN; n++) {
    const lockId = `${campaignId}__run${n}`
    let cur = await store.get<RunLockDoc>(CAMPAIGN_RUN_LOCKS, lockId)
    if (!cur) {
      const now = Date.now()
      if (await store.create(CAMPAIGN_RUN_LOCKS, lockId, { campaignId, run: n, runId, startedAt: new Date(now).toISOString(), expiresAtMs: now + RUN_LOCK_TTL_MS })) return { ok: true, runId, lockId }
      cur = await store.get<RunLockDoc>(CAMPAIGN_RUN_LOCKS, lockId)   // another run took this number first
    }
    const left = (cur?.data.expiresAtMs || 0) - Date.now()
    if (cur && !cur.data.releasedAt && left > 0) return { ok: false, retryAfterSeconds: Math.ceil(left / 1000) }
  }
  return { ok: false, retryAfterSeconds: 60 }
}

/** Mark this run's own lock document released. Never throws: an unreleased lock simply runs out of time. */
async function releaseRunLock(lock: { lockId: string }): Promise<void> {
  try { await getStore().update(CAMPAIGN_RUN_LOCKS, lock.lockId, { releasedAt: new Date().toISOString() }) } catch { /* expires by itself */ }
}

const claimIdOf = (row: { id: string; data: SendRow }): string => `${row.id}__a${row.data.attempt || 1}`

/**
 * Abandon a claimed attempt for which the provider was NOT contacted: the row moves
 * to the next attempt number, so a later run can claim it afresh. The spent claim
 * stays as a record. Never throws — if this write fails the row simply stays claimed
 * and, with no outcome ever recorded for it, ages into 'uncertain'.
 */
async function abandonAttempt(row: { id: string; data: SendRow }): Promise<void> {
  try { await getStore().update(CAMPAIGN_SENDS, row.id, { attempt: (row.data.attempt || 1) + 1 }) } catch { /* see above */ }
}

/**
 * Claim one delivery attempt. 'claimed' — this run, and only this run, may now hand
 * the recipient to the provider. 'held' — another run claimed this attempt recently
 * and may still be working on it: leave the row alone. 'uncertain' — it was claimed
 * long ago and no outcome was ever recorded, so the run that held it died somewhere
 * between claiming and recording; whether the provider received the message is not
 * known, and the row is marked so that nothing sends to it again by itself.
 */
async function claimAttempt(row: { id: string; data: SendRow }, runId: string): Promise<'claimed' | 'held' | 'uncertain'> {
  const store = getStore()
  const now = Date.now()
  const id = claimIdOf(row)
  if (await store.create(CAMPAIGN_SEND_CLAIMS, id, { sendId: row.id, campaignId: row.data.campaignId, attempt: row.data.attempt || 1, runId, claimedAt: new Date(now).toISOString(), claimedAtMs: now })) return 'claimed'
  const held = await store.get<{ claimedAtMs?: number }>(CAMPAIGN_SEND_CLAIMS, id)
  if (!held || now - (held.data.claimedAtMs || 0) < CLAIM_STALE_MS) return 'held'
  const cur = await store.get<SendRow>(CAMPAIGN_SENDS, row.id)
  if (cur?.data.status !== 'queued') return 'held'   // its outcome has been recorded since this run read the queue
  await store.update(CAMPAIGN_SENDS, row.id, { status: 'uncertain', uncertainReason: 'no_outcome_recorded', uncertainAt: new Date(now).toISOString(), attemptedAtMs: held.data.claimedAtMs || 0, keyFirstUsedAtMs: cur.data.keyFirstUsedAtMs || held.data.claimedAtMs || 0 })
  return 'uncertain'
}

/**
 * The key sent to the provider with a delivery: the same for every attempt on a row
 * until the provider DEFINITELY refuses one (requeueFailedSends then moves to a new
 * key, because the provider does not say whether a refused request is remembered
 * against its key). A retry of an uncertain attempt deliberately reuses the key.
 */
function deliveryKey(row: { id: string; data: SendRow }): string {
  const key = `${row.id}/k${row.data.keyGen || 1}`
  return key.length <= 256 ? key : `asq-nl/${createHash('sha256').update(key).digest('hex')}`
}

/**
 * Only a 4xx answer proves the provider did not take the message — except 408 and 409
 * (409 is how it answers a key that is in flight or was used with another body).
 * No answer at all, or a 5xx, proves nothing either way.
 */
const definiteRefusal = (status?: number): boolean => typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 409

type DeliveryOutcome = 'sent' | 'failed' | 'uncertain' | 'deferred'

/** Record what the provider answered for a claimed attempt. Shared by both send loops. */
async function recordOutcome(row: { id: string; data: SendRow }, r: { ok: boolean; skipped?: boolean; status?: number; error?: string }): Promise<DeliveryOutcome> {
  const store = getStore()
  if (r.ok) { await store.update(CAMPAIGN_SENDS, row.id, { status: 'sent', sentAt: new Date().toISOString() }); return 'sent' }
  // No provider key configured: no request was made, so the attempt is abandoned and the row stays queued for a later run.
  if (r.skipped) { await abandonAttempt(row); return 'deferred' }
  if (definiteRefusal(r.status)) {
    // A refusal settles THIS attempt only. If an earlier attempt under the same key ended uncertain (the row
    // records that key's first use), the provider may already hold the message. The row then goes back to
    // 'uncertain' — never to 'failed', where requeue-failed would give it a new key — and only an explicit,
    // recorded decision (resolveUncertain) can send to this recipient again.
    if (row.data.keyFirstUsedAtMs) {
      await store.update(CAMPAIGN_SENDS, row.id, { status: 'uncertain', uncertainReason: 'refused_after_uncertain', uncertainAt: new Date().toISOString(), attemptedAtMs: Date.now(), error: r.error?.slice(0, 200) })
      return 'uncertain'
    }
    await store.update(CAMPAIGN_SENDS, row.id, { status: 'failed', error: r.error?.slice(0, 200) }); return 'failed'
  }
  const now = Date.now()
  await store.update(CAMPAIGN_SENDS, row.id, { status: 'uncertain', uncertainReason: 'no_definite_answer', uncertainAt: new Date(now).toISOString(), attemptedAtMs: now, keyFirstUsedAtMs: row.data.keyFirstUsedAtMs || now, error: (r.error || (r.status ? `HTTP ${r.status}` : 'no response')).slice(0, 200) })
  return 'uncertain'
}

type RowCounts = { queued: number; sent: number; failed: number; skipped: number; uncertain: number }

/** Count a campaign's rows by status. */
async function countRows(campaignId: string): Promise<RowCounts> {
  const rows = await getStore().query<{ status?: string }>(CAMPAIGN_SENDS, { where: [{ field: 'campaignId', op: '==', value: campaignId }], limit: 10000 })
  const n: RowCounts = { queued: 0, sent: 0, failed: 0, skipped: 0, uncertain: 0 }
  for (const r of rows) { const st = r.data.status; if (st === 'queued' || st === 'sent' || st === 'failed' || st === 'skipped' || st === 'uncertain') n[st]++ }
  return n
}

const statsFrom = (c: Campaign, n: RowCounts): NonNullable<Campaign['stats']> => {
  const base: NonNullable<Campaign['stats']> = { ...(c.stats || {}) }
  delete base.uncertain
  return { ...base, sent: n.sent, failed: n.failed, skipped: n.skipped, ...(n.uncertain ? { uncertain: n.uncertain } : {}) }
}

/**
 * End of a run: write the campaign's totals as counted from its rows — never as
 * accumulated per run — and mark it 'sent' once no recipient is left queued. A
 * campaign with rows still queued stays 'sending'. Returns whether it is done.
 */
async function settleCampaign(c: Campaign): Promise<{ done: boolean; counts: RowCounts }> {
  const counts = await countRows(c.id)
  const stats = statsFrom(c, counts)
  if (counts.queued > 0) {
    await getStore().update<Campaign>(CAMPAIGNS, c.id, { stats })
    return { done: false, counts }
  }
  await getStore().update<Campaign>(CAMPAIGNS, c.id, { status: 'sent', sentAt: new Date().toISOString(), stats })
  return { done: true, counts }
}

// ── Custom editorial issue → DRAFT only (never sends) ──────────────
/**
 * Create a DRAFT campaign from arbitrary, hand-authored content — for one-off
 * editorial issues that don't fit the fixed ISSUE_001 template. Same draft-first
 * safety as the other composers: never touches an approved/sending/sent campaign.
 * Sending still requires the explicit approve → enqueue → drain path below. Nothing
 * here sends anything.
 *
 * A campaign id is never taken over silently:
 *  • a NEW id is created with store.create, so of two requests arriving together for
 *    the same id exactly one creates the campaign and the other is told it is in use;
 *  • an id under which queue rows or a queue record already exist is refused;
 *  • an id that already holds a DRAFT is refused unless `replaceDraft` is true, which
 *    is the explicit way to revise a draft's content (its exclusion list is kept).
 */
export async function composeCustomIssue(input: { id: string; subject: string; title: string; bodyHtml: string; brand?: CampaignBrand; replaceDraft?: boolean } & ListRenderOptions): Promise<{ created: boolean; id: string; reason?: string }> {
  const store = getStore()
  const id = input.id
  const existing = await store.get<Campaign>(CAMPAIGNS, id)
  if (existing && existing.data.status !== 'draft') return { created: false, id, reason: `not-draft (${existing.data.status})` }
  if (existing && input.replaceDraft !== true) return { created: false, id, reason: 'id-in-use (draft)' }
  if (!existing && ((await queueRecordOf(id)) || (await hasRows(id)))) return { created: false, id, reason: 'id-in-use (queue)' }
  const campaign: Campaign = {
    id, brand: input.brand || 'scamcheck',
    subject: input.subject, title: input.title, bodyHtml: input.bodyHtml,
    status: 'draft', source: 'manual:custom',
    createdAt: existing ? existing.data.createdAt : new Date().toISOString(),
    // Stored only when given, so a campaign that sets neither is exactly what it was.
    ...(input.preheader ? { preheader: input.preheader } : {}),
    ...(input.footer && input.footer !== 'default' ? { footer: input.footer } : {}),
    // Revising a draft's content must not silently drop a reviewed exclusion list.
    ...(existing?.data.exclusions ? { exclusions: existing.data.exclusions, exclusionsSetAt: existing.data.exclusionsSetAt, exclusionsSetBy: existing.data.exclusionsSetBy } : {}),
  }
  if (existing) {
    await store.set<Campaign>(CAMPAIGNS, id, campaign)
    return { created: false, id, reason: 'draft-refreshed' }
  }
  if (!(await store.create<Campaign>(CAMPAIGNS, id, campaign))) return { created: false, id, reason: 'id-in-use (created meanwhile)' }
  return { created: true, id }
}

// ── Manual drain (admin-triggered) of ONE approved+enqueued campaign ──
export interface DrainResult {
  ok: boolean; processed: number; sent: number; failed: number; skipped: number; done: boolean; error?: string
  /** Recipients whose outcome is not known (see the header). Present only when above zero. */
  uncertain?: number
  /** Queued rows another run had already claimed; left alone. Present only when above zero. */
  held?: number
  /** Rows still queued after this run. Present only when the campaign is not done. */
  remaining?: number
  /** Why the run ended before the end of its batch. */
  stopped?: 'time_budget' | 'uncertain_outcome'
  /** With error 'run_in_progress': how long the current run may still hold the campaign. */
  retryAfterSeconds?: number
}

/**
 * Send the queued recipients of a single campaign, invoked EXPLICITLY by an admin.
 * Unlike processCampaignSends (the daily cron, gated by WEEKLY_DIGEST_ENABLED), this
 * is a deliberate one-shot for a campaign that was already composed → approved →
 * enqueued (status must be 'sending'), so it does not depend on the cron flag. It
 * still refuses anything not in 'sending' — i.e. never sends without prior approval.
 *
 * Safe to repeat: a second call while one is running is refused ('run_in_progress');
 * a call after an interrupted one continues with the recipients nobody has claimed.
 * `maxBatch` bounds how many queued rows one call takes, so a call can be kept short.
 * A run stops at the first outcome it cannot classify, rather than keep sending into
 * a provider or network that is not answering clearly.
 */
export async function drainCampaign(id: string, maxBatch = 200): Promise<DrainResult> {
  const none = { processed: 0, sent: 0, failed: 0, skipped: 0, done: false }
  const store = getStore()
  const c = await getCampaign(id)
  if (!c) return { ok: false, ...none, error: 'not_found' }
  if (c.status !== 'sending') return { ok: false, ...none, error: `not_sending (${c.status})` }
  const lock = await acquireRunLock(id)
  if (!lock.ok) return { ok: false, ...none, error: 'run_in_progress', retryAfterSeconds: lock.retryAfterSeconds }

  const started = Date.now()
  let sent = 0, failed = 0, skipped = 0, processed = 0, uncertain = 0, held = 0
  let stopped: DrainResult['stopped']
  try {
    const queue = await queueRecordOf(id)   // the frozen exclusion list, if this queue has one
    const queued = await store.query<SendRow>(
      CAMPAIGN_SENDS, { where: [{ field: 'campaignId', op: '==', value: id }, { field: 'status', op: '==', value: 'queued' }], limit: maxBatch },
    )
    for (let i = 0; i < queued.length; i++) {
      if (Date.now() - started > RUN_BUDGET_MS) { stopped = 'time_budget'; break }
      const row = queued[i]
      // No claim, no delivery: only the run that creates this attempt's claim goes on.
      const claim = await claimAttempt(row, lock.runId)
      if (claim !== 'claimed') { if (claim === 'uncertain') uncertain++; else held++; continue }
      processed++
      // Re-read this recipient's current subscriber record immediately before delivery.
      if (await skipIfIneligible(c, row, queue)) skipped++
      else {
        // campaignId → Resend tag → inbound webhook events are attributable to this campaign.
        const r = await sendListEmail({ to: row.data.email, subject: c.subject, title: c.title, bodyHtml: c.bodyHtml, campaignId: c.id, idempotencyKey: deliveryKey(row), ...renderOptions(c) })
        const outcome = await recordOutcome(row, r)
        if (outcome === 'sent') sent++
        else if (outcome === 'failed') failed++
        else if (outcome === 'uncertain') { uncertain++; stopped = 'uncertain_outcome'; break }
      }
      // Pace under Resend's ~2 req/sec rate limit — bursting causes 429s → failed sends.
      if (i < queued.length - 1) await new Promise((res) => setTimeout(res, 600))
    }
    const settled = await settleCampaign(c)
    return {
      ok: true, processed, sent, failed, skipped, done: settled.done,
      ...(uncertain ? { uncertain } : {}), ...(held ? { held } : {}),
      ...(settled.done ? {} : { remaining: settled.counts.queued }), ...(stopped ? { stopped } : {}),
    }
  } finally {
    await releaseRunLock(lock)
  }
}

/** Reset a campaign's FAILED recipients back to 'queued' so drainCampaign can retry
 *  them (e.g. after a rate-limit batch of 429s). Puts the campaign back to 'sending'.
 *  Never touches 'sent' rows, so retry can't double-send. Never touches 'uncertain'
 *  rows either: only a recipient the provider definitely refused comes back here.
 *  Each gets a new attempt (a new claim) and a new provider key.
 *  A new key is never given to a recipient whose present key was already used in an
 *  attempt that ended uncertain (the provider may hold that message): recordOutcome
 *  keeps such a row 'uncertain' when a retry is refused, and a failed row found with
 *  a recorded first use is put back to 'uncertain' here and counted as heldUncertain.
 *
 *  Safe to repeat and to overlap with itself or with a send run:
 *   • every row is read AGAIN immediately before it is changed, and is changed only
 *     if it is still 'failed' — a list read earlier is never trusted;
 *   • each failed attempt can be moved on once: the action that creates that
 *     attempt's transition record (store.create) is the one that does it;
 *   • the campaign is reopened BEFORE any row is changed, so an action that is cut
 *     off part-way never leaves a waiting recipient in a campaign marked sent.
 *  If rows are found waiting in a campaign marked sent (an earlier action was cut off
 *  in a version that wrote in the other order), the campaign is reopened. */
export async function requeueFailedSends(id: string): Promise<{ ok: boolean; requeued: number; reopened?: boolean; heldUncertain?: number; error?: string }> {
  const store = getStore()
  const c = await getCampaign(id)
  if (!c) return { ok: false, requeued: 0, error: 'not_found' }
  const failed = await store.query<SendRow>(CAMPAIGN_SENDS, { where: [{ field: 'campaignId', op: '==', value: id }, { field: 'status', op: '==', value: 'failed' }], limit: 1000 })
  const due: { id: string; data: SendRow }[] = []
  let heldUncertain = 0
  for (const row of failed) {
    const cur = await store.get<SendRow>(CAMPAIGN_SENDS, row.id)
    if (!cur || cur.data.status !== 'failed') continue
    // Never a new key for a recipient whose present key was already used in an attempt that may have been
    // accepted. Such a row is not requeued: it is put back to 'uncertain' and waits for an explicit decision.
    if (cur.data.keyFirstUsedAtMs) {
      await store.update(CAMPAIGN_SENDS, row.id, { status: 'uncertain', uncertainReason: 'refused_after_uncertain', uncertainAt: new Date().toISOString() })
      heldUncertain++
      continue
    }
    due.push({ id: row.id, data: cur.data })
  }
  // When a row was put back to uncertain, say so in the answer and rewrite the totals from the rows before returning.
  const finish = async <T extends { ok: boolean; requeued: number; reopened?: boolean }>(result: T): Promise<T & { heldUncertain?: number }> => {
    if (!heldUncertain) return result
    await store.update<Campaign>(CAMPAIGNS, id, { stats: statsFrom(c, await countRows(id)) })
    return { ...result, heldUncertain }
  }
  if (due.length === 0) {
    if (c.status === 'sent' && (await countRows(id)).queued > 0) {
      await store.update<Campaign>(CAMPAIGNS, id, { status: 'sending' })
      return finish({ ok: true, requeued: 0, reopened: true })
    }
    return finish({ ok: true, requeued: 0 })
  }
  if (c.status !== 'sending') await store.update<Campaign>(CAMPAIGNS, id, { status: 'sending' })
  let requeued = 0
  for (const row of due) {
    const attempt = row.data.attempt || 1
    const won = await store.create(CAMPAIGN_SEND_TRANSITIONS, `${row.id}__a${attempt}__requeue`, { kind: 'requeue', sendId: row.id, campaignId: id, attempt, at: new Date().toISOString() })
    if (!won) {
      // Another requeue action has this attempt. Finish it only if it visibly has not been finished.
      const again = await store.get<SendRow>(CAMPAIGN_SENDS, row.id)
      if (!again || again.data.status !== 'failed' || (again.data.attempt || 1) !== attempt) continue
    }
    await store.update(CAMPAIGN_SENDS, row.id, { status: 'queued', error: '', attempt: attempt + 1, keyGen: (row.data.keyGen || 1) + 1, keyFirstUsedAtMs: 0 })
    requeued++
  }
  return finish({ ok: true, requeued })
}

/**
 * Settle ONE uncertain recipient, by an explicit admin decision that records what it
 * rests on. Never automatic, never in bulk.
 *  • 'sent'  — the provider's own record shows the message was accepted.
 *  • 'retry' — send again. The retry carries the SAME provider key, which the provider
 *              documents as preventing a second message for 24 hours FROM THE KEY'S
 *              FIRST USE. That moment is recorded once, when the row first becomes
 *              uncertain under the key (`keyFirstUsedAtMs`), and no later attempt or
 *              retry moves it. Past the window a retry can produce a duplicate, so
 *              every retry then needs acceptDuplicateRisk — the first and any later one.
 * `recordId` is the id the per-recipient listing shows for the row.
 *
 * Each decision is kept as its own transition record, one per uncertain attempt
 * (store.create): a second, different decision for the same attempt is refused, and
 * the same decision repeated after a cut-off call finishes what the first began.
 * For a retry the campaign is reopened BEFORE the row is changed, so a call that is
 * cut off never leaves a waiting recipient in a campaign marked sent.
 */
export async function resolveUncertain(id: string, input: { recordId?: unknown; outcome?: unknown; evidence?: unknown; acceptDuplicateRisk?: unknown }, actor = 'admin'): Promise<{ ok: boolean; status?: string; providerKeyWindow?: 'open' | 'expired'; error?: string }> {
  const store = getStore()
  const c = await getCampaign(id)
  if (!c) return { ok: false, error: 'not_found' }
  if (typeof input.recordId !== 'string' || !RECORD_ID_RE.test(input.recordId)) return { ok: false, error: 'record_id_required' }
  if (input.outcome !== 'sent' && input.outcome !== 'retry') return { ok: false, error: 'invalid_outcome' }
  const ev = evidenceError(input.evidence)
  if (ev) return { ok: false, error: ev }
  const evidence = (input.evidence as string).trim()
  const rowId = `cs_${id}_${input.recordId}`
  const row = await store.get<SendRow>(CAMPAIGN_SENDS, rowId)
  if (!row) return { ok: false, error: 'row_not_found' }
  if (row.data.status !== 'uncertain') {
    // A 'sent' decision whose call was cut off before the totals were written: repeating it writes them.
    if (input.outcome === 'sent' && row.data.status === 'sent' && row.data.resolution === 'sent') {
      await store.update<Campaign>(CAMPAIGNS, id, { stats: statsFrom(c, await countRows(id)) })
      return { ok: true, status: 'sent' }
    }
    return { ok: false, error: `not_uncertain (${row.data.status})` }
  }
  const now = Date.now()
  const at = new Date(now).toISOString()
  const attempt = row.data.attempt || 1
  const firstUse = row.data.keyFirstUsedAtMs || 0
  const windowOpen = firstUse > 0 && now - firstUse < PROVIDER_KEY_WINDOW_MS
  if (input.outcome === 'retry' && !windowOpen && input.acceptDuplicateRisk !== true) return { ok: false, error: 'provider_key_window_expired', providerKeyWindow: 'expired' }

  const transitionId = `${rowId}__a${attempt}__resolve`
  const prior = await store.get<{ outcome?: string }>(CAMPAIGN_SEND_TRANSITIONS, transitionId)
  if (prior && prior.data.outcome !== input.outcome) return { ok: false, error: `already_resolved (${prior.data.outcome})` }
  if (input.outcome === 'retry' && c.status !== 'sending') await store.update<Campaign>(CAMPAIGNS, id, { status: 'sending' })
  if (!prior) {
    const decision = {
      kind: 'resolve', sendId: rowId, campaignId: id, attempt, outcome: input.outcome, evidence, resolvedBy: actor, resolvedAt: at,
      ...(input.outcome === 'retry' ? { providerKeyWindow: windowOpen ? 'open' : 'expired', acceptDuplicateRisk: input.acceptDuplicateRisk === true } : {}),
    }
    if (!(await store.create(CAMPAIGN_SEND_TRANSITIONS, transitionId, decision))) {
      const raced = await store.get<{ outcome?: string }>(CAMPAIGN_SEND_TRANSITIONS, transitionId)
      if (raced?.data.outcome !== input.outcome) return { ok: false, error: `already_resolved (${raced?.data.outcome})` }
    }
  }
  const resolution = { resolvedAt: at, resolvedBy: actor, resolution: input.outcome, resolutionEvidence: evidence }
  if (input.outcome === 'sent') {
    await store.update(CAMPAIGN_SENDS, rowId, { status: 'sent', sentAt: row.data.uncertainAt || at, ...resolution })
    await store.update<Campaign>(CAMPAIGNS, id, { stats: statsFrom(c, await countRows(id)) })
    return { ok: true, status: 'sent' }
  }
  // A new attempt (a new claim) with the key, and the record of its first use, left as they were.
  await store.update(CAMPAIGN_SENDS, rowId, { status: 'queued', error: '', attempt: attempt + 1, uncertainRetries: (row.data.uncertainRetries || 0) + 1, ...resolution })
  await store.update<Campaign>(CAMPAIGNS, id, { stats: statsFrom(c, await countRows(id)) })
  return { ok: true, status: 'queued', providerKeyWindow: windowOpen ? 'open' : 'expired' }
}

/**
 * Prove, against whatever store is live, that `create` lets exactly one caller win.
 * Everything above rests on that, and an in-memory test cannot show it for the
 * production database. Writes only its own probe documents, in a collection of their
 * own, and leaves them there as a record. Sends nothing; reads no subscriber or campaign.
 */
export async function storeSelfCheck(): Promise<{ ok: boolean; store: string; sequential: boolean[]; concurrentWinners: number }> {
  const store = getStore()
  const tag = `selfcheck_${Date.now()}_${randomUUID().slice(0, 8)}`
  const doc = { selfcheck: true, at: new Date().toISOString() }
  const sequential = [await store.create(STORE_SELFCHECKS, `${tag}_s`, doc), await store.create(STORE_SELFCHECKS, `${tag}_s`, doc)]
  const concurrent = await Promise.all([1, 2, 3, 4, 5].map(() => store.create(STORE_SELFCHECKS, `${tag}_c`, doc)))
  const concurrentWinners = concurrent.filter(Boolean).length
  return { ok: sequential[0] === true && sequential[1] === false && concurrentWinners === 1, store: store.name, sequential, concurrentWinners }
}

/** Read per-recipient send statuses for a campaign (owner diagnostics; email masked).
 *  `recordId` is the address-derived record id — what exclusions and resolveUncertain take. */
export async function listCampaignSends(id: string, limit = 500): Promise<{ total: number; byStatus: Record<string, number>; rows: { email: string; status: string; recordId?: string; error?: string; skipReason?: string; uncertainReason?: string }[] }> {
  const store = getStore()
  const rows = await store.query<{ email?: string; status?: string; error?: string; skipReason?: string; uncertainReason?: string }>(CAMPAIGN_SENDS, { where: [{ field: 'campaignId', op: '==', value: id }], limit })
  const byStatus: Record<string, number> = {}
  const prefix = `cs_${id}_`
  const out = rows.map((r) => {
    const st = String(r.data.status || '?'); byStatus[st] = (byStatus[st] || 0) + 1
    const em = String(r.data.email || ''); const mask = (em.split('@')[0] || '').slice(0, 3) + '***@' + (em.split('@')[1] || '?')
    return {
      email: mask, status: st,
      recordId: r.id.startsWith(prefix) ? r.id.slice(prefix.length) : undefined,
      error: r.data.error ? String(r.data.error).slice(0, 160) : undefined,
      skipReason: r.data.skipReason ? String(r.data.skipReason) : undefined,
      uncertainReason: r.data.uncertainReason ? String(r.data.uncertainReason) : undefined,
    }
  })
  return { total: rows.length, byStatus, rows: out }
}

// ── Drain (cron). Sends queued recipients; flag-gated; never auto-progresses a draft. ──
export interface SendRunResult { enabled: boolean; processed: number; sent: number; failed: number; skipped: number; campaignsCompleted: number; uncertain?: number }

export async function processCampaignSends(maxBatch = 80): Promise<SendRunResult> {
  const res: SendRunResult = { enabled: false, processed: 0, sent: 0, failed: 0, skipped: 0, campaignsCompleted: 0 }
  if (process.env.WEEKLY_DIGEST_ENABLED !== 'true') return res          // belt: disabled by default
  res.enabled = true
  const store = getStore()

  const queued = await store.query<SendRow>(
    CAMPAIGN_SENDS, { where: [{ field: 'status', op: '==', value: 'queued' }], limit: maxBatch },
  )
  const touched = new Map<string, Campaign>()
  const locks = new Map<string, { runId: string; lockId: string } | null>()   // campaign → this run's lock, or null while another run holds that campaign
  const queues = new Map<string, QueueRecord | null>()                         // campaign → its frozen exclusion list, if its queue has one
  const started = Date.now()
  try {
    for (const row of queued) {
      if (Date.now() - started > RUN_BUDGET_MS) break
      const { campaignId, email } = row.data
      const c = await getCampaign(campaignId)
      if (!c || c.status !== 'sending') continue   // only send for campaigns explicitly approved+enqueued
      if (!locks.has(campaignId)) { const lock = await acquireRunLock(campaignId); locks.set(campaignId, lock.ok ? lock : null) }
      const held = locks.get(campaignId)
      if (!held) continue                           // an admin-triggered run has this campaign
      if (!queues.has(campaignId)) queues.set(campaignId, await queueRecordOf(campaignId))
      touched.set(campaignId, c)
      // Same gate as drainCampaign: no claim, no delivery.
      const claim = await claimAttempt(row, held.runId)
      if (claim !== 'claimed') { if (claim === 'uncertain') res.uncertain = (res.uncertain || 0) + 1; continue }
      res.processed++
      // Same check as drainCampaign: re-read the current subscriber record before delivery.
      if (await skipIfIneligible(c, row, queues.get(campaignId) ?? null)) { res.skipped++; continue }
      // c.id, not the row's campaignId — same value by construction, but sourced from
      // the campaign document that was just status-checked above.
      const r = await sendListEmail({ to: email, subject: c.subject, title: c.title, bodyHtml: c.bodyHtml, campaignId: c.id, idempotencyKey: deliveryKey(row), ...renderOptions(c) })
      const outcome = await recordOutcome(row, r)
      if (outcome === 'sent') res.sent++
      else if (outcome === 'failed') res.failed++
      else if (outcome === 'uncertain') { res.uncertain = (res.uncertain || 0) + 1; break }
    }

    // totals from the rows; mark campaigns done when no queued recipients remain
    for (const c of touched.values()) {
      if ((await settleCampaign(c)).done) res.campaignsCompleted++
    }
  } finally {
    for (const held of locks.values()) if (held) await releaseRunLock(held)
  }
  return res
}
