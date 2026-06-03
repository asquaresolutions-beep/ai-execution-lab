// POST /api/scam-intel/screenshot   (public, rate-limited)
//   - JSON:        { imageBase64, mime?, forceDeep? }
//   - multipart:   form field `image` (file) [+ `forceDeep`]
// Multimodal screenshot scam analysis: OCR → enrichment + visual signals →
// semantic similarity → gated deep vision. Always returns structured JSON.
import { NextResponse } from 'next/server'
import { analyzeScreenshot } from '@/lib/scam-intel/multimodal'
import { enforceRateLimit, RateLimitError } from '@/lib/ai/rate-limit'
import { clientIp } from '@/lib/admin-auth'
import { resolveSubject } from '@/lib/api/identify'
import { consumeCredits } from '@/lib/credits/server-credits'
import { recordScan } from '@/lib/scamcheck/scan-history'
import { jsonRoute, ApiError } from '@/lib/api/json'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_BYTES = 6 * 1024 * 1024 // 6MB

// Magic-byte signatures — reject payloads whose bytes don't match an allowed
// image type, regardless of declared mime (anti malicious-payload). (goal 11)
function sniffImage(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

export const POST = jsonRoute('scam-intel/screenshot', async (req) => {
  const ip = clientIp(req)
  try {
    // Per-minute + per-day caps (anti image-spam / repeated uploads). (goal 11)
    await enforceRateLimit({ key: `screenshot:min:${ip}`, limit: 12, windowMs: 60_000 })
    await enforceRateLimit({ key: `screenshot:day:${ip}`, limit: 200, windowMs: 86_400_000 })
  } catch (e) {
    if (e instanceof RateLimitError) return NextResponse.json({ error: 'rate_limited', detail: 'Too many screenshot scans; try again later.' }, { status: 429 })
  }

  let base64 = ''
  let mime = 'image/png'
  let forceDeep = false
  const ctype = req.headers.get('content-type') || ''

  if (ctype.includes('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('image')
    forceDeep = form.get('forceDeep') === 'true'
    if (!(file instanceof File)) throw new ApiError('no_image', 'multipart form must include an `image` file', 400)
    const buf = Buffer.from(await file.arrayBuffer())
    if (buf.length > MAX_BYTES) throw new ApiError('too_large', `image exceeds ${MAX_BYTES} bytes`, 413)
    const sniffed = sniffImage(buf)
    if (!sniffed) throw new ApiError('invalid_payload', 'file is not a valid PNG/JPEG/WebP image', 415)
    mime = sniffed
    base64 = buf.toString('base64')
  } else {
    const body = await req.json().catch(() => ({})) as { imageBase64?: string; mime?: string; forceDeep?: boolean }
    base64 = (body.imageBase64 || '').replace(/^data:[^;]+;base64,/, '')
    forceDeep = !!body.forceDeep
    if (!base64) throw new ApiError('no_image', 'provide imageBase64 (or multipart `image`)', 400)
    if (Buffer.byteLength(base64, 'base64') > MAX_BYTES) throw new ApiError('too_large', `image exceeds ${MAX_BYTES} bytes`, 413)
    const buf = Buffer.from(base64, 'base64')
    const sniffed = sniffImage(buf)
    if (!sniffed) throw new ApiError('invalid_payload', 'data is not a valid PNG/JPEG/WebP image', 415)
    mime = sniffed
  }

  // Server-authoritative credit enforcement (screenshot scans cost 3).
  const sid = await resolveSubject(req)
  const credit = await consumeCredits(sid.subject, 'screenshot', sid.loggedIn)
  if (!credit.ok) {
    return NextResponse.json({ error: 'out_of_credits', detail: `Daily limit reached (${credit.quota} credits; screenshots use 3). ${sid.loggedIn ? '' : 'Sign in for 50/day.'}`, ...credit }, { status: 402 })
  }

  const result = await analyzeScreenshot(base64, mime, { forceDeep })
  if (sid.loggedIn && sid.uid) void recordScan(sid.uid, { ts: Date.now(), type: 'screenshot', verdict: result.verdict, risk: result.riskScore, label: result.campaignLabel })
  return NextResponse.json({ ...result, credits: { remaining: credit.remaining, quota: credit.quota, resetsAt: credit.resetsAt } }, { headers: { 'Cache-Control': 'no-store' } })
})

