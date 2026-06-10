// ─────────────────────────────────────────────────────────────────
// lib/newsletter/welcome-sequence.ts  (asq-welcome-seq-v1)
// Orchestrates the welcome drip: each daily run, send the one due step to each
// subscriber whose age has crossed the next threshold (Day 2/5/9), then advance
// `welcomeStep`. Reuses the existing `newsletter` collection, Resend (notify),
// and the daily cron. Idempotent: at most one drip email per subscriber per run;
// only advances on a successful send (a skip — no RESEND key — or failure leaves
// the step pending so it sends once configured / on the next run).
//
// SAFETY: disabled unless WELCOME_SEQUENCE_ENABLED === 'true'. With it unset the
// function no-ops (sends nothing) — so merging/deploying this does NOT email anyone.
// ─────────────────────────────────────────────────────────────────
import { getStore } from '@/lib/store/adapter'
import { sendListEmail } from '@/lib/email/notify'
import { dueWelcomeStep, welcomeEmail } from './welcome-copy'

interface SubDoc {
  email?: string; name?: string; createdAt?: string; welcomeStep?: number; unsubscribed?: boolean
}

export interface WelcomeRunResult {
  enabled: boolean; scanned: number; due: number; sent: number; failed: number; skipped: number
}

/** Send due welcome-drip emails. now/maxBatch injectable for tests. */
export async function processWelcomeSequence(now: number = Date.now(), maxBatch = 200): Promise<WelcomeRunResult> {
  const base: WelcomeRunResult = { enabled: false, scanned: 0, due: 0, sent: 0, failed: 0, skipped: 0 }
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

    const r = await sendListEmail({ to: sub.email, subject: mail.subject, title: mail.title, bodyHtml: mail.bodyHtml })
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
