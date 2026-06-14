// ─────────────────────────────────────────────────────────────────
// POST /api/trustseal/billing/subscribe  (asq-trustseal-billing-b3)
// Server-authoritative subscription creation. Authenticated (Firebase Bearer).
// Creates a Razorpay subscription with notes.uid stamped, stores a 'created'
// reference, and returns the hosted-checkout short_url. Does NOT grant Pro — the
// activation webhook (B2.2) does that. TEST MODE ONLY: refuses live-mode keys.
// No entitlement enforcement here (B4); no invoicing (B5).
// ─────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/trustseal/account'
import { getStore } from '@/lib/store/adapter'
import { getEntitlement } from '@/lib/billing/entitlement'
import { createPendingSubscription } from '@/lib/billing/writer'
import { createSubscription } from '@/lib/billing/razorpay'
import { planOption, isTestModeKey } from '@/lib/billing/plans'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // TEST MODE ONLY: refuse unless a test key is configured.
  if (!isTestModeKey(process.env.RAZORPAY_KEY_ID)) {
    return NextResponse.json({ error: 'live_mode_disabled' }, { status: 403 })
  }

  let interval = ''
  try { interval = String(((await req.json()) as { interval?: string })?.interval ?? '') } catch { /* empty */ }
  const opt = planOption(interval)
  if (!opt) return NextResponse.json({ error: 'invalid_plan' }, { status: 400 })

  const planId = process.env[opt.envVar]
  if (!planId) return NextResponse.json({ error: 'plan_not_configured' }, { status: 503 })

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
  })

  return NextResponse.json(
    { ok: true, subscriptionId: created.id, shortUrl: created.shortUrl, keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? null },
    { headers: { 'cache-control': 'private, no-store' } },
  )
}
