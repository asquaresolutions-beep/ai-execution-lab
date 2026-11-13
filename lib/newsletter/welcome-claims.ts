// ─────────────────────────────────────────────────────────────────
// lib/newsletter/welcome-claims.ts  (asq-welcome-pagination-v1)
// The welcome drip's per-attempt ledger, used by welcome-sequence.ts.
//
// One CLAIM document per attempt to send one drip step to one subscriber
// (`<recordId>__s<step>__c<seq>`). It is CREATED before the provider is called
// (store.create: the first caller wins, atomically), so of any number of runs at
// most one hands a given attempt to the provider. The outcome is then written on it.
// Nothing here is ever deleted.
//
// Reading the ledger for a subscriber-step decides what may happen next:
//   • a claim recorded 'sent'  → the email went out; only the step still has to be
//                                advanced (a crash or a failed write left it behind)
//   • a claim with no outcome, or 'unknown' (the provider gave no definite answer)
//       – younger than RECONCILE_MIN_AGE_MS → 'held': another run may still be
//         working on it, or the provider's webhook events have not arrived yet
//       – older → RECONCILED against the provider's own events for the address
//         (classifyDeliveryEvidence): delivered or accepted → recorded 'sent';
//         taken but bounced/suppressed → 'not_sent' (one attempt used, new key);
//         no event → 'not_sent' (one attempt used, same key) while the claim is younger than
//         KEY_WINDOW_MS; older than that → MANUAL REVIEW ('key_window_expired'), because the same
//         key no longer protects against a second send. Never retried before this check.
//   • 'failed'   (a definite refusal) → one attempt used; the next key is new
//   • 'deferred' (HTTP 429: rate or quota limit; or 401/403: the ACCOUNT was refused — a
//                 bad or restricted API key, an unverified sending domain) → not an attempt;
//                 the next key is new. The run stops at the first one (welcome-sequence.ts).
// After MAX_WELCOME_ATTEMPTS attempts without a send, or MAX_WELCOME_CLAIMS claims,
// the subscriber-step is put in MANUAL REVIEW: a record in WELCOME_SEND_REVIEWS, no
// further automatic send, the step never advanced, the subscriber record untouched.
//
// The provider's idempotency key stays the same while the previous attempt's outcome
// is unknown (if the provider did take it, a repeat within 24 h is answered with the
// first result instead of being sent again) and changes only after a definite
// non-send, which the provider would otherwise repeat back for 24 h.
//
// No email address is stored in either collection (ledgerError redacts provider error text).
// summarizeClaims is the read-only twin of the ledger walk, used by the batched pre-check.
// ─────────────────────────────────────────────────────────────────
import type { DocumentStore } from '@/lib/store/adapter'

/** One document per send attempt: `<recordId>__s<step>__c<seq>`. */
export const WELCOME_SEND_CLAIMS = 'welcome_send_claims'
/** One document per subscriber-step that needs a person: `<recordId>__s<step>`. */
export const WELCOME_SEND_REVIEWS = 'welcome_send_reviews'

/** Attempts (definite refusals + unknown outcomes found not sent) before manual review. */
export const MAX_WELCOME_ATTEMPTS = 3
/** Hard ceiling on claims for one subscriber-step, whatever their outcome (bounds repeated 429s). */
export const MAX_WELCOME_CLAIMS = 10
/** A claim without a definite outcome is left alone until it is this old (webhook latency, live runs). */
export const RECONCILE_MIN_AGE_MS = 30 * 60_000
/** Window around a claim in which a provider event is read as being about that attempt. */
export const RECONCILE_BEFORE_MS = 60_000
/** For events the provider emits when it processes a message ('sent', 'suppressed'). */
export const RECONCILE_AFTER_MS = 15 * 60_000
/** For events that follow processing by minutes to hours ('delivered', 'delivery_delayed', 'bounced'). */
export const RECONCILE_AFTER_DELIVERY_MS = 6 * 60 * 60_000
/**
 * Age after which a claim's idempotency key is no longer relied on. The provider honours a key for 24 h from the
 * SEND, which is not recorded (only the claim is), so the cut-off is kept below that.
 */
