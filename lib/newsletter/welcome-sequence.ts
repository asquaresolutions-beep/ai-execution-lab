// ─────────────────────────────────────────────────────────────────
// lib/newsletter/welcome-sequence.ts  (asq-welcome-seq-v1, asq-welcome-deliverability-v1,
//                                      asq-welcome-pagination-v1, asq-welcome-fairness-v1,
//                                      asq-shared-daily-quota-v1, asq-welcome-alerts-v1)
// Orchestrates the welcome drip: each daily run, send the one due step to each
// subscriber whose age has crossed the next threshold (Day 2/5/9), then advance
// `welcomeStep`. Reuses the existing `newsletter` collection, Resend (notify),
// and the daily cron. At most one drip email per subscriber per run; the step
// advances only on a confirmed send.
//
// SCAN (asq-welcome-pagination-v1): the whole list is read page by page with a
// cursor on the `id` field (`id > cursor`, ordered by `id`, PAGE_SIZE a page; one
// field, so no composite index). The earlier single read was capped at 200 records,
// returned in document-id order, which silently left out every record past the 200th.
// Any scan error, or a scan that cannot finish, sends nothing that run (fail closed).
//
// PRE-CHECK and ORDER (asq-welcome-fairness-v1): before any per-subscriber work, every
// due subscriber is classified READ-ONLY in batches of PREFETCH_BATCH (Firestore 'in'
// allows 30 values): consent=false and invalid addresses from the scanned record; the
// provider's events for the addresses (deliverability.ts); the claim ledger; open
// manual reviews. Subscribers that are blocked, in manual review, or waiting for an
// in-flight/unreconciled attempt are counted and skipped at the cost of their share of
// a few batch reads, so they can never fill the run's time window. A read that fails or
// hits its limit leaves its subscribers unclassified: they go through the full check
// below exactly as before. Nothing is written by the pre-check.
// The rest are processed in this order: subscribers who signed up within ACTIVE_WINDOW
// first, then older ones (the backlog), oldest signup first in each, first attempts
// before retries. While the backlog has candidates, BACKLOG_SHARE sends and
// BACKLOG_RESERVE of time are kept for it each run, so no eligible subscriber waits
// forever behind a busy active window.
//
// CHECKS immediately before each send (asq-welcome-deliverability-v1, extended): the
// subscriber's CURRENT record is re-read (deleted, unsubscribed, consent explicitly
// false, an address the shared rule calls invalid, or a step another run has already
// advanced all stop the send) and the provider's events for the address are checked
// (deliverability.ts: complaint, provider suppression, permanent bounce, repeated
// bounces). A stopped send writes nothing anywhere. A check that cannot be made (a
// store error) sends nothing (fail closed) and is retried on the next run.
//
// LIMITS, per run: at most MAX_SENDS_PER_RUN emails; no send STARTS once the run is
// within SEND_TIMEOUT + WRITE_MARGIN of RUN_BUDGET (each provider call is cut off at
// SEND_TIMEOUT); at least SPACING between provider calls. Per day (asq-shared-daily-quota-v1):
// immediately before EVERY send, the budget the drip SHARES with campaign sends is read
// afresh (lib/email/daily-quota.ts): the provider's own events since 00:00 UTC for mail
// no campaign claims, the drip attempts claimed since then (by any run) and the campaign
// attempts claimed today; the drip only sends while their sum stays below
// DAILY_PROVIDER_LIMIT − DAILY_RESERVE. A drip send can be in two counts, so the guard can
// only stop early, never late.
//
// ACCOUNT-WIDE REFUSALS (asq-welcome-alerts-v1): a 401/403 means the provider refused the
// account (API key, sending domain), not the subscriber. It is not an attempt for anyone
// and the run stops at once. MAX_SAME_REFUSALS_IN_ROW definite refusals in a row with the
// same status also stop the run. Either way the daily cron raises an alert
// (welcomeAttention), as it does for a new manual review, unknown outcomes (each one can
// later use an attempt) or an unreadable budget.
//
// UNKNOWN OUTCOMES (asq-welcome-fairness-v1): an unknown outcome belongs to that one
// recipient; the run goes on to the next. The run stops only on a system-wide signal:
// MAX_CONSECUTIVE_UNKNOWN unknown first attempts in a row, or MAX_UNKNOWN_PER_RUN in all.
// After MAX_RETRY_UNKNOWN unknown retries, the remaining retries wait for the next run
// (first attempts go on). An unknown attempt is never retried before reconciliation.
//
// IDEMPOTENCY (welcome-claims.ts): each attempt is claimed in a ledger before the
// provider is called (first caller wins), so overlapping runs cannot both send it; an
// interrupted run is recovered from the ledger and, for an unknown outcome, from the
// provider's events, before anything is retried. After 3 attempts the subscriber-step
// goes to manual review: never sent again automatically, never marked sent. The
// provider also receives an idempotency key per subscriber, step and key generation.
//
// SAFETY: disabled unless WELCOME_SEQUENCE_ENABLED === 'true'. With it unset the
// function no-ops (sends nothing) — so merging/deploying this does NOT email anyone.
// ─────────────────────────────────────────────────────────────────
import { randomUUID } from 'node:crypto'
import { getStore, type StoredDoc } from '@/lib/store/adapter'
import { sendListEmail, emailConfigured } from '@/lib/email/notify'
import { EMAIL_EVENTS } from '@/lib/email/events'
import { readDailyQuota, quotaErrorText } from '@/lib/email/daily-quota'
import { log } from '@/lib/observability/logger'
import { clearlyInvalidEmail } from './subscribers'
import { dueWelcomeStep, welcomeEmail } from './welcome-copy'
import { deliverabilityBlock, type DeliverabilityBlock, type DeliveryEventLike } from './deliverability'
import {
  WELCOME_SEND_CLAIMS, WELCOME_SEND_REVIEWS, MAX_WELCOME_ATTEMPTS, claimDocId, reviewDocId, welcomeDeliveryKey,
  classifySendResult, decideWelcomeClaim, recordManualReview, ledgerError, isAccountRefusal,
  summarizeClaims,
  type ClaimDecision, type ClaimSummaryState, type ProviderEventLike, type ReviewReason, type WelcomeClaim,
} from './welcome-claims'

