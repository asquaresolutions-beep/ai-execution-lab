// GET /api/trust/[domain]  (asq-trustseal-phase2 — Public Trust API)
// The public, documented trust-verification endpoint. Any platform can query a
// domain's TrustSeal status and get a stable JSON contract:
//   { domain, verified, status, trustLevel, score, confidence,
//     verificationDate, lastChecked, sealUrl, breakdown[], signals[] }
// SSRF-FREE: reuses getSealData (Firestore doc-id reads only — no engine / dns /
// outbound). CORS '*' (cross-origin integrations). Rate-limited per client IP.
// CDN-cached so most reads never reach Firestore. This is the moat: TrustSeal as
// a queryable trust source other products integrate.
import { NextResponse } from 'next/server'
import { getSealData } from '@/lib/trustseal/seal'
import { bandMeta } from '@/lib/trustseal/band'
import { rateLimit, clientIp } from '@/lib/trustseal/rate-limit'
import { apiKeyFromRequest, resolveApiKey } from '@/lib/trustseal/api-key'
import { quotaFor } from '@/lib/trustseal/quota'
import { getEntitlement } from '@/lib/billing/entitlement'
import { recordApiUsage } from '@/lib/trustseal/usage'

export const dynamic = 'force-dynamic'

const TRUST_BASE = (process.env.TRUSTSEAL_BASE_URL || 'https://trustseal.asquaresolution.com').replace(/\/$/, '')

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
}
// Cacheable: status changes are reflected within the TTL; revocation/expiry are
// short-windowed so a bad domain can't stay "good" for long.
const CACHE = 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: Request, { params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const raw = decodeURIComponent(domain || '')

  // ── plan-based quota (Part 6) ──
  // A valid API key resolves to an account whose LIVE plan sets the rate limit and
  // is metered per month; anonymous callers get the Free tier, limited by IP and
  // CDN-cached. Keyed responses are not cached (vary per account).
  const accountId = resolveApiKey(apiKeyFromRequest(req))
  let plan = 'free'
  if (accountId) {
    try { plan = (await getEntitlement(accountId)).plan } catch { plan = 'free' }
  }
  const quota = quotaFor(plan)
  const limitKey = accountId ? `trust-api:acct:${accountId}` : `trust-api:ip:${clientIp(req)}`
  const rl = rateLimit(limitKey, quota.rpm, 60_000)
  const rlHeaders = {
    'x-ratelimit-limit': String(rl.limit),
    'x-ratelimit-remaining': String(rl.remaining),
    'x-ratelimit-reset': String(Math.ceil(rl.resetAt / 1000)),
    'x-plan': plan,
    // Cache MUST vary on the API key so a keyed (per-plan, metered, no-store)
    // request is never served the CDN-cached anonymous Free response, and vice versa.
    'vary': 'x-api-key',
  }
  // Keyed calls are metered + uncacheable; anonymous calls are CDN-cacheable.
  const cacheHeader = accountId ? 'private, no-store' : CACHE
  if (accountId) void recordApiUsage(accountId)

  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many requests. Try again shortly.', plan, limit: quota.rpm },
      { status: 429, headers: { ...CORS, ...rlHeaders, 'retry-after': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    )
  }

  const data = await getSealData(raw)
  if (!data) {
    return NextResponse.json(
      { domain: raw, verified: false, status: 'unverified', trustLevel: null, score: null, sealUrl: null },
      { status: 200, headers: { ...CORS, ...rlHeaders, 'cache-control': cacheHeader } },
    )
  }

  const r = data.report
  const meta = bandMeta(r?.band ?? 'verified')
  const body = {
    domain: data.domain,
    verified: true,
    status: r?.band ?? 'verified',
    trustLevel: meta.name, // human label: Verified / Established / Limited / Caution / Risk
    score: r?.score ?? null,
    confidence: r?.confidence ?? null,
    verificationMethod: data.method,
    verificationDate: new Date(data.verifiedAt).toISOString(),
    lastChecked: data.lastCheckedAt ? new Date(data.lastCheckedAt).toISOString() : null,
    sealUrl: `${TRUST_BASE}/en/trust/${data.domain}`,
    // Explainable score (Part 3): per-category sub-scores + the per-signal proof.
    breakdown: r?.categories ?? [],
    signals: r?.signals?.map((s) => ({ id: s.id, category: s.category, status: s.status, evidence: s.evidence })) ?? [],
  }
  return NextResponse.json(body, { status: 200, headers: { ...CORS, ...rlHeaders, 'cache-control': cacheHeader } })
}