export const KEY_WINDOW_MS = 23 * 60 * 60_000

// Event types, as normalised by lib/email/webhook.ts (TYPE_MAP) from the provider's webhook. Only types that
// are tied to one message's processing are used. 'opened', 'clicked' and 'complained' are NOT used: they
// can refer to any earlier email and arrive days later (and open/click tracking is off: none in production).
/** Proof the message was delivered. */
const DELIVERED_TYPES = new Set(['delivered'])
/** Proof the provider took the message and has not (yet) reported delivery. */
const ACCEPTED_TYPES = new Set(['sent', 'delivery_delayed'])
/** Proof the provider took the message but did NOT deliver it. */
const NOT_DELIVERED_TYPES = new Set(['bounced', 'suppressed'])
const SHORT_WINDOW_TYPES = new Set(['sent', 'suppressed'])

export type ClaimOutcome = 'sent' | 'failed' | 'deferred' | 'unknown' | 'not_sent' | 'skipped'

export interface WelcomeClaim {
  recordId: string
  step: number
  seq: number
  keyGen: number
  runId: string
  claimedAt: string
  claimedAtMs: number
  outcome?: ClaimOutcome | null
  outcomeAt?: string
  status?: number | null
  error?: string
  /** How an attempt without a definite answer was settled from the provider's events. */
  reconciled?: 'provider_event' | 'provider_not_delivered' | 'no_provider_event'
  reconciledAt?: string
  previousOutcome?: string
  /** The provider event type and message id used as evidence (no address). */
  evidenceType?: string
  evidenceMessageId?: string | null
}

export type ReviewReason = 'max_attempts' | 'too_many_claims' | 'key_window_expired'

export interface WelcomeReview {
  recordId: string
  step: number
  state: 'manual_review'
  reason: ReviewReason
  attempts: number
  lastOutcome: string | null
  lastStatus: number | null
  lastError: string | null
  createdAt: string
}

/** Provider event fields this module reads (as stored by the Resend webhook). */
export interface ProviderEventLike {
  type?: string
  ts?: number | string
  campaignId?: string | null
  messageId?: string | null
}

export const claimDocId = (recordId: string, step: number, seq: number): string => `${recordId}__s${step}__c${seq}`
export const reviewDocId = (recordId: string, step: number): string => `${recordId}__s${step}`

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Provider error text for the ledger, with no address left in it, cut to 200 characters (after redaction, so an
 * address is never half-cut into something the patterns miss). Removed, in this order:
 *  1. the recipient's own address, verbatim and URL-encoded, case-insensitively, when it is known;
 *  2. quoted local parts ("first last"@example.com);
 *  3. URL-encoded addresses (local%40domain);
 *  4. anything else shaped like local@domain.
 */
