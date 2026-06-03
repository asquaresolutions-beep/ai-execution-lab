// POST /api/scam-intel/quick-check  (PUBLIC, rate-limited)
//   { type: 'message'|'link'|'email'|'phone'|'upi', value: string }
// Instant, deterministic scam check for text/links/emails/phones/UPI IDs —
// no Vertex cost. Reuses detectors + URL intel + reputation. Always JSON.
import { NextResponse } from 'next/server'
import { analyzeTextSignals } from '@/lib/scam-intel/multimodal'
import { analyzeUrls } from '@/lib/scam-intel/url-intel'
import { domainReputation, emailReputation, upiReputation, phoneReputation, applyReputation } from '@/lib/scam-intel/reputation'
import { detectImpersonations } from '@/lib/scam-intel/impersonation'
import { enforceRateLimit, RateLimitError } from '@/lib/ai/rate-limit'
import { clientIp } from '@/lib/admin-auth'
import { resolveSubject } from '@/lib/api/identify'
import { consumeCredits } from '@/lib/credits/server-credits'
import { recordScan } from '@/lib/scamcheck/scan-history'
import { jsonRoute, ApiError } from '@/lib/api/json'

export const dynamic = 'force-dynamic'

type CheckType = 'message' | 'link' | 'email' | 'phone' | 'upi'
const STRONG = new Set(['otp_request', 'fake_payment', 'suspicious_link'])

function scoreSignals(signals: { id: string; severity: string }[], entityRisk: number, urlDanger: number): number {
  const danger = signals.filter((s) => s.severity === 'danger').length
  const warn = signals.filter((s) => s.severity === 'warn').length
  let risk = Math.min(100, danger * 28 + warn * 12 + entityRisk * 6 + urlDanger * 10)
  if (signals.some((s) => s.id === 'otp_request')) risk = Math.max(risk, 55)
  return risk
}

export const POST = jsonRoute('scam-intel/quick-check', async (req) => {
  try { await enforceRateLimit({ key: `quick:${clientIp(req)}`, limit: 60, windowMs: 60_000 }) }
  catch (e) { if (e instanceof RateLimitError) return NextResponse.json({ error: 'rate_limited' }, { status: 429 }) }

  const body = await req.json().catch(() => ({})) as { type?: CheckType; value?: string }
  const type = (body.type || 'message') as CheckType
  const value = (body.value || '').trim()
  if (!value || value.length < 3) throw new ApiError('empty', 'Provide a message, link, email, phone, or UPI ID.', 400)

  // Server-authoritative credit enforcement (text scans cost 1).
  const id = await resolveSubject(req)
  const credit = await consumeCredits(id.subject, type === 'message' || type === 'link' || type === 'email' || type === 'phone' || type === 'upi' ? type : 'message', id.loggedIn)
  if (!credit.ok) {
    return NextResponse.json({ error: 'out_of_credits', detail: `Daily limit reached (${credit.quota} scans). ${id.loggedIn ? '' : 'Sign in for 50/day.'}`, ...credit }, { status: 402 })
  }

  const ts = analyzeTextSignals(value)                 // entities + signals + category + tactics
  const urlFindings = analyzeUrls(ts.entities.urls.length ? ts.entities.urls : (type === 'link' ? [value] : []))
  const urlDanger = urlFindings.filter((f) => f.severity === 'danger').length
  const entityRisk = [ts.entities.shorteners, ts.entities.upiIds, ts.entities.qrPaymentRefs, ts.entities.phones].filter((a) => a.length).length

  // Type-specific reputation.
  const reputations = [] as ReturnType<typeof domainReputation>[]
  if (type === 'link') reputations.push(domainReputation(value))
  if (type === 'email') reputations.push(emailReputation(value))
  if (type === 'upi') reputations.push(upiReputation(value))
  if (type === 'phone') reputations.push(phoneReputation(value))
  for (const u of ts.entities.urls) reputations.push(domainReputation(u))
  for (const u of ts.entities.upiIds) reputations.push(upiReputation(u))

  // Brand-impersonation / look-alike detection over the value + any extracted
  // links/emails (catches typosquats, homoglyphs, deceptive subdomains).
  const emailsInText = value.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []
  const impCandidates = [...(type === 'link' || type === 'email' || type === 'upi' ? [value] : []), ...ts.entities.urls, ...emailsInText]
  const impersonations = detectImpersonations(impCandidates)
  const impDanger = impersonations.some((i) => i.severity === 'danger')

  let risk = scoreSignals(ts.signals, entityRisk, urlDanger)
  if (impersonations.length) risk = Math.max(risk, impDanger ? 85 : 60)
  const strongFraudSignal = ts.signals.some((s) => STRONG.has(s.id)) || urlDanger > 0 || impDanger
  const rep = applyReputation(risk, {
    domains: [...(type === 'link' ? [value] : []), ...ts.entities.urls],
    emails: type === 'email' ? [value] : [],
    upiIds: [...(type === 'upi' ? [value] : []), ...ts.entities.upiIds],
    strongFraudSignal,
  })
  risk = rep.risk

  const verdict = risk >= 70 ? 'likely_scam' : risk >= 35 ? 'suspicious' : rep.trusted ? 'likely_safe' : value.length < 12 ? 'unclear' : 'likely_safe'
  if (id.loggedIn && id.uid) void recordScan(id.uid, { ts: Date.now(), type, verdict, risk, label: ts.category })
  const advice: string[] = []
  if (impersonations.length) advice.push(`This looks like a fake look-alike of ${impersonations[0].brand} (real: ${impersonations[0].legitDomain}). Do not trust it — open the official app/website directly, never via this link.`)
  if (ts.signals.some((s) => s.id === 'otp_request')) advice.push('Never share an OTP/PIN/CVV — no bank or company asks for them.')
  if (ts.entities.qrPaymentRefs.length || ts.entities.upiIds.length) advice.push('Receiving money on UPI never needs a PIN or QR scan.')
  if (urlDanger) advice.push('Do not open look-alike/shortened links.')
  if (rep.trusted) advice.push('This matches a verified/official entity — but always confirm via the official app, not links in messages.')
  advice.push('If in doubt, do not click, pay, or share details. Report at cybercrime.gov.in / 1930 (India).')

  return NextResponse.json({
    type, verdict, riskScore: risk,
    credits: { remaining: credit.remaining, quota: credit.quota, resetsAt: credit.resetsAt },
    trusted: rep.trusted,
    category: ts.category, tactics: ts.tactics,
    impersonation: impersonations.map((i) => ({ host: i.host, brand: i.brand, legitDomain: i.legitDomain, techniques: i.techniques, detail: i.detail })),
    signals: [...impersonations.map((i) => ({ id: 'brand_impersonation', label: `Look-alike of ${i.brand}`, severity: i.severity === 'danger' ? 'danger' : 'warn' })), ...ts.signals],
    entities: { urls: ts.entities.urls, emails: type === 'email' ? [value] : [], phones: ts.entities.phones, upiIds: ts.entities.upiIds, amounts: ts.entities.amounts },
    urlFindings,
    reputation: reputations.slice(0, 6),
    reputationNotes: rep.notes,
    advice: Array.from(new Set(advice)).slice(0, 5),
  }, { headers: { 'Cache-Control': 'no-store' } })
})
