// ─────────────────────────────────────────────────────────────────
// lib/billing/razorpay.ts  (asq-trustseal-billing-b2-3)
// Minimal Razorpay REST client — READ-ONLY snapshot fetch for reconciliation.
// Deliberately NOT a full client: no subscription creation, no cancel/update, no
// checkout. Those belong to B3. Server-only (uses the secret key); returns a
// normalized RazorpaySnapshot or null (fail-closed) so the reconcile service never
// downgrades local state on a transient API failure.
// ─────────────────────────────────────────────────────────────────
import type { RazorpaySnapshot } from '@/lib/billing/webhook'

const API_BASE = 'https://api.razorpay.com/v1'

const numToMs = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1000) : null)
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)

/** GET /subscriptions/:id → normalized snapshot, or null on missing config / non-OK / error. */
export async function fetchSubscriptionSnapshot(subscriptionId: string): Promise<RazorpaySnapshot | null> {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret || !subscriptionId) return null

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
  let res: Response
  try {
    res = await fetch(`${API_BASE}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      headers: { Authorization: `Basic ${auth}` },
      cache: 'no-store',
    })
  } catch {
    return null // network error → fail-closed (caller skips, keeps local state)
  }
  if (!res.ok) return null

  let j: Record<string, unknown>
  try { j = (await res.json()) as Record<string, unknown> } catch { return null }

  const id = str(j.id)
  const status = str(j.status)
  if (!id || !status) return null
  const notes = j.notes && typeof j.notes === 'object' ? (j.notes as Record<string, unknown>) : null

  return {
    subscriptionId: id,
    status,
    uid: notes ? str(notes.uid) : null,
    planId: str(j.plan_id),
    currentStart: numToMs(j.current_start),
    currentEnd: numToMs(j.current_end),
  }
}

function authHeader(): string | null {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) return null
  return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64')
}

export interface CreatedSubscription {
  id: string
  status: string
  shortUrl: string | null   // Razorpay hosted-checkout URL
  planId: string | null
  customerId: string | null
}

/**
 * POST /subscriptions — create a Razorpay subscription, stamping notes.uid so the
 * webhook + reconcile paths can map every future event back to the account.
 * Returns null on missing config / non-OK / error (caller maps to 5xx). Does NOT
 * grant entitlement — that happens only when the activation webhook lands.
 */
export async function createSubscription(opts: { planId: string; uid: string; totalCount: number }): Promise<CreatedSubscription | null> {
  const auth = authHeader()
  if (!auth || !opts.planId || !opts.uid) return null
  const body = JSON.stringify({
    plan_id: opts.planId,
    total_count: opts.totalCount,
    customer_notify: 1,
    notes: { uid: opts.uid },
  })
  let res: Response
  try {
    res = await fetch(`${API_BASE}/subscriptions`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body,
      cache: 'no-store',
    })
  } catch {
    return null
  }
  if (!res.ok) return null
  let j: Record<string, unknown>
  try { j = (await res.json()) as Record<string, unknown> } catch { return null }
  const id = str(j.id)
  if (!id) return null
  return { id, status: str(j.status) ?? '', shortUrl: str(j.short_url), planId: str(j.plan_id), customerId: str(j.customer_id) }
}

/**
 * POST /subscriptions/:id/cancel — request cancellation (default: at cycle end).
 * Server-authoritative: the local state changes only when the resulting
 * subscription.cancelled webhook is processed. Returns false on any failure.
 */
export async function cancelSubscription(subscriptionId: string, atCycleEnd = true): Promise<boolean> {
  const auth = authHeader()
  if (!auth || !subscriptionId) return false
  try {
    const res = await fetch(`${API_BASE}/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancel_at_cycle_end: atCycleEnd ? 1 : 0 }),
      cache: 'no-store',
    })
    return res.ok
  } catch {
    return false
  }
}
