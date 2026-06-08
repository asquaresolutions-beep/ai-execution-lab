// POST /api/newsletter (PUBLIC, CORS, rate-limited) — newsletter signup from the
// A Square Solutions blog. Stores the subscriber and emails admin + welcome via
// Resend (when configured). CORS-enabled for the asquaresolution.com origins so
// the WordPress blog form can post here. Honeypot + rate limit for spam.
import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store/adapter'
import { enforceRateLimit, RateLimitError } from '@/lib/ai/rate-limit'
import { clientIp } from '@/lib/admin-auth'
import { notifyNewsletter, emailConfigured } from '@/lib/email/notify'
import { normalizeEmail, isValidEmail, subscriberDocId, normalizeVerdict, normalizeDevice } from '@/lib/newsletter/subscribers'

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

  const b = await req.json().catch(() => ({})) as { name?: string; email?: string; source?: string; verdict?: string; device?: string; consent?: boolean; hp?: string }
  if ((b.hp || '').trim()) return NextResponse.json({ ok: true, emailed: false }, { headers: H }) // honeypot
  const email = normalizeEmail(b.email)
  if (!isValidEmail(email)) return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400, headers: H })
  if (!b.consent) return NextResponse.json({ ok: false, error: 'consent_required' }, { status: 400, headers: H })
  const name = (b.name || '').slice(0, 120)
  const source = (b.source || '').slice(0, 300)
  const verdict = normalizeVerdict(b.verdict)         // scam | safe | suspicious | unknown
  const device = normalizeDevice(b.device)            // mobile | tablet | desktop
  const now = new Date().toISOString()
  const store = getStore()
  const id = subscriberDocId(email)                   // deterministic → one record per email

  // ── Idempotency: same email never creates a duplicate record, never re-emails.
  let existing = null
  try { existing = await store.get('newsletter', id) } catch { /* treat as not-found, fail open to subscribe */ }
  if (existing) {
    // Best-effort touch for analytics; never blocks the response.
    try { await store.update('newsletter', id, { lastSeenAt: now, lastSource: source, lastVerdict: verdict, lastDevice: device }) } catch { /* noop */ }
    return NextResponse.json({ ok: true, duplicate: true, message: 'You’re already subscribed — thanks!' }, { headers: H })
  }

  try {
    await store.set('newsletter', id, {
      name, email, source, verdict, device,
      list: 'asquare-newsletter', consent: true, ip: clientIp(req), createdAt: now,
    })
  } catch { /* best-effort persistence */ }

  let emailed = { admin: false, user: false }; let emailError: string | undefined
  try { const r = await notifyNewsletter({ name, email, source }); emailed = { admin: r.admin, user: r.user }; emailError = r.error } catch (e) { emailError = (e as Error).message }

  return NextResponse.json({
    ok: true,
    message: emailConfigured() ? 'Subscribed — check your inbox.' : 'Subscribed. Thanks!',
    emailed, ...(emailError ? { emailError } : {}),
  }, { headers: H })
}
