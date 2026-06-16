// GET /api/trustseal/api-key  (asq-trustseal-phase4)
// Authenticated: returns the signed-in account's deterministic Trust API key, its
// live plan, the plan's quota, and the current month's usage. The key authorizes
// higher Public Trust API quotas (see /api/trust/[domain]). Per-user, never cached.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/trustseal/account'
import { mintApiKey, apiKeysConfigured } from '@/lib/trustseal/api-key'
import { getEntitlement } from '@/lib/billing/entitlement'
import { quotaFor } from '@/lib/trustseal/quota'
import { readApiUsage } from '@/lib/trustseal/usage'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let plan = 'free'
  try { plan = (await getEntitlement(user.uid)).plan } catch { plan = 'free' }
  const quota = quotaFor(plan)
  const usage = await readApiUsage(user.uid)

  return NextResponse.json(
    {
      key: mintApiKey(user.uid),
      configured: apiKeysConfigured(),
      plan,
      quota: { requestsPerMinute: quota.rpm, monthly: quota.monthly },
      usage: { period: usage.period, count: usage.count },
    },
    { status: 200, headers: { 'cache-control': 'private, no-store' } },
  )
}
