// POST /api/newsletter (PUBLIC, CORS, rate-limited) — newsletter signup from the
// A Square Solutions blog. Stores the subscriber and emails admin + welcome via
// Resend (when configured). CORS-enabled for the asquaresolution.com origins so
// the WordPress blog form can post here. Honeypot + rate limit for spam.
import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store/adapter'
import { enforceRateLimit, RateLimitError } from '@/lib/ai/rate-limit'
import { clientIp } from '@/lib/admin-auth'
import { notifyNewsletter, emailConfigured } from '@/lib/email/notify'

export const dynamic = 'force-dynamic'

const ALLOW = new Set(['https://asquaresolution.com', 'https://www.asquaresolution.com', 'https://lab.asquaresolution.com', 'https://scamcheck.asquaresolution.com'])
function cors(origin: string | null): Record<string, string> {
  const o = origin && ALLOW.has(origin) ? origin : 'https://asquaresolution.com'
  return { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Vary': 'Origin' }
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get('origin')) })
}

export async function POST(req: Request) {
  const H = { ...cors(req.headers.get('origin')), 'Cache-Control': 'no-store' }
  try { await enforceRateLimit({ key: `newsletter:${clientIp(req)}`, limit: 6, windowMs: 3_600_000 }) }
  catch (e) { if (e instanceof RateLimitError) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429, headers: H }) }

  const b = await req.json().catch(() => ({})) as { name?: string; email?: string; source?: string; consent?: boolean; hp?: string }
  if ((b.hp || '').trim()) return NextResponse.json({ ok: true, emailed: false }, { headers: H }) // honeypot
  const email = (b.email || '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400, headers: H })
  if (!b.consent) return NextResponse.json({ ok: false, error: 'consent_required' }, { status: 400, headers: H })
  const name = (b.name || '').slice(0, 120)
  const source = (b.source || '').slice(0, 300)

  try {
    await getStore().set('newsletter', `nl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, {
      name, email, source, list: 'asquare-newsletter', consent: true, ip: clientIp(req), createdAt: new Date().toISOString(),
    })
  } catch { /* best-effort */ }

  let emailed = { admin: false, user: false }; let emailError: string | undefined
  try { const r = await notifyNewsletter({ name, email, source }); emailed = { admin: r.admin, user: r.user }; emailError = r.error } catch (e) { emailError = (e as Error).message }

  return NextResponse.json({
    ok: true,
    message: emailConfigured() ? 'Subscribed — check your inbox.' : 'Subscribed. Thanks!',
    emailed, ...(emailError ? { emailError } : {}),
  }, { headers: H })
}
