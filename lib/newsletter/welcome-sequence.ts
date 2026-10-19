// ─────────────────────────────────────────────────────────────────
// lib/newsletter/welcome-sequence.ts  (asq-welcome-seq-v1, asq-welcome-deliverability-v1)
// Orchestrates the welcome drip: each daily run, send the one due step to each
// subscriber whose age has crossed the next threshold (Day 2/5/9), then advance
// `welcomeStep`. Reuses the existing `newsletter` collection, Resend (notify),
// and the daily cron. Idempotent: at most one drip email per subscriber per run;
// only advances on a successful send (a skip — no RESEND key — or failure leaves
// the step pending so it sends once configured / on the next run).
//
// Immediately before each send (asq-welcome-deliverability-v1) the subscriber's
// CURRENT record is re-read (an unsubscribe since the list was read stops the send)
// and the provider's events for the address are checked (deliverability.ts): a
// complaint, a provider suppression, a permanent bounce or repeated bounces since the
// last delivery stop the send. A stopped send writes nothing and does not advance the
// step, so the address is checked again on the next run; nothing is ever written to a
// subscriber record or to the provider. If the check itself cannot be made (a store
// error), nothing is sent this run (fail closed). Each send carries an idempotency key
// per subscriber and step, so two runs at once cannot both deliver the same step.
//
// SAFETY: disabled unless WELCOME_SEQUENCE_ENABLED === 'true'. With it unset the
// function no-ops (sends nothing) — so merging/deploying this does NOT email anyone.
// ─────────────────────────────────────────────────────────────────
import { getStore } from '@/lib/store/adapter'
import { sendListEmail } from '@/lib/email/notify'
import { EMAIL_EVENTS } from '@/lib/email/events'
import { dueWelcomeStep, welcomeEmail } from './welcome-copy'
import { deliverabilityBlock, type DeliverabilityBlock, type DeliveryEventLike } from './deliverability'

interface SubDoc {
  email?: string; name?: string; createdAt?: string; welcomeStep?: number; unsubscribed?: boolean
}

export type WelcomeBlockReason = 'unsubscribed' | 'not_subscribed' | DeliverabilityBlock

export interface WelcomeRunResult {
  enabled: boolean; scanned: number; due: number; sent: number; failed: number; skipped: number
  /** Due, but stopped by the check before sending; counted by reason. Nothing written. */
  blocked: number; blockedBy: Partial<Record<WelcomeBlockReason, number>>
  /** Due, but the check could not be made (store error): not sent, retried next run. */
  deferred: number
}

/** Upper bound on the events read for one address (an address has a handful). */
const MAX_EVENTS_PER_ADDRESS = 500

/** Why this due step must not be sent now, or null. Read-only. Throws on a store error. */
async function welcomeBlockReason(id: string, email: string): Promise<WelcomeBlockReason | null> {
  const store = getStore()
  const current = await store.get<SubDoc>('newsletter', id)
  if (!current) return 'not_subscribed'
  if (current.data?.unsubscribed) return 'unsubscribed'
  // The webhook stores the address lower-cased (lib/email/webhook.ts). Equality on one
  // field needs no composite index.
  const events = await store.query<DeliveryEventLike>(EMAIL_EVENTS, {
    where: [{ field: 'email', op: '==', value: email.trim().toLowerCase() }],
    limit: MAX_EVENTS_PER_ADDRESS,
  })
  return deliverabilityBlock(events.map((e) => e.data))
}

/** Send due welcome-drip emails. now/maxBatch injectable for tests. */
export async function processWelcomeSequence(now: number = Date.now(), maxBatch = 200): Promise<WelcomeRunResult> {
  const base: WelcomeRunResult = { enabled: false, scanned: 0, due: 0, sent: 0, failed: 0, skipped: 0, blocked: 0, blockedBy: {}, deferred: 0 }
  if (process.env.WELCOME_SEQUENCE_ENABLED !== 'true') return base
  base.enabled = true

  const store = getStore()
  // Launch cutoff (fail-safe): only subscribers created at/after WELCOME_SEQUENCE_SINCE
  // are eligible. If the cutoff is unset/invalid, sinceMs = Infinity → NO ONE is
  // enrolled, so enabling the sequence without a cutoff can never retro-blast
  // pre-launch subscribers. Set WELCOME_SEQUENCE_SINCE (ISO date) to activate.
  const sinceRaw = process.env.WELCOME_SEQUENCE_SINCE
  const sinceMs = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? Date.parse(sinceRaw) : Infinity

  const subs = await store.query<SubDoc>('newsletter', { limit: maxBatch })
  base.scanned = subs.length

  for (const doc of subs) {
    const sub = doc.data || {}
    const step = dueWelcomeStep(sub, now, sinceMs)
    if (!step || !sub.email) continue
    base.due++
    const mail = welcomeEmail(step, sub.name)
    if (!mail) continue

    let reason: WelcomeBlockReason | null
    try { reason = await welcomeBlockReason(doc.id, sub.email) } catch { base.deferred++; continue }   // fail closed
    if (reason) { base.blocked++; base.blockedBy[reason] = (base.blockedBy[reason] || 0) + 1; continue }

    const r = await sendListEmail({ to: sub.email, subject: mail.subject, title: mail.title, bodyHtml: mail.bodyHtml, idempotencyKey: `welcome-${doc.id}-step${step}` })
    if (r.ok) {
      base.sent++
      // Advance only on a confirmed send so a step is never silently skipped.
      try { await store.update('newsletter', doc.id, { welcomeStep: step, welcomeLastSentAt: new Date(now).toISOString() }) } catch { /* best-effort; retried next run */ }
    } else if (r.skipped) {
      base.skipped++   // no RESEND_API_KEY configured — leave pending, do not advance
    } else {
      base.failed++    // transient send failure — retried next run (no advance)
    }
  }
  return base
}
