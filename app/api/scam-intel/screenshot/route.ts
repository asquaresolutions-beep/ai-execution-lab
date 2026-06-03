// POST /api/scam-intel/screenshot   (public, rate-limited)
//   - JSON:        { imageBase64, mime?, forceDeep? }
//   - multipart:   form field `image` (file) [+ `forceDeep`]
// Multimodal screenshot scam analysis: OCR → enrichment + visual signals →
// semantic similarity → gated deep vision. Always returns structured JSON.
import { NextResponse } from 'next/server'
import { analyzeScreenshot } from '@/lib/scam-intel/multimodal'
import { enforceRateLimit, RateLimitError } from '@/lib/ai/rate-limit'
import { clientIp } from '@/lib/admin-auth'
import { jsonRoute, ApiError } from '@/lib/api/json'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_BYTES = 6 * 1024 * 1024 // 6MB
const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

export const POST = jsonRoute('scam-intel/screenshot', async (req) => {
  try {
    await enforceRateLimit({ key: `screenshot:${clientIp(req)}`, limit: 12, windowMs: 60_000 })
  } catch (e) {
    if (e instanceof RateLimitError) return NextResponse.json({ error: 'rate_limited', detail: 'Too many screenshot scans; try again shortly.' }, { status: 429 })
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
    mime = file.type || 'image/png'
    if (!ALLOWED.includes(mime)) throw new ApiError('unsupported_type', `image type ${mime} not supported (png/jpeg/webp)`, 415)
    const buf = Buffer.from(await file.arrayBuffer())
    if (buf.length > MAX_BYTES) throw new ApiError('too_large', `image exceeds ${MAX_BYTES} bytes`, 413)
    base64 = buf.toString('base64')
  } else {
    const body = await req.json().catch(() => ({})) as { imageBase64?: string; mime?: string; forceDeep?: boolean }
    base64 = (body.imageBase64 || '').replace(/^data:[^;]+;base64,/, '')
    mime = body.mime || 'image/png'
    forceDeep = !!body.forceDeep
    if (!base64) throw new ApiError('no_image', 'provide imageBase64 (or multipart `image`)', 400)
    if (!ALLOWED.includes(mime)) throw new ApiError('unsupported_type', `image type ${mime} not supported (png/jpeg/webp)`, 415)
    if (Buffer.byteLength(base64, 'base64') > MAX_BYTES) throw new ApiError('too_large', `image exceeds ${MAX_BYTES} bytes`, 413)
  }

  const result = await analyzeScreenshot(base64, mime, { forceDeep })
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
})
