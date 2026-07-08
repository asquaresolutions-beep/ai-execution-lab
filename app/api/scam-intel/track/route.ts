// POST /api/scam-intel/track   (public, tightly constrained)
//
// The ONLY client-writable funnel event: `embed_view`. scan_start / scan_complete
// are logged server-side in the screenshot route (authoritative — never trusted
// from the client). This endpoint accepts ONLY { event: 'embed_view', embed_source }
// and can do nothing but bump an aggregate embed_view counter:
//   - event type is hard-checked (anything else is a no-op),
//   - embed_source is sanitized to a bounded slug in scan-log,
//   - per-IP rate-limited (60/min — ample for real embeds, caps spam),
//   - always returns 204 (no body, no data leak, no enumeration signal).
import { NextResponse } from 'next/server'
import { logScanEvent } from '@/lib/scam-intel/scan-log'
import { checkRateLimit } from '@/lib/ai/rate-limit'
import { clientIp } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const ip = clientIp(req)
  // Fail-open on a rate-limiter error (this is a harmless counter, not a gate).
  const rl = await checkRateLimit({ key: `track:${ip}`, limit: 60, windowMs: 60_000 }).catch(() => null)
  if (rl && !rl.allowed) return new NextResponse(null, { status: 204 })

  let body: { event?: unknown; embed_source?: unknown } = {}
  try { body = await req.json() } catch { /* ignore malformed body */ }

  if (body.event === 'embed_view') {
    await logScanEvent('embed_view', { embedSource: body.embed_source })
  }
  return new NextResponse(null, { status: 204 })
}