interface SubDoc {
  id?: string; email?: string; name?: string; createdAt?: string; welcomeStep?: number; unsubscribed?: boolean; consent?: boolean
}

export type WelcomeBlockReason = 'unsubscribed' | 'not_subscribed' | 'no_consent' | 'invalid_address' | DeliverabilityBlock

export type WelcomeStopReason =
  | 'time_budget' | 'send_cap' | 'quota_exhausted' | 'quota_unknown' | 'rate_limited' | 'repeated_unknown'
  | 'scan_failed' | 'page_cap' | 'cursor_stalled'
  /** The provider refused the account (401/403: API key or sending domain). Not an attempt for anyone. */
  | 'provider_refused'
  /** MAX_SAME_REFUSALS_IN_ROW definite refusals in a row with the same status: likely system-wide. */
  | 'repeated_refusal'

export interface WelcomeQuotaReading {
  limit: number; reserve: number; providerSendsToday: number; dripAttemptsToday: number; campaignAttemptsToday: number; sentThisRun: number; remaining: number
}

export interface WelcomeRunResult {
  enabled: boolean; scanned: number; due: number; sent: number; failed: number; skipped: number
  /** Due, but stopped by a check before sending (pre-check or the check before the send); by reason. Nothing written. */
  blocked: number; blockedBy: Partial<Record<WelcomeBlockReason, number>>
  /** Due, but the check could not be made (store error): not sent, retried next run. */
  deferred: number
  /** Pages read by the scan. */
  pages: number
  /** Records left out because another record holds the same address (the first one is processed). */
  duplicateAddress: number
  /** Read-only pre-check: batch reads made, and due subscribers it could not classify (they get the full check). */
  precheckReads: number
  unclassified: number
  /** Candidates after the pre-check: inside the active window, and older (the backlog). */
  activeCandidates: number
  backlogCandidates: number
  /** Another run holds this subscriber-step, or an unknown outcome is waiting for the provider's events. */
  held: number
  /** The current record shows the step already advanced (by another run). Nothing done. */
  alreadyAdvanced: number
  /** A confirmed earlier send whose step had not been advanced: step advanced now, nothing sent. */
  repaired: number
  /** An earlier attempt with no definite outcome, proven sent by the provider's events: step advanced, nothing sent. */
  reconciled: number
  /** Sends whose outcome is unknown this run (no definite answer). */
  unknown: number
  /** Retries not attempted this run because MAX_RETRY_UNKNOWN unknown retries had already happened. */
  retriesPostponed: number
  /** HTTP 429 from the provider. The run stops at the first one. */
  rateLimited: number
  /** Due subscriber-steps found in manual review this run (3 attempts used, or too many claims). */
  manualReview: number
  /** Manual-review records created this run, and creations that failed (retried next run). */
  reviewRecorded: number
  reviewWriteFailed: number
  /** Due, but not looked at because the run stopped first. */
  notReached: number
  /** The last quota reading taken before a send, if any. */
  quota?: WelcomeQuotaReading
  /** Why the run ended before the end of the due list. */
  stopped?: WelcomeStopReason
}

