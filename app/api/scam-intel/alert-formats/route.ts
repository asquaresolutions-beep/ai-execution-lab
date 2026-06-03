// GET /api/scam-intel/alert-formats?type=<scamType>&place=<city/bank/platform>
// Deterministic, channel-native alert snippets (X/LinkedIn/WhatsApp/Telegram/Shorts).
// No AI, no DB → fully CDN-cacheable. Powers social distribution + share buttons.
import { NextResponse } from 'next/server'
import { formatAlert } from '@/lib/distribution/alert-formats'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const typeId = sp.get('type') || ''
  if (!typeId) return NextResponse.json({ error: 'type required' }, { status: 400 })
  const formats = formatAlert({ typeId, place: sp.get('place') || undefined })
  if (!formats) return NextResponse.json({ error: 'unknown scam type' }, { status: 404 })
  return NextResponse.json(formats, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
  })
}
