// ─────────────────────────────────────────────────────────────────
// POST /api/trustseal/billing/cancel  (asq-trustseal-billing-b3)
// Authenticated cancel request (at cycle end). Server-authoritative: this only
// asks Razorpay to cancel; the local subscription state changes when the resulting
// subscription.cancelled webhook is processed (B2.2), and reconcile (B2.3) is the
// backstop. TEST MODE ONLY. No local state mutation here.
// ─────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/trustseal/account'
import { getSubscription } from '@/lib/billing/entitlement'
import { cancelSubscription } from '@/lib/billing/razorpay'
import { isTestModeKey } from '@/lib/billing/plans'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isTestModeKey(process.env.RAZORPAY_KEY_ID)) {
    return NextResponse.json({ error: 'live_mode_disabled' }, { status: 403 })
  }

  const sub = await getSubscription(user.uid)
  if (!sub?.razorpaySubscriptionId) return NextResponse.json({ error: 'no_subscription' }, { status: 404 })

  const ok = await cancelSubscription(sub.razorpaySubscriptionId, true)
  if (!ok) return NextResponse.json({ error: 'razorpay_error' }, { status: 502 })

  // State flips to 'cancelled' via the webhook; surface the pending intent only.
  return NextResponse.json({ ok: true, pending: 'cancel_at_cycle_end' }, { headers: { 'cache-control': 'private, no-store' } })
}
