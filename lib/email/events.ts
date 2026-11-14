// ─────────────────────────────────────────────────────────────────
// lib/email/events.ts  (asq-resend-analytics-v1)
// Storage + read layer for email engagement events (Firestore `email_events`).
// Reusable analytics surface for the newsletter dashboard (no UI in this PR).
// ─────────────────────────────────────────────────────────────────
import { getStore } from '@/lib/store/adapter'
import { summarizeEmailEvents, type NormalizedEmailEvent, type EmailEventSummary } from './webhook'

export const EMAIL_EVENTS = 'email_events'

export interface StoredEmailEvent extends NormalizedEmailEvent {
  id?: string
}

/**
 * Persist one normalized event and return its id. THROWS when the store write fails, so the caller can tell the
 * provider the event was not taken (the Resend webhook: asq-webhook-store-v1).
 */
export async function storeEmailEvent(evt: NormalizedEmailEvent): Promise<string> {
  return getStore().set<StoredEmailEvent>(EMAIL_EVENTS, null, { ...evt })
}

/** Persist one normalized event. Best-effort; never throws to the caller (returns '' when the write failed). */
export async function recordEmailEvent(evt: NormalizedEmailEvent): Promise<string> {
  try {
    return await storeEmailEvent(evt)
  } catch {
    return '' // for callers whose own action must not fail because of this write (the unsubscribe link)
  }
}

/** Recent events (newest first), optionally filtered by campaign. */
export async function recentEmailEvents(limit = 500, campaignId?: string): Promise<StoredEmailEvent[]> {
  const rows = await getStore().query<StoredEmailEvent>(EMAIL_EVENTS, {
    where: campaignId ? [{ field: 'campaignId', op: '==', value: campaignId }] : undefined,
    orderBy: { field: 'ts', dir: 'desc' },
    limit,
  })
  return rows.map((r) => ({ id: r.id, ...r.data }))
}

/** Engagement summary across recent events (optionally per campaign). */
export async function emailEngagement(limit = 2000, campaignId?: string): Promise<EmailEventSummary> {
  return summarizeEmailEvents(await recentEmailEvents(limit, campaignId))
}
