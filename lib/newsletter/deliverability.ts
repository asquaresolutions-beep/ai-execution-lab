// ─────────────────────────────────────────────────────────────────
// lib/newsletter/deliverability.ts  (asq-welcome-deliverability-v1)
// Decides, from the provider's own events for one address (Firestore `email_events`,
// written by the Resend webhook), whether more list mail would only bounce again.
// Pure: no store, no network — the caller reads the events and passes them in.
//
// Rules, in order. "Since the last delivery" = events later than the newest
// `delivered` event for the address (all events, if it was never delivered): a later
// delivery shows the mailbox works again, so older failures stop counting.
//   1. complained   — the reader marked our mail as spam, ever.
//   2. provider_suppressed — since the last delivery, the provider skipped a send
//      because the address is on its suppression list (`suppressed`), or reported a
//      bounce with sub-type "Suppressed".
//   3. permanent_bounce — since the last delivery, a bounce the provider called permanent.
//   4. repeated_bounce  — since the last delivery, REPEATED_BOUNCE_THRESHOLD or more
//      bounces of any kind. Events stored before this version carry no bounce type, so
//      they can only ever count here.
// `delivery_delayed`, `sent`, `opened`, `clicked` change nothing.
// ─────────────────────────────────────────────────────────────────

export type DeliverabilityBlock = 'complained' | 'provider_suppressed' | 'permanent_bounce' | 'repeated_bounce'

/** Bounces since the last delivery that stop list mail. Two: one transient bounce alone never stops anyone. */
export const REPEATED_BOUNCE_THRESHOLD = 2

export interface DeliveryEventLike {
  type?: string
  ts?: number | string
  bounceType?: string
  bounceSubType?: string
}

const timeOf = (e: DeliveryEventLike): number => {
  const t = typeof e.ts === 'number' ? e.ts : typeof e.ts === 'string' ? Date.parse(e.ts) : NaN
  return Number.isFinite(t) ? t : 0   // an event with no usable time is treated as the oldest
}
const isPermanent = (e: DeliveryEventLike) => /^perm/i.test(String(e.bounceType || ''))
const isSuppressedBounce = (e: DeliveryEventLike) => /^suppress/i.test(String(e.bounceSubType || ''))

/** Why list mail to this address should stop, or null. */
export function deliverabilityBlock(events: readonly DeliveryEventLike[]): DeliverabilityBlock | null {
  if (events.some((e) => e.type === 'complained')) return 'complained'
  const lastDelivered = events.reduce((m, e) => (e.type === 'delivered' ? Math.max(m, timeOf(e)) : m), -Infinity)
  const since = events.filter((e) => timeOf(e) > lastDelivered)
  if (since.some((e) => e.type === 'suppressed' || (e.type === 'bounced' && isSuppressedBounce(e)))) return 'provider_suppressed'
  if (since.some((e) => e.type === 'bounced' && isPermanent(e))) return 'permanent_bounce'
  if (since.filter((e) => e.type === 'bounced').length >= REPEATED_BOUNCE_THRESHOLD) return 'repeated_bounce'
  return null
}