/** Fixed limits (code constants: no environment variable controls them). */
export const WELCOME_LIMITS = {
  /** Records per scan page. */
  pageSize: 200,
  /** Pages before the scan gives up (20,000 records). */
  maxPages: 100,
  /** Drip emails per run. */
  maxSendsPerRun: 20,
  /** The provider's daily allowance, shared by every email the account sends. */
  dailyProviderLimit: 100,
  /** Kept free each day for signup and routine notification mail. */
  dailyReserve: 40,
  /** Minimum time between two provider calls. */
  spacingMs: 600,
  /** The run's own execution budget. */
  runBudgetMs: 25_000,
  /** A provider call that has not answered by then is treated as an unknown outcome. */
  sendTimeoutMs: 5_000,
  /** Time kept for the writes after a send. */
  writeMarginMs: 2_000,
  /** Upper bound on the day's events read for the quota; reaching it counts as unreadable. */
  quotaReadLimit: 5_000,
  /** Subscribers who signed up within this window are processed first. */
  activeWindowMs: 21 * 86_400_000,
  /** Sends kept each run for subscribers older than the active window, while any are due. */
  backlogShare: 2,
  /** Time kept for those backlog sends: the active phase stops starting sends this much earlier. */
  backlogReserveMs: 3_000,
  /** Values per pre-check read (Firestore 'in' accepts at most 30: verified 6 Nov 2026, 31 → HTTP 400). */
  prefetchBatch: 30,
  /** Upper bound on documents per pre-check read; reaching it leaves that batch unclassified. */
  prefetchReadLimit: 5_000,
  /** Unknown outcomes on first attempts, in a row, that stop the run. */
  maxConsecutiveUnknown: 2,
  /** Unknown outcomes on retries after which the remaining retries wait for the next run. */
  maxRetryUnknownPerRun: 3,
  /** Unknown outcomes of any kind that stop the run. */
  maxUnknownPerRun: 5,
  /** Definite refusals in a row with the same HTTP status that stop the run (one status for everyone looks system-wide). */
  maxSameRefusalsInRow: 2,
} as const

export type WelcomeLimits = { -readonly [K in keyof typeof WELCOME_LIMITS]: number }

/** Stop reasons that mean the drip cannot work until someone fixes something. */
const ATTENTION_STOPS = new Set<string>(['provider_refused', 'repeated_refusal', 'repeated_unknown', 'quota_unknown', 'scan_failed', 'cursor_stalled', 'page_cap'])

/**
 * Whether a run needs a person, and why, for the daily cron's alert (asq-welcome-alerts-v1). Pure. null: nothing to report.
 * Raised for: a stop that blocks the drip until fixed (provider refused the account, the same refusal twice in a row,
 * unknown outcomes in a row, the shared budget unreadable, an incomplete scan); a subscriber-step newly put in manual
 * review, or such a record that could not be written; two or more definite refusals, or two or more unknown outcomes
 * (each is later reconciled and can use one of a subscriber's attempts), in one run.
 */
export function welcomeAttention(r: Pick<WelcomeRunResult, 'stopped' | 'reviewRecorded' | 'reviewWriteFailed' | 'failed' | 'unknown'>): string | null {
  const why: string[] = []
  if (r.stopped && ATTENTION_STOPS.has(r.stopped)) why.push(`stopped: ${r.stopped}`)
  if (r.reviewRecorded > 0) why.push(`${r.reviewRecorded} new manual review(s)`)
  if (r.reviewWriteFailed > 0) why.push(`${r.reviewWriteFailed} manual-review record(s) not written`)
  if (r.failed >= 2) why.push(`${r.failed} definite refusals`)
  if (r.unknown >= 2) why.push(`${r.unknown} unknown send outcomes`)
  return why.length ? `welcome drip needs attention: ${why.join('; ')}` : null
}

