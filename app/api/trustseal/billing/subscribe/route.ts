// ─────────────────────────────────────────────────────────────────
// POST /api/trustseal/billing/subscribe  (asq-trustseal-billing-b3)
// Server-authoritative subscription creation. Authenticated (Firebase Bearer).
// Creates a Razorpay subscription with notes.uid stamped, stores a 'created'
// reference, and returns the hosted-checkout short_url. Does NOT grant Pro — the
// activation webhook (B2.2) does that. Works in live OR test mode (any configured
// Razorpay key); refuses only when billing is unconfigured.
// No entitlement enforcement here (B4); no invoicing (B5).
// ─────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/trustseal/account'
import { getStore } from '@/lib/store/adapter'
import { getEntitlement } from '@/lib/billing/entitlement'
import { createPendingSubscription } from '@/lib/billing/writer'
import { createSubscription } from '@/lib/billing/razorpay'
import { planOption, isRazorpayConfigured } from '@/lib/billing/plans'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Require a configured Razorpay key (test OR live); refuse only when unconfigured.
  if (!isRazorpayConfigured(process.env.RAZORPAY_KEY_ID)) {
    return NextResponse.json({ error: 'billing_not_configured' }, { status: 503 })
  }

  let interval = ''
  let plan: 'pro' | 'business' = 'pro'
  try {
    const body = (await req.json()) as { interval?: string; plan?: string }
    interval = String(body?.interval ?? '')
    if (body?.plan === 'business' || body?.plan === 'pro') plan = body.plan
  } catch { /* empty */ }
  const opt = planOption(interval, plan)
  if (!opt) return NextResponse.json({ error: 'invalid_plan' }, { status: 400 })

  // The Razorpay plan id for this tier+interval must be configured (e.g.
  // RAZORPAY_PLAN_BUSINESS_MONTHLY). Until the Business SKU is set, business
  // checkout returns plan_not_configured and the UI falls back to contact-sales.
  const planId = process.env[opt.envVar]
  if (!planId) return NextResponse.json({ error: 'plan_not_configured', plan, interval }, { status: 503 })

  // Server-authoritative guard: a currently-entitled account cannot double-subscribe.
  const ent = await getEntitlement(user.uid)
  if (ent.active) return NextResponse.json({ error: 'already_subscribed' }, { status: 409 })

  const created = await createSubscription({ planId, uid: user.uid, totalCount: opt.totalCount })
  if (!created) return NextResponse.json({ error: 'razorpay_error' }, { status: 502 })

  await createPendingSubscription(getStore(), {
    uid: user.uid,
    interval: opt.interval,
    razorpaySubscriptionId: created.id,
    razorpayPlanId: planId,
    razorpayCustomerId: created.customerId,
    plan: opt.tier, // 'pro' | 'business' — preserved through all webhook transitions
  })

  return NextResponse.json(
    { ok: true, subscriptionId: created.id, shortUrl: created.shortUrl, keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? null },
    { headers: { 'cache-control': 'private, no-store' } },
  )
}
