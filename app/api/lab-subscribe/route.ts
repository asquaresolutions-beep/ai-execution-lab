// POST /api/lab-subscribe (PUBLIC, rate-limited) — AI Execution Lab Weekly signup.
// Stores the subscriber and (when email is configured) notifies admin + sends a
// welcome. Honeypot + rate limiting for spam protection. Always JSON.
import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store/adapter'
import { enforceRateLimit, RateLimitError } from '@/lib/ai/rate-limit'
import { clientIp } from '@/lib/admin-auth'
import { jsonRoute, ApiError } from '@/lib/api/json'
import { notifyLabSignup, emailConfigured } from '@/lib/email/notify'

export const dynamic = 'force-dynamic'

export const POST = jsonRoute('lab-subscribe', async (req) => {
  try { await enforceRateLimit({ key: `labsub:${clientIp(req)}`, limit: 5, windowMs: 3_600_000 }) }
  catch (e) { if (e instanceof RateLimitError) return NextResponse.json({ error: 'rate_limited', detail: 'Too many signups; try later.' }, { status: 429 }) }

  const b = await req.json().catch(() => ({})) as { name?: string; email?: string; hp?: string }
  if ((b.hp || '').trim()) return NextResponse.json({ ok: true, emailed: false }) // honeypot
  const email = (b.email || '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) throw new ApiError('bad_email', 'Enter a valid email.', 400)
  const name = (b.name || '').slice(0, 120)

  try {
    await getStore().set('lab_subscribers', `lab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, {
      name, email, list: 'ai-execution-lab-weekly', ip: clientIp(req), createdAt: new Date().toISOString(),
    })
  } catch { /* best-effort */ }

  let emailed = { admin: false, user: false }; let emailError: string | undefined
  try { const r = await notifyLabSignup({ name, email }); emailed = { admin: r.admin, user: r.user }; emailError = r.error } catch (e) { emailError = (e as Error).message }

  return NextResponse.json({
    ok: true,
    message: emailConfigured() ? 'Subscribed — check your inbox.' : 'Subscribed to AI Execution Lab Weekly.',
    emailed, ...(emailError ? { emailError } : {}),
  }, { headers: { 'Cache-Control': 'no-store' } })
})
