// ─────────────────────────────────────────────────────────────────
// lib/email/webhook.ts  (asq-resend-analytics-v1)
// Pure helpers for the Resend webhook: Svix signature verification, event
// normalization, and engagement aggregation. No project imports → unit-testable
// under `node --experimental-strip-types`. Resend signs webhooks with the Svix
// scheme: HMAC-SHA256 over `${id}.${timestamp}.${rawBody}`, key = base64 part of
// the `whsec_…` secret, compared against the space-joined `svix-signature` header.
// ─────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual } from 'node:crypto'

export type EmailEventType = 'delivered' | 'bounced' | 'opened' | 'clicked' | 'complained' | 'unsubscribed' | 'sent' | 'delivery_delayed'

export interface NormalizedEmailEvent {
  type: EmailEventType
  email: string
  messageId?: string
  campaignId?: string
  ts: number
  meta?: Record<string, unknown>
}

const TYPE_MAP: Record<string, EmailEventType> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delivery_delayed',
  'email.bounced': 'bounced',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.complained': 'complained',
}

/** Verify a Svix/Resend webhook signature. Returns true on any matching v1 sig. */
export function verifyResendSignature(opts: {
  secret: string; svixId: string; svixTimestamp: string; rawBody: string; svixSignature: string
}): boolean {
  const { secret, svixId, svixTimestamp, rawBody, svixSignature } = opts
  if (!secret || !svixId || !svixTimestamp || !svixSignature) return false
  const key = secret.startsWith('whsec_') ? secret.slice(6) : secret
  let keyBytes: Buffer
  try { keyBytes = Buffer.from(key, 'base64') } catch { return false }
  const signed = `${svixId}.${svixTimestamp}.${rawBody}`
  const expected = createHmac('sha256', keyBytes).update(signed).digest('base64')
  const expBuf = Buffer.from(expected)
  // header is space-separated "v1,<b64sig>" entries
  for (const part of svixSignature.split(' ')) {
    const sig = part.includes(',') ? part.split(',')[1] : part
    const sigBuf = Buffer.from(sig)
    if (sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf)) return true
  }
  return false
}

/** Normalize a Resend webhook payload into our event shape, or null if unsupported. */
export function parseResendEvent(body: unknown): NormalizedEmailEvent | null {
  const b = body as { type?: string; created_at?: string; data?: Record<string, unknown> }
  if (!b || typeof b.type !== 'string') return null
  const type = TYPE_MAP[b.type]
  if (!type) return null
  const data = b.data || {}
  const to = Array.isArray(data.to) ? String(data.to[0]) : String(data.to ?? '')
  if (!to) return null
  const tags = (data.tags as Record<string, string> | undefined) || undefined
  return {
    type,
    email: to.toLowerCase(),
    messageId: typeof data.email_id === 'string' ? data.email_id : undefined,
    campaignId: tags?.campaignId || tags?.campaign_id,
    ts: b.created_at ? Date.parse(b.created_at) || Date.now() : Date.now(),
    meta: tags ? { tags } : undefined,
  }
}

export interface EmailEventSummary {
  total: number
  byType: Record<string, number>
  /** delivered / sent (or delivered count if no sent events). */
  deliveryRate: number
  /** unique-ish opens / delivered. */
  openRate: number
  /** clicks / delivered. */
  clickRate: number
  bounceRate: number
}

/** Aggregate event rows into engagement rates. Pure + deterministic. */
export function summarizeEmailEvents(rows: { type: string }[]): EmailEventSummary {
  const byType: Record<string, number> = {}
  for (const r of rows) byType[r.type] = (byType[r.type] || 0) + 1
  const sent = byType.sent || 0
  const delivered = byType.delivered || 0
  const denom = delivered || sent || 0
  const pct = (n: number) => (denom ? Math.round((n / denom) * 1000) / 10 : 0)
  return {
    total: rows.length,
    byType,
    deliveryRate: sent ? Math.round((delivered / sent) * 1000) / 10 : 0,
    openRate: pct(byType.opened || 0),
    clickRate: pct(byType.clicked || 0),
    bounceRate: sent ? Math.round(((byType.bounced || 0) / sent) * 1000) / 10 : pct(byType.bounced || 0),
  }
}
