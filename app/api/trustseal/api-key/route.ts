// GET/POST /api/trustseal/api-key  (asq-trustseal-phase4 + hardening)
// GET: the account's current (stored) Trust API key + plan + quota + usage.
// POST {action:'rotate'|'revoke'}: rotate (new key, old invalidated) or revoke
// (remove the active key). Authenticated; per-user; never cached.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/trustseal/account'
import { getApiKey, rotateApiKey, revokeApiKey } from '@/lib/trustseal/api-key-store'
import { getEntitlement } from '@/lib/billing/entitlement'
import { quotaFor } from '@/lib/trustseal/quota'
import { readApiUsage } from '@/lib/trustseal/usage'

export const dynamic = 'force-dynamic'

async function planQuotaUsage(uid: string) {
  let plan = 'free'
  try { plan = (await getEntitlement(uid)).plan } catch { plan = 'free' }
  const quota = quotaFor(plan)
  const usage = await readApiUsage(uid)
  return { plan, quota: { requestsPerMinute: quota.rpm, monthly: quota.monthly }, usage: { period: usage.period, count: usage.count } }
}

export async function GET(req: Request) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { key, createdAt } = await getApiKey(user.uid)
  return NextResponse.json({ key, createdAt, ...(await planQuotaUsage(user.uid)) }, { headers: { 'cache-control': 'private, no-store' } })
}

export async function POST(req: Request) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let action = ''
  try { action = String(((await req.json()) as { action?: string })?.action ?? '') } catch { /* */ }

  if (action === 'rotate') {
    const { key, createdAt } = await rotateApiKey(user.uid)
    return NextResponse.json({ ok: true, key, createdAt, ...(await planQuotaUsage(user.uid)) }, { headers: { 'cache-control': 'private, no-store' } })
  }
  if (action === 'revoke') {
    await revokeApiKey(user.uid)
    return NextResponse.json({ ok: true, key: null, ...(await planQuotaUsage(user.uid)) }, { headers: { 'cache-control': 'private, no-store' } })
  }
  return NextResponse.json({ error: 'bad_request' }, { status: 400 })
}
