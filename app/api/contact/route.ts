// POST /api/contact  (PUBLIC, rate-limited) — store a contact/scam-report message
// and (when RESEND_API_KEY is set) email an admin notification + user
// autoresponder. Persistence is best-effort; email is env-gated. Always JSON.
import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store/adapter'
import { enforceRateLimit, RateLimitError } from '@/lib/ai/rate-limit'
import { clientIp } from '@/lib/admin-auth'
import { jsonRoute, ApiError } from '@/lib/api/json'
import { notifyContact } from '@/lib/email/notify'

export const dynamic = 'force-dynamic'

export const POST = jsonRoute('contact', async (req) => {
  try { await enforceRateLimit({ key: `contact:${clientIp(req)}`, limit: 5, windowMs: 600_000 }) }
  catch (e) { if (e instanceof RateLimitError) return NextResponse.json({ error: 'rate_limited', detail: 'Too many submissions; try again later.' }, { status: 429 }) }

  const b = await req.json().catch(() => ({})) as { name?: string; email?: string; message?: string; kind?: string; hp?: string; elapsedMs?: number }
  // Spam protection: honeypot field + submit-too-fast check. Return ok to avoid
  // signalling bots, but never persist.
  if ((b.hp || '').trim() || (typeof b.elapsedMs === 'number' && b.elapsedMs >= 0 && b.elapsedMs < 1500)) {
    return NextResponse.json({ ok: true, detail: 'Thanks — we received your message.' }, { headers: { 'Cache-Control': 'no-store' } })
  }
  const message = (b.message || '').trim()
  const email = (b.email || '').trim().slice(0, 200)
  if (message.length < 5) throw new ApiError('empty', 'Please enter a message.', 400)
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError('bad_email', 'Enter a valid email (optional).', 400)

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  try {
    await getStore().set('_contact', id, { name: (b.name || '').slice(0, 120), email, kind: (b.kind || 'general').slice(0, 40), message: message.slice(0, 4000), ip: clientIp(req), createdAt: new Date().toISOString() })
  } catch { /* best-effort */ }
  // Email notifications (admin + autoresponder). Awaited so the send completes in
  // the serverless lifecycle; never fails the request if email isn't configured.
  let emailed = { admin: false, user: false }
  try { emailed = await notifyContact({ name: b.name, email, kind: b.kind, message }) } catch { /* non-fatal */ }
  return NextResponse.json({ ok: true, detail: 'Thanks — we received your message.', emailed }, { headers: { 'Cache-Control': 'no-store' } })
})
