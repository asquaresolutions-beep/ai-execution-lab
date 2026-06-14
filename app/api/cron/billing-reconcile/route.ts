// ─────────────────────────────────────────────────────────────────
// GET /api/cron/billing-reconcile  (asq-trustseal-billing-b2-3)
// Scheduled reconciliation: heals subscription drift from missed/delayed/dropped
// Razorpay webhooks by reading the authoritative snapshot. Authenticated via
// CRON_SECRET (isAuthorizedCron). Idempotent + fail-closed — see lib/billing/
// reconcile.ts. Audits every healed account; never mutates on a fetch failure.
// ─────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { getStore } from '@/lib/store/adapter'
import { reconcileDue } from '@/lib/billing/reconcile'
import { fetchSubscriptionSnapshot } from '@/lib/billing/razorpay'
import { audit } from '@/lib/ai/audit'
import { reportError } from '@/lib/observability/errors'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const { scanned, healed, outcomes } = await reconcileDue(getStore(), fetchSubscriptionSnapshot, { limit: 200 })
    for (const o of outcomes) {
      if (o.healed) {
        await audit({ action: 'billing.reconcile', actor: 'system', subject: o.uid, ok: true, meta: { from: o.from, to: o.to } })
      }
    }
    return NextResponse.json({ ok: true, scanned, healed })
  } catch (err) {
    await reportError('cron.billing_reconcile', err, { severity: 'error' })
    return NextResponse.json({ error: 'reconcile_failed' }, { status: 500 })
  }
}
