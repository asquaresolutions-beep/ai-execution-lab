// ─────────────────────────────────────────────────────────────────
// POST /api/trustseal/billing/reactivate  (asq-trustseal-billing-cancel-fix)
// Reactivate a subscription that is scheduled to cancel at cycle end. Razorpay has
// NO "un-cancel" API for a cycle-end cancellation, so reactivation = start a fresh
// subscription (same interval) via the normal hosted checkout. Server-authoritative,
// works in live OR test mode. Allowed ONLY when the current subscription is cancel-scheduled.
//
// Non-destructive: we do NOT downgrade the local doc here — current entitlement
// stays Pro until the existing period ends; the new subscription's activation
// webhook updates ts_subscriptions/{uid} (clearing cancelAtCycleEnd). The old
// cycle-end-cancelling subscription will not renew, so there is no double charge.
// ─────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/trustseal/account'
import { getSubscription } from '@/lib/billing/entitlement'
import { createSubscription } from '@/lib/billing/razorpay'
import { planOption, isRazorpayConfigured } from '@/lib/billing/plans'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isRazorpayConfigured(process.env.RAZORPAY_KEY_ID)) {
    return NextResponse.json({ error: 'billing_not_configured' }, { status: 503 })
  }

  const sub = await getSubscription(user.uid)
  if (!sub) return NextResponse.json({ error: 'no_subscription' }, { status: 404 })
  if (!sub.cancelAtCycleEnd) {
    return NextResponse.json({ error: 'not_cancel_scheduled' }, { status: 409 })
  }

  const opt = sub.interval ? planOption(sub.interval) : null
  if (!opt) return NextResponse.json({ error: 'invalid_plan' }, { status: 400 })
  const planId = process.env[opt.envVar]
  if (!planId) return NextResponse.json({ error: 'plan_not_configured' }, { status: 503 })

  const created = await createSubscription({ planId, uid: user.uid, totalCount: opt.totalCount })
  if (!created) return NextResponse.json({ error: 'razorpay_error' }, { status: 502 })

  // Do NOT write a pending doc — keep current entitlement until the new sub activates.
  return NextResponse.json(
    { ok: true, subscriptionId: created.id, shortUrl: created.shortUrl, keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? null },
    { headers: { 'cache-control': 'private, no-store' } },
  )
}
