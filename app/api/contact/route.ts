// POST /api/contact  (PUBLIC, rate-limited) — store a contact/scam-report message.
// Best-effort persistence to the document store; never sends email directly
// (no SMTP configured). Always returns JSON.
import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store/adapter'
import { enforceRateLimit, RateLimitError } from '@/lib/ai/rate-limit'
import { clientIp } from '@/lib/admin-auth'
import { jsonRoute, ApiError } from '@/lib/api/json'

export const dynamic = 'force-dynamic'

export const POST = jsonRoute('contact', async (req) => {
  try { await enforceRateLimit({ key: `contact:${clientIp(req)}`, limit: 5, windowMs: 600_000 }) }
  catch (e) { if (e instanceof RateLimitError) return NextResponse.json({ error: 'rate_limited', detail: 'Too many submissions; try again later.' }, { status: 429 }) }

  const b = await req.json().catch(() => ({})) as { name?: string; email?: string; message?: string; kind?: string }
  const message = (b.message || '').trim()
  const email = (b.email || '').trim().slice(0, 200)
  if (message.length < 5) throw new ApiError('empty', 'Please enter a message.', 400)
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError('bad_email', 'Enter a valid email (optional).', 400)

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  try {
    await getStore().set('_contact', id, { name: (b.name || '').slice(0, 120), email, kind: (b.kind || 'general').slice(0, 40), message: message.slice(0, 4000), ip: clientIp(req), createdAt: new Date().toISOString() })
  } catch { /* best-effort */ }
  return NextResponse.json({ ok: true, detail: 'Thanks — we received your message.' }, { headers: { 'Cache-Control': 'no-store' } })
})