/** Test seams. Production passes none of these. */
export interface WelcomeRunOptions {
  limits?: Partial<WelcomeLimits>
  /** Monotonic-ish clock for the run budget and spacing (default Date.now). */
  clock?: () => number
  sleep?: (ms: number) => Promise<void>
}

/** Upper bound on the events read for one address (an address has a handful). */
const MAX_EVENTS_PER_ADDRESS = 500

type CheckResult =
  | { kind: 'ok'; email: string; events: DeliveryEventLike[] }
  | { kind: 'blocked'; reason: WelcomeBlockReason }
  | { kind: 'advanced' }

/** Whether this due step may be sent now. Read-only. Throws on a store error. */
async function welcomeCheck(id: string, scannedEmail: string, step: number): Promise<CheckResult> {
  const store = getStore()
  const current = await store.get<SubDoc>('newsletter', id)
  if (!current) return { kind: 'blocked', reason: 'not_subscribed' }
  const cur = current.data || {}
  if (cur.unsubscribed) return { kind: 'blocked', reason: 'unsubscribed' }
  if (cur.consent === false) return { kind: 'blocked', reason: 'no_consent' }
  const email = String(cur.email || scannedEmail)
  if (clearlyInvalidEmail(email)) return { kind: 'blocked', reason: 'invalid_address' }
  if ((cur.welcomeStep ?? 0) >= step) return { kind: 'advanced' }
  // The webhook stores the address lower-cased (lib/email/webhook.ts). Equality on one
  // field needs no composite index.
  const rows = await store.query<DeliveryEventLike>(EMAIL_EVENTS, {
    where: [{ field: 'email', op: '==', value: email.trim().toLowerCase() }],
    limit: MAX_EVENTS_PER_ADDRESS,
  })
  const events = rows.map((e) => e.data)
  const block = deliverabilityBlock(events)
  return block ? { kind: 'blocked', reason: block } : { kind: 'ok', email, events }
}

/**
 * What the drip may still send today: the budget it shares with campaign sends
 * (lib/email/daily-quota.ts, asq-shared-daily-quota-v1), read afresh. Three counts:
 *  • providerSendsToday    — the provider's own events since 00:00 UTC for mail no campaign
 *    claims (signups, notifications, the drip);
 *  • dripAttemptsToday     — drip attempts claimed since 00:00 UTC by ANY run, except those
 *    the provider definitely did not send. Claims are written before the provider is
 *    called, so this covers this run, an overlapping run, and sends whose events have
 *    not arrived yet;
 *  • campaignAttemptsToday — campaign attempts claimed today, including those in flight.
 * A drip send that already has its event is counted twice: the guard can stop early,
 * never late. Throws when any count cannot be trusted.
 */
async function readQuota(now: number, sentThisRun: number, lim: WelcomeLimits): Promise<WelcomeQuotaReading> {
  const q = await readDailyQuota(now, { limit: lim.dailyProviderLimit, reserve: lim.dailyReserve, readLimit: lim.quotaReadLimit })
  return {
    limit: q.limit, reserve: q.reserve, providerSendsToday: q.otherSendsToday, dripAttemptsToday: q.dripAttemptsToday,
    campaignAttemptsToday: q.campaignAttemptsToday, sentThisRun, remaining: q.remaining,
  }
}

type SendResult = { ok: boolean; skipped?: boolean; status?: number; error?: string }

