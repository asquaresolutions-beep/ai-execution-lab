// POST /api/scam-intel/ingest  (PUBLIC, rate-limited + abuse-protected)
// Body: { text, platform?, region?, sourceUrl? }
import { NextResponse } from 'next/server'
import { ingestReport } from '@/lib/scam-intel/ingest'
import { clientIp } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: Request) {
  let body: { text?: string; platform?: string; region?: string; sourceUrl?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  if (!body?.text || body.text.trim().length < 8) {
    return NextResponse.json({ error: 'text is required (min 8 chars)' }, { status: 400 })
  }

  const result = await ingestReport({
    text: body.text,
    platform: body.platform,
    region: body.region,
    sourceUrl: body.sourceUrl,
    ip: clientIp(req),
  })

  const code = result.status === 'blocked' ? 429
    : result.status === 'spam' ? 422
    : result.status === 'accepted' ? 201
    : 202
  return NextResponse.json(result, { status: code })
}
