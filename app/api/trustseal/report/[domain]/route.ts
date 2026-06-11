// GET /api/trustseal/report/[domain]  (PUBLIC, read-only — the live seal/report link)
// Returns the latest PERSISTED verification for a domain. Does NOT recompute; a
// `stale` flag marks past-TTL or superseded-engine results. 404 if never verified.
import { NextResponse } from 'next/server'
import { getStoredReport } from '@/lib/trustseal/verify/service'
import { publicReport } from '@/lib/trustseal/verify/policy'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const found = await getStoredReport(decodeURIComponent(domain || ''))
  if (!found) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json(
    { ...publicReport(found.report), stale: found.stale },
    { status: 200, headers: { 'cache-control': 'public, max-age=300, s-maxage=600' } },
  )
}