/** The provider call, cut off after `ms` (then an unknown outcome: no status). Never throws. */
async function sendWithTimeout(send: () => Promise<SendResult>, ms: number): Promise<SendResult> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<SendResult>((res) => { timer = setTimeout(() => res({ ok: false, error: 'timeout' }), ms) })
  try {
    return await Promise.race([send().catch((e: unknown) => ({ ok: false, error: String((e as Error)?.message || e).slice(0, 200) })), timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

type Due = { doc: StoredDoc<SubDoc>; sub: SubDoc; step: number; created: number }
type PreCheck = { block?: WelcomeBlockReason; eventsKnown?: boolean; claims?: { state: ClaimSummaryState; attempts: number; last: WelcomeClaim | null } }

const chunks = <T,>(xs: T[], n: number): T[][] => { const out: T[][] = []; for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n)); return out }

/**
 * READ-ONLY pre-check of every due subscriber, in batches (see the header). Never throws: a read that fails
 * or reaches its limit leaves its subscribers unclassified, and they then get the full per-subscriber check.
 */
async function preCheck(due: Due[], now: number, lim: WelcomeLimits): Promise<{ by: Map<string, PreCheck>; openReviews: Set<string> | null; reads: number }> {
  const store = getStore()
  const by = new Map<string, PreCheck>()
  let reads = 0
  // 1. From the scanned record itself: no read needed.
  for (const d of due) {
    if (d.sub.consent === false) by.set(d.doc.id, { block: 'no_consent' })
    else if (clearlyInvalidEmail(d.sub.email)) by.set(d.doc.id, { block: 'invalid_address' })
  }
  const open = due.filter((d) => !by.get(d.doc.id)?.block)
  // 2. The provider's events for the addresses (the webhook stores them lower-cased).
  const addressOf = (d: Due) => String(d.sub.email).trim().toLowerCase()
  const blockByAddress = new Map<string, DeliverabilityBlock | null>()
  for (const batch of chunks([...new Set(open.map(addressOf))], lim.prefetchBatch)) {
    try {
      reads++
      const rows = await store.query<DeliveryEventLike & { email?: string }>(EMAIL_EVENTS, { where: [{ field: 'email', op: 'in', value: batch }], limit: lim.prefetchReadLimit })
      if (rows.length >= lim.prefetchReadLimit) continue   // possibly incomplete: leave the batch unclassified
      const events = new Map<string, DeliveryEventLike[]>()
      for (const r of rows) { const k = String(r.data.email || '').toLowerCase(); (events.get(k) || events.set(k, []).get(k)!).push(r.data) }
      for (const a of batch) blockByAddress.set(a, deliverabilityBlock(events.get(a) || []))
    } catch { /* unclassified */ }
  }
  // 3. The claim ledger for the records.
  const claimsByRecord = new Map<string, WelcomeClaim[]>()
  const ledgerKnown = new Set<string>()
  for (const batch of chunks([...new Set(open.map((d) => d.doc.id))], lim.prefetchBatch)) {
    try {
      reads++
      const rows = await store.query<WelcomeClaim>(WELCOME_SEND_CLAIMS, { where: [{ field: 'recordId', op: 'in', value: batch }], limit: lim.prefetchReadLimit })
      if (rows.length >= lim.prefetchReadLimit) continue
      for (const r of rows) (claimsByRecord.get(r.data.recordId) || claimsByRecord.set(r.data.recordId, []).get(r.data.recordId)!).push(r.data)
      for (const id of batch) ledgerKnown.add(id)
    } catch { /* unclassified */ }
  }
  // 4. Open manual reviews (a small collection).
  let openReviews: Set<string> | null = null
  try {
    reads++
    const rows = await store.query<{ recordId: string; step: number }>(WELCOME_SEND_REVIEWS, { where: [{ field: 'state', op: '==', value: 'manual_review' }], limit: lim.prefetchReadLimit })
    if (rows.length < lim.prefetchReadLimit) openReviews = new Set(rows.map((r) => reviewDocId(r.data.recordId, r.data.step)))
  } catch { /* unknown: reviews are then written through the full path */ }
  for (const d of open) {
    const p: PreCheck = { eventsKnown: blockByAddress.has(addressOf(d)) }
    const block = blockByAddress.get(addressOf(d))
    if (block) p.block = block
    else if (ledgerKnown.has(d.doc.id)) p.claims = summarizeClaims(claimsByRecord.get(d.doc.id) || [], d.step, now)
    by.set(d.doc.id, p)
  }
  return { by, openReviews, reads }
}

/** Send due welcome-drip emails. `now` and the options are injectable for tests. */
export async function processWelcomeSequence(now: number = Date.now(), options: WelcomeRunOptions = {}): Promise<WelcomeRunResult> {
  const base: WelcomeRunResult = {
    enabled: false, scanned: 0, due: 0, sent: 0, failed: 0, skipped: 0, blocked: 0, blockedBy: {}, deferred: 0,
    pages: 0, duplicateAddress: 0, precheckReads: 0, unclassified: 0, activeCandidates: 0, backlogCandidates: 0,
    held: 0, alreadyAdvanced: 0, repaired: 0, reconciled: 0, unknown: 0, retriesPostponed: 0, rateLimited: 0,
    manualReview: 0, reviewRecorded: 0, reviewWriteFailed: 0, notReached: 0,
  }
  if (process.env.WELCOME_SEQUENCE_ENABLED !== 'true') return base
  base.enabled = true

  const lim: WelcomeLimits = { ...WELCOME_LIMITS, ...options.limits }
  const clock = options.clock || Date.now
  const sleep = options.sleep || ((ms: number) => new Promise<void>((res) => setTimeout(res, ms)))
  const started = clock()
  // No send starts after this point, so the last one (cut off at sendTimeoutMs) and its
  // writes end inside the run budget.
  const startLimit = lim.runBudgetMs - lim.sendTimeoutMs - lim.writeMarginMs
  const elapsed = () => clock() - started
  const runId = randomUUID()

  const store = getStore()
  // Launch cutoff (fail-safe): only subscribers created at/after WELCOME_SEQUENCE_SINCE
  // are eligible. If the cutoff is unset/invalid, sinceMs = Infinity → NO ONE is
  // enrolled, so enabling the sequence without a cutoff can never retro-blast
  // pre-launch subscribers. Set WELCOME_SEQUENCE_SINCE (ISO date) to activate.
  const sinceRaw = process.env.WELCOME_SEQUENCE_SINCE
  const sinceMs = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? Date.parse(sinceRaw) : Infinity

  // ── Scan the whole list, a page at a time (keyset on `id`). ──
  const subs: StoredDoc<SubDoc>[] = []
  try {
    const seen = new Set<string>()
    let cursor = ''
    scan: for (;;) {
      if (base.pages >= lim.maxPages) { base.stopped = 'page_cap'; break }
      if (elapsed() > startLimit) { base.stopped = 'time_budget'; break }
      const page = await store.query<SubDoc>('newsletter', {
        where: [{ field: 'id', op: '>', value: cursor }],
        orderBy: { field: 'id', dir: 'asc' },
        limit: lim.pageSize,
      })
      base.pages++
      for (const doc of page) {
        const key = doc.data?.id
        if (typeof key !== 'string' || !(key > cursor) || seen.has(doc.id)) { base.stopped = 'cursor_stalled'; break scan }
        seen.add(doc.id)
        subs.push(doc)
        cursor = key
      }
      if (page.length < lim.pageSize) break
    }
  } catch {
    base.stopped = 'scan_failed'
  }
  base.scanned = subs.length
  // An incomplete scan cannot be ordered fairly: send nothing this run.
  if (base.stopped) return base

  // ── Who is due; one entry per record and per address. ──
  const due: Due[] = []
  const addresses = new Set<string>()
  for (const doc of subs) {
    const sub = doc.data || {}
    const step = dueWelcomeStep(sub, now, sinceMs)
    if (!step || !sub.email) continue
    const address = sub.email.trim().toLowerCase()
    if (addresses.has(address)) { base.duplicateAddress++; continue }
    addresses.add(address)
    due.push({ doc, sub, step, created: Date.parse(sub.createdAt || '') })
  }
  base.due = due.length
  if (!due.length) return base

  // ── Read-only pre-check, then the processing order. ──
  const pre = await preCheck(due, now, lim)
  base.precheckReads = pre.reads
  type Candidate = Due & { retry: boolean }
  const active: Candidate[] = [], backlog: Candidate[] = []
  const reviewsToRecord: Array<{ d: Due; reason: ReviewReason; attempts: number; last: WelcomeClaim | null }> = []
  for (const d of due) {
    const p = pre.by.get(d.doc.id)
    if (p?.block) { base.blocked++; base.blockedBy[p.block] = (base.blockedBy[p.block] || 0) + 1; continue }
    const s = p?.claims
    if (!p?.eventsKnown || !s) base.unclassified++   // not (fully) classified: the full check below decides
    if (s?.state === 'held') { base.held++; continue }
    if (s?.state === 'review') {
      base.manualReview++
      if (pre.openReviews && !pre.openReviews.has(reviewDocId(d.doc.id, d.step))) {
        reviewsToRecord.push({ d, reason: s.attempts >= MAX_WELCOME_ATTEMPTS ? 'max_attempts' : 'too_many_claims', attempts: s.attempts, last: s.last })
      }
      continue
    }
    const c: Candidate = { ...d, retry: s?.state === 'retry' }
    ;(now - d.created <= lim.activeWindowMs ? active : backlog).push(c)
  }
  // A review whose record is missing (an earlier write failed) is written once here, without any send.
  for (const r of reviewsToRecord) {
    try {
      if (await recordManualReview(store, { recordId: r.d.doc.id, step: r.d.step, reason: r.reason, attempts: r.attempts, last: r.last, now })) base.reviewRecorded++
    } catch { base.reviewWriteFailed++ }
  }
  const byAge = (a: Candidate, b: Candidate) => a.created - b.created || a.step - b.step || (a.doc.id < b.doc.id ? -1 : a.doc.id > b.doc.id ? 1 : 0)
  const order = (xs: Candidate[]) => [...xs.filter((x) => !x.retry).sort(byAge), ...xs.filter((x) => x.retry).sort(byAge)]
  const A = order(active), BK = order(backlog)
  base.activeCandidates = A.length
  base.backlogCandidates = BK.length

  // ── Send. ──
  let lastProviderCallAt = Number.NEGATIVE_INFINITY
  let consecutiveUnknown = 0, retryUnknown = 0, retriesPaused = false
  let refusalStatus: number | null = null, sameRefusals = 0   // definite refusals in a row with one status

  /** One candidate. 'next' — go on; 'later' — out of time before claiming (not processed); otherwise a stop reason. */
  const attemptOne = async (c: Candidate, timeLimit: number): Promise<'next' | 'later' | WelcomeStopReason> => {
    const { doc, sub, step } = c
    if (retriesPaused && c.retry) { base.retriesPostponed++; return 'next' }
    const mail = welcomeEmail(step, sub.name)
    if (!mail) return 'next'

    let check: CheckResult
    try { check = await welcomeCheck(doc.id, sub.email as string, step) } catch { base.deferred++; return 'next' }   // fail closed
    if (check.kind === 'blocked') { base.blocked++; base.blockedBy[check.reason] = (base.blockedBy[check.reason] || 0) + 1; return 'next' }
    if (check.kind === 'advanced') { base.alreadyAdvanced++; return 'next' }
    const { email, events } = check

    // No provider key configured: nothing is claimed or sent; the step stays pending.
    if (!emailConfigured()) { base.skipped++; return 'next' }

    let decision: ClaimDecision
    try {
      decision = await decideWelcomeClaim(store, { recordId: doc.id, step, now, readEvents: async () => events as ProviderEventLike[] })
    } catch { base.deferred++; return 'next' }   // fail closed
    if (decision.kind === 'held') { base.held++; return 'next' }
    if (decision.kind === 'already_sent') {
      // Sent before (recorded, or proven by the provider's events): advance only.
      try { await store.update('newsletter', doc.id, { welcomeStep: step }) } catch { /* retried next run */ }
      if (decision.via === 'claim') base.repaired++; else base.reconciled++
      return 'next'
    }
    if (decision.kind === 'manual_review') {
      base.manualReview++
      try {
        if (await recordManualReview(store, { recordId: doc.id, step, reason: decision.reason, attempts: decision.attempts, last: decision.last, now, recipient: email })) base.reviewRecorded++
      } catch { base.reviewWriteFailed++ }
      return 'next'
    }

    const attempt = decision   // kind 'send' from here on
    const isRetry = attempt.seq > 1
    const key = welcomeDeliveryKey(doc.id, step, attempt.keyGen)

    // Quota, read afresh immediately before this send.
    let quota: WelcomeQuotaReading
    try { quota = await readQuota(now, base.sent, lim) } catch (err) {
      log.warn({ event: 'welcome.quota_unreadable', error: quotaErrorText(err) })
      return 'quota_unknown'
    }
    base.quota = quota
    if (quota.remaining <= 0) return 'quota_exhausted'
    if (elapsed() > timeLimit) return 'later'

    // Claim this attempt. Only the run that creates the claim may call the provider.
    const claimId = claimDocId(doc.id, step, attempt.seq)
    const claim: WelcomeClaim = {
      recordId: doc.id, step, seq: attempt.seq, keyGen: attempt.keyGen, runId,
      claimedAt: new Date(now).toISOString(), claimedAtMs: now,
    }
    let won: boolean
    try { won = await store.create<WelcomeClaim>(WELCOME_SEND_CLAIMS, claimId, claim) } catch { base.deferred++; return 'next' }
    if (!won) { base.held++; return 'next' }

    const wait = lim.spacingMs - (clock() - lastProviderCallAt)
    if (wait > 0) await sleep(wait)
    lastProviderCallAt = clock()
    const r = await sendWithTimeout(
      () => sendListEmail({ to: email, subject: mail.subject, title: mail.title, bodyHtml: mail.bodyHtml, idempotencyKey: key }),
      lim.sendTimeoutMs,
    )
    const outcome = classifySendResult(r)
    try {
      await store.update<WelcomeClaim>(WELCOME_SEND_CLAIMS, claimId, {
        outcome, outcomeAt: new Date(now).toISOString(), status: r.status ?? null, ...(r.error ? { error: ledgerError(r.error, email) } : {}),
      })
    } catch { /* an unrecorded outcome is reconciled from the provider's events on a later run */ }

    if (outcome !== 'failed') { refusalStatus = null; sameRefusals = 0 }
    if (r.ok) {
      base.sent++
      consecutiveUnknown = 0
      // Advance only on a confirmed send so a step is never silently skipped.
      try { await store.update('newsletter', doc.id, { welcomeStep: step, welcomeLastSentAt: new Date(now).toISOString() }) } catch { /* the claim records the send; repaired next run */ }
      return 'next'
    }
    if (outcome === 'failed') {
      base.failed++     // a definite refusal: one attempt used
      consecutiveUnknown = 0
      if (attempt.attempts + 1 >= MAX_WELCOME_ATTEMPTS) {
        base.manualReview++
        try {
          if (await recordManualReview(store, { recordId: doc.id, step, reason: 'max_attempts', attempts: attempt.attempts + 1, last: { outcome, status: r.status ?? null, error: r.error }, now, recipient: email })) base.reviewRecorded++
        } catch { base.reviewWriteFailed++ }
      }
      // The same refusal for different subscribers in a row looks system-wide (e.g. a sender address the provider
      // no longer accepts): stop, so it cannot walk the whole due list into manual review.
      sameRefusals = r.status === refusalStatus ? sameRefusals + 1 : 1
      refusalStatus = r.status ?? null
      if (sameRefusals >= lim.maxSameRefusalsInRow) return 'repeated_refusal'
      return 'next'
    }
    // The provider refused the account (401/403), not this subscriber: not an attempt (classifySendResult), stop the run.
    if (outcome === 'deferred' && isAccountRefusal(r.status)) return 'provider_refused'
    if (outcome === 'deferred') { base.rateLimited++; return 'rate_limited' }   // rate or quota limit: not an attempt
    if (outcome === 'skipped') { base.skipped++; return 'next' }                // no provider key after all: leave pending
    // Unknown: this recipient's attempt waits for reconciliation; the run goes on unless the signal is system-wide.
    base.unknown++
    if (isRetry) {
      retryUnknown++
      if (retryUnknown >= lim.maxRetryUnknownPerRun) retriesPaused = true
    } else if (++consecutiveUnknown >= lim.maxConsecutiveUnknown) return 'repeated_unknown'
    if (base.unknown >= lim.maxUnknownPerRun) return 'repeated_unknown'
    return 'next'
  }

  // Phase 1: the active window, keeping the backlog's share; phase 2: the backlog; phase 3: the rest of the active window.
  const share = BK.length ? Math.min(lim.backlogShare, lim.maxSendsPerRun) : 0
  const cursorA = { i: 0 }, cursorB = { i: 0 }
  let hardStop: WelcomeStopReason | undefined
  const runPhase = async (list: Candidate[], at: { i: number }, cap: number, timeLimit: number) => {
    while (at.i < list.length && !hardStop) {
      if (base.sent >= cap || elapsed() > timeLimit) return
      const r = await attemptOne(list[at.i], timeLimit)
      if (r === 'later') return
      at.i++
      if (r !== 'next') hardStop = r
    }
  }
  await runPhase(A, cursorA, lim.maxSendsPerRun - share, startLimit - (share ? lim.backlogReserveMs : 0))
  await runPhase(BK, cursorB, lim.maxSendsPerRun, startLimit)
  await runPhase(A, cursorA, lim.maxSendsPerRun, startLimit)

  const remaining = (A.length - cursorA.i) + (BK.length - cursorB.i)
  if (hardStop) { base.stopped = hardStop; base.notReached = remaining }
  else if (remaining > 0) { base.stopped = base.sent >= lim.maxSendsPerRun ? 'send_cap' : 'time_budget'; base.notReached = remaining }
  return base
}
