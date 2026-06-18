// POST /api/trustseal/billing/upgrade  (asq-trustseal-hardening)
// In-place Pro → Business upgrade — NO cancel/rebuy. Updates the existing Razorpay
// subscription's plan to the Business plan, then persists plan='business' locally
// so entitlement transitions immediately; the subscription.updated webhook
// reconciles (applyTransition preserves the tier). Authenticated; safe-guarded:
//   • requires an ACTIVE paid subscription that is currently 'pro' (not business)
//   • requires the Business plan id to be configured (RAZORPAY_PLAN_BUSINESS_MONTHLY)
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/trustseal/account'
import { getStore } from '@/lib/store/adapter'
import { getEntitlement, getSubscription } from '@/lib/billing/entitlement'
import { updateSubscriptionPlan } from '@/lib/billing/razorpay'
import { SUBSCRIPTIONS } from '@/lib/billing/model'
import type { Subscription } from '@/lib/billing/model'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ent = await getEntitlement(user.uid)
  if (!ent.active || ent.plan !== 'pro') {
    // Only an active Pro account can upgrade in place (free → use /subscribe;
    // already-business → nothing to do).
    return NextResponse.json({ error: 'not_eligible', plan: ent.plan }, { status: 409 })
  }
  const businessPlanId = process.env.RAZORPAY_PLAN_BUSINESS_MONTHLY
  if (!businessPlanId) return NextResponse.json({ error: 'plan_not_configured' }, { status: 503 })

  const sub = await getSubscription(user.uid)
  if (!sub?.razorpaySubscriptionId) return NextResponse.json({ error: 'no_subscription' }, { status: 409 })

  const ok = await updateSubscriptionPlan(sub.razorpaySubscriptionId, businessPlanId)
  if (!ok) return NextResponse.json({ error: 'razorpay_error' }, { status: 502 })

  // Persist immediately so entitlement reflects Business now; the webhook will
  // reconcile (applyTransition preserves the tier set here).
  try {
    await getStore().update<Subscription>(SUBSCRIPTIONS, user.uid, {
      plan: 'business', razorpayPlanId: businessPlanId, updatedAt: Date.now(),
    })
  } catch { /* webhook will still reconcile from the Razorpay-side change */ }

  return NextResponse.json({ ok: true, plan: 'business' }, { headers: { 'cache-control': 'private, no-store' } })
}
