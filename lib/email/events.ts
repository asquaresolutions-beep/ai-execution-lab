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

/** Persist one normalized event. Best-effort; never throws to the caller. */
export async function recordEmailEvent(evt: NormalizedEmailEvent): Promise<string> {
  try {
    return await getStore().set<StoredEmailEvent>(EMAIL_EVENTS, null, { ...evt })
  } catch {
    return '' // log line / webhook 200 is the durable signal; storage is best-effort
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