export function ledgerError(raw: unknown, recipient?: string): string {
  let s = String(raw ?? '')
  const r = String(recipient ?? '').trim()
  if (r) {
    const forms = new Set([r, encodeURIComponent(r), r.replace('@', '%40')])
    for (const f of forms) s = s.replace(new RegExp(escapeRe(f), 'gi'), '[address]')
  }
  s = s.replace(/"[^"\r\n]{0,128}"@[^\s<>"'`,;:()[\]]+/g, '[address]')
  s = s.replace(/[^\s<>"'`,;:()[\]%]+%40[^\s<>"'`,;:()[\]]+/gi, '[address]')
  s = s.replace(/[^\s<>"'`,;:()[\]]+@[^\s<>"'`,;:()[\]]+/g, '[address]')
  return s.slice(0, 200)
}

/** 401/403: the provider refused the account (API key or sending domain), whoever the recipient. */
export const isAccountRefusal = (status?: number): boolean => status === 401 || status === 403

/** The provider idempotency key. Generation 1 is exactly the key the drip has always used. */
export function welcomeDeliveryKey(recordId: string, step: number, keyGen: number): string {
  return keyGen <= 1 ? `welcome-${recordId}-step${step}` : `welcome-${recordId}-step${step}-k${keyGen}`
}

/**
 * The provider's answer as a ledger outcome. Pure.
 * Only a 4xx proves the message was not taken, except 408 and 409 (409 is how the
 * provider answers a key that is in flight or reused with another body), 429
 * (a rate or quota limit: not taken, but not the recipient's fault either) and
 * 401/403 (the provider refused the ACCOUNT, not this recipient: every send would get
 * the same answer, so it must not use up anyone's attempts).
 * No answer, a timeout or a 5xx prove nothing either way: 'unknown'.
 */
export function classifySendResult(r: { ok: boolean; skipped?: boolean; status?: number }): ClaimOutcome {
  if (r.ok) return 'sent'
  if (r.skipped) return 'skipped'
  if (r.status === 429 || isAccountRefusal(r.status)) return 'deferred'
  if (typeof r.status === 'number' && r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 409) return 'failed'
  return 'unknown'
}

const timeOf = (e: ProviderEventLike): number =>
  typeof e.ts === 'number' ? e.ts : typeof e.ts === 'string' ? Date.parse(e.ts) : NaN

export type DeliveryEvidence =
  | { kind: 'delivered' | 'accepted' | 'not_delivered'; type: string; messageId: string | null }
  | { kind: 'none' }

/**
 * What the provider's events for an address say about an attempt claimed at `claimedAtMs`. Pure.
 * Only events not attributed to a campaign, inside the window for their type, are read:
 *  'sent' / 'suppressed' within [claim − RECONCILE_BEFORE_MS, claim + RECONCILE_AFTER_MS];
 *  'delivered' / 'delivery_delayed' / 'bounced' within [claim − RECONCILE_BEFORE_MS, claim + RECONCILE_AFTER_DELIVERY_MS].
 * Priority: delivered → not delivered (bounced, suppressed) → accepted (sent, delayed) → none.
 */
export function classifyDeliveryEvidence(events: readonly ProviderEventLike[], claimedAtMs: number): DeliveryEvidence {
  if (!Number.isFinite(claimedAtMs) || claimedAtMs <= 0) return { kind: 'none' }
  const inWindow = events.filter((e) => {
    const type = String(e.type)
    if (e.campaignId || !(DELIVERED_TYPES.has(type) || ACCEPTED_TYPES.has(type) || NOT_DELIVERED_TYPES.has(type))) return false
    const t = timeOf(e)
    const after = SHORT_WINDOW_TYPES.has(type) ? RECONCILE_AFTER_MS : RECONCILE_AFTER_DELIVERY_MS
    return t >= claimedAtMs - RECONCILE_BEFORE_MS && t <= claimedAtMs + after
  })
  for (const [kind, types] of [['delivered', DELIVERED_TYPES], ['not_delivered', NOT_DELIVERED_TYPES], ['accepted', ACCEPTED_TYPES]] as const) {
    const e = inWindow.find((x) => types.has(String(x.type)))
    if (e) return { kind, type: String(e.type), messageId: e.messageId ? String(e.messageId) : null }
  }
  return { kind: 'none' }
}

/** True when the provider's events show the attempt was taken and not reported undelivered (delivered or accepted). Pure. */
export function hasDeliveryEvidence(events: readonly ProviderEventLike[], claimedAtMs: number): boolean {
  const k = classifyDeliveryEvidence(events, claimedAtMs).kind
  return k === 'delivered' || k === 'accepted'
}

/** 00:00 UTC of the day containing `ms`. */
export function utcDayStart(ms: number): number {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/**
 * Provider sends since `dayStartMs`, from the provider's own events: distinct
 * messages with a 'sent' or 'suppressed' event (an event without a message id is
 * counted on its own). Pure.
 */
export function countProviderSends(events: readonly ProviderEventLike[], dayStartMs: number): number {
  const ids = new Set<string>()
  let anonymous = 0
  for (const e of events) {
    if (e.type !== 'sent' && e.type !== 'suppressed') continue
    if (!(timeOf(e) >= dayStartMs)) continue
    if (e.messageId) ids.add(String(e.messageId))
    else anonymous++
  }
  return ids.size + anonymous
}

export type ClaimSummaryState = 'none' | 'sent' | 'held' | 'retry' | 'review'

/**
 * READ-ONLY summary of one subscriber-step's ledger from claims already in memory (the batched pre-check). Pure.
 * Follows decideWelcomeClaim's walk exactly, but never reconciles: a claim that would need reconciliation
 * makes the state 'retry', and the authoritative decideWelcomeClaim settles it before anything is sent.
 *   none   — no claim: a first attempt;     sent  — a claim recorded sent (only the step needs advancing);
 *   held   — a claim in flight or waiting for the provider's events (< RECONCILE_MIN_AGE_MS);
 *   retry  — earlier attempts exist and another is allowed (or one must first be reconciled);
 *   review — MAX_WELCOME_ATTEMPTS attempts used, or MAX_WELCOME_CLAIMS claims: manual review.
 */
export function summarizeClaims(
  claims: readonly WelcomeClaim[], step: number, now: number,
): { state: ClaimSummaryState; attempts: number; last: WelcomeClaim | null } {
  const bySeq = new Map<number, WelcomeClaim>()
  for (const c of claims) if (c.step === step && Number.isInteger(c.seq)) bySeq.set(c.seq, c)
  let attempts = 0
  let last: WelcomeClaim | null = null
  for (let seq = 1; seq <= MAX_WELCOME_CLAIMS; seq++) {
    const c = bySeq.get(seq)
    if (!c) {
      if (attempts >= MAX_WELCOME_ATTEMPTS) return { state: 'review', attempts, last }
      return { state: seq === 1 ? 'none' : 'retry', attempts, last }
    }
    last = c
    switch (c.outcome) {
      case 'sent': return { state: 'sent', attempts, last }
      case 'failed': case 'not_sent': attempts++; break
      case 'deferred': case 'skipped': break
      default:
        return { state: now - (Number(c.claimedAtMs) || 0) < RECONCILE_MIN_AGE_MS ? 'held' : 'retry', attempts, last }
    }
  }
  return { state: 'review', attempts, last }
}

export type ClaimDecision =
  | { kind: 'send'; seq: number; keyGen: number; attempts: number }
  | { kind: 'already_sent'; via: 'claim' | 'provider_event' }
  | { kind: 'held' }
  | { kind: 'manual_review'; reason: ReviewReason; attempts: number; last: WelcomeClaim | null }

/**
 * Read this subscriber-step's ledger and decide what may happen now (see the header).
 * The only writes it makes are reconciliation results on claims that are at least
 * RECONCILE_MIN_AGE_MS old. `readEvents` returns the provider's events for the address
 * and is called only when a reconciliation is needed. Throws on a store error, so the
 * caller can fail closed.
 */
export async function decideWelcomeClaim(
  store: DocumentStore,
  o: { recordId: string; step: number; now: number; readEvents: () => Promise<readonly ProviderEventLike[]> },
): Promise<ClaimDecision> {
  let attempts = 0
  let keyGen = 1
  let last: WelcomeClaim | null = null
  let events: readonly ProviderEventLike[] | null = null
  for (let seq = 1; seq <= MAX_WELCOME_CLAIMS; seq++) {
    const id = claimDocId(o.recordId, o.step, seq)
    const cur = await store.get<WelcomeClaim>(WELCOME_SEND_CLAIMS, id)
    if (!cur) {
      if (attempts >= MAX_WELCOME_ATTEMPTS) return { kind: 'manual_review', reason: 'max_attempts', attempts, last }
      return { kind: 'send', seq, keyGen, attempts }
    }
    const c = cur.data
    last = c
    const gen = c.keyGen || 1
    switch (c.outcome) {
      case 'sent':
        return { kind: 'already_sent', via: 'claim' }
      case 'failed':
        attempts++; keyGen = gen + 1; break
      case 'deferred':
        keyGen = gen + 1; break
      case 'skipped':
        keyGen = gen; break
      case 'not_sent':
        // The provider processed the attempt but reported it undelivered: its key now answers with that result
        // for 24 h, so a real retry needs a new key. With no provider event at all, the same key is kept.
        attempts++; keyGen = c.reconciled === 'provider_not_delivered' ? gen + 1 : gen; break
      default: {
        // No outcome recorded (the run stopped or died after claiming), or 'unknown'.
        const claimedAtMs = Number(c.claimedAtMs) || 0
        if (o.now - claimedAtMs < RECONCILE_MIN_AGE_MS) return { kind: 'held' }
        if (!events) events = await o.readEvents()
        const at = new Date(o.now).toISOString()
        const previousOutcome = c.outcome ?? 'none'
        const ev = classifyDeliveryEvidence(events, claimedAtMs)
        if (ev.kind === 'delivered' || ev.kind === 'accepted') {
          await store.update<WelcomeClaim>(WELCOME_SEND_CLAIMS, id, { outcome: 'sent', reconciled: 'provider_event', reconciledAt: at, previousOutcome, evidenceType: ev.type, evidenceMessageId: ev.messageId })
          return { kind: 'already_sent', via: 'provider_event' }
        }
        if (ev.kind === 'not_delivered') {
          // Taken but not delivered (bounced or suppressed): never recorded as sent; one attempt used.
          await store.update<WelcomeClaim>(WELCOME_SEND_CLAIMS, id, { outcome: 'not_sent', reconciled: 'provider_not_delivered', reconciledAt: at, previousOutcome, evidenceType: ev.type, evidenceMessageId: ev.messageId })
          attempts++; keyGen = gen + 1
          break
        }
        // No provider event. A repeat with the same key is only safe while the provider still remembers that key.
        // Past that, a send the provider did take (its events lost) would go out a second time: a person decides.
        // Nothing is written, so every later run reaches the same decision.
        if (o.now - claimedAtMs >= KEY_WINDOW_MS) return { kind: 'manual_review', reason: 'key_window_expired', attempts, last }
        await store.update<WelcomeClaim>(WELCOME_SEND_CLAIMS, id, { outcome: 'not_sent', reconciled: 'no_provider_event', reconciledAt: at, previousOutcome })
        attempts++; keyGen = gen
      }
    }
  }
  return { kind: 'manual_review', reason: attempts >= MAX_WELCOME_ATTEMPTS ? 'max_attempts' : 'too_many_claims', attempts, last }
}

/**
 * Put a subscriber-step in manual review. Created once (store.create); a later call
 * finds it and changes nothing. Returns true when this call created it.
 */
export async function recordManualReview(
  store: DocumentStore,
  o: { recordId: string; step: number; reason: ReviewReason; attempts: number; last: Pick<WelcomeClaim, 'outcome' | 'status' | 'error'> | null; now: number; recipient?: string },
): Promise<boolean> {
  const review: WelcomeReview = {
    recordId: o.recordId,
    step: o.step,
    state: 'manual_review',
    reason: o.reason,
    attempts: o.attempts,
    lastOutcome: o.last?.outcome ?? null,
    lastStatus: o.last?.status ?? null,
    lastError: o.last?.error ? ledgerError(o.last.error, o.recipient) : null,
    createdAt: new Date(o.now).toISOString(),
  }
  return store.create<WelcomeReview>(WELCOME_SEND_REVIEWS, reviewDocId(o.recordId, o.step), review)
}
