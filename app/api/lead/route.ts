// POST /api/lead (PUBLIC, CORS, rate-limited) — service lead form from the
// A Square Solutions site. Stores the lead + emails admin notification and a
// user autoresponder via Resend. CORS-enabled for asquaresolution.com origins.
// Honeypot + rate limit. Reuses the existing store + Resend infrastructure.
import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store/adapter'
import { enforceRateLimit, RateLimitError } from '@/lib/ai/rate-limit'
import { clientIp } from '@/lib/admin-auth'
import { notifyLead } from '@/lib/email/notify'

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
  try { await enforceRateLimit({ key: `lead:${clientIp(req)}`, limit: 8, windowMs: 600_000 }) }
  catch (e) { if (e instanceof RateLimitError) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429, headers: H }) }

  const b = await req.json().catch(() => ({})) as { name?: string; email?: string; service?: string; message?: string; source?: string; hp?: string }
  if ((b.hp || '').trim()) return NextResponse.json({ ok: true }, { headers: H }) // honeypot
  const email = (b.email || '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400, headers: H })
  const name = (b.name || '').slice(0, 120)
  const service = (b.service || '').slice(0, 80)
  const message = (b.message || '').slice(0, 4000)
  const source = (b.source || '').slice(0, 300)

  try {
    await getStore().set('leads', `lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, {
      name, email, service, message, source, ip: clientIp(req), createdAt: new Date().toISOString(),
    })
  } catch { /* best-effort */ }

  let emailed = { admin: false, user: false }; let emailError: string | undefined
  try { const r = await notifyLead({ name, email, service, message, source }); emailed = { admin: r.admin, user: r.user }; emailError = r.error } catch (e) { emailError = (e as Error).message }

  return NextResponse.json({ ok: true, message: 'Thanks — we\'ll be in touch within 24 hours.', emailed, ...(emailError ? { emailError } : {}) }, { headers: H })
}
