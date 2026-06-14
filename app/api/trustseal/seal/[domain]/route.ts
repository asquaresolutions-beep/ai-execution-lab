// GET /api/trustseal/seal/[domain]  (asq-trustseal-pr5)
// PUBLIC, read-only live status for the embeddable badge. SSRF-FREE: reuses PR-4's
// getSealData (Firestore doc-id reads only — no engine, no node:dns, no outbound).
// CORS '*' (read by third-party sites) exposing only the public projection.
// CDN-cached (s-maxage) so most embedding page-views never hit Firestore (scale),
// while a short TTL keeps revocation/expiry fresh. Signature is anti-forgery
// defense-in-depth; absent when TRUSTSEAL_SEAL_SECRET is unset (graceful).
import { NextResponse } from 'next/server'
import { getSealData, getVerifiedClaimAccountId } from '@/lib/trustseal/seal'
import { signSeal } from '@/lib/trustseal/seal-sign'
import { isBadgeEntitled } from '@/lib/billing/enforce'

export const dynamic = 'force-dynamic'

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'cache-control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, 'access-control-allow-methods': 'GET, OPTIONS' } })
}

export async function GET(_req: Request, { params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const data = await getSealData(decodeURIComponent(domain || ''))

  if (!data) {
    // Unknown/unverified → explicit unverified (the badge renders a neutral state).
    return NextResponse.json({ domain: decodeURIComponent(domain || ''), verified: false, badgeEntitled: false }, { status: 200, headers: CORS })
  }

  // B4 enforcement: the EMBEDDABLE badge is a Pro capability. Resolve the owning
  // account (server-side, never exposed) and gate the badge on its entitlement.
  // The domain stays publicly "verified" (the seal page is free) — only the
  // embeddable badge widget is Pro-gated.
  const accountId = await getVerifiedClaimAccountId(data.domain)
  const badgeEntitled = accountId ? await isBadgeEntitled(accountId) : false

  const issuedAt = Date.now()
  const status = data.report?.band ?? 'verified'
  return NextResponse.json(
    {
      domain: data.domain,
      verified: true,
      badgeEntitled,
      status,
      band: data.report?.band ?? null,
      score: data.report?.score ?? null,
      verifiedAt: data.verifiedAt,
      checkedAt: data.lastCheckedAt,
      issuedAt,
      signature: signSeal({ domain: data.domain, status, issuedAt }),
      sealUrl: `/en/trust/${data.domain}`,
    },
    { status: 200, headers: CORS },
  )
}
