// POST /api/scam-intel/subscribe  (PUBLIC, rate-limited)
// Lightweight capture for scam-alert email subscriptions. Stores the
// subscription request (double opt-in confirmation is a later step).
// Abuse-protected via per-identity rate limiting. No email is sent here.
import { NextResponse } from 'next/server'
import { getStore, genId } from '@/lib/store/adapter'
import { enforceRateLimit, RateLimitError } from '@/lib/ai/rate-limit'
import { clientIp } from '@/lib/admin-auth'
import { audit } from '@/lib/ai/audit'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: Request) {
  let body: { email?: string; region?: string; categories?: string[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }

  const email = (body.email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'valid email required' }, { status: 400 })

  const ipHash = hash(clientIp(req))
  try {
    await enforceRateLimit({ key: `subscribe:${ipHash}`, limit: 5, windowMs: 3_600_000 })
  } catch (e) {
    if (e instanceof RateLimitError) return NextResponse.json({ error: 'too many requests' }, { status: 429 })
    throw e
  }

  const id = `sub_${hash(email)}`
  await getStore().set('subscribers', id, {
    id, email,
    region: (body.region || '').slice(0, 60) || null,
    categories: Array.isArray(body.categories) ? body.categories.slice(0, 12) : [],
    confirmed: false,
    createdAt: Date.now(),
    token: genId('cf_'), // for a future double-opt-in confirmation link
  })
  await audit({ action: 'admin.action', actor: `public:${ipHash}`, ok: true, message: 'subscribe', subject: id })
  return NextResponse.json({ ok: true, message: 'Subscribed. Please confirm via the email we send (coming soon).' }, { status: 201 })
}

function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(36)
}
