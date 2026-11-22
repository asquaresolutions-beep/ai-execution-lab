import { NextResponse } from 'next/server'
// The same serializer Next's generated metadata route used for the former app/sitemap.ts
// (next/dist/build/webpack/loaders/next-metadata-route-loader.js), so the XML is unchanged.
// `.js` suffix: next has no "exports" map, so plain Node ESM (the eval harness) needs it.
import { resolveRouteData } from 'next/dist/build/webpack/loaders/metadata/resolve-route-data.js'
import { buildSitemap } from '@/lib/seo/sitemap'

// Shared CDN cache for /sitemap.xml (Nov 2026 usage work). The function reads only the Host
// header. Vercel's CDN cache key includes the host and the deployment, so the three hosts keep
// separate entries and a new deployment starts fresh. Lab and ScamCheck content only changes
// with a deploy; the TrustSeal list of verified domains can lag by ~5 min (worst case one stale
// response inside the SWR hour). Vercel-CDN-Cache-Control is CDN-only: browsers and crawlers
// still receive the original Cache-Control.
//
// The header is set here, not as a path-wide rule in next.config.mjs, because only this code
// knows whether the TrustSeal verified-domain query succeeded. A degraded TrustSeal fallback
// (store unavailable → static entries only) is returned WITHOUT it, so the edge never holds it.
const CDN_CACHE = 'max-age=300, stale-while-revalidate=3600'

export async function GET(request: Request) {
  const host = (request.headers.get('host') || '').toLowerCase()
  const { entries, degraded } = await buildSitemap(host)
  const headers: Record<string, string> = {
    // Content-Type and Cache-Control exactly as the generated metadata route sent them.
    'Content-Type': 'application/xml',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  }
  if (!degraded) headers['Vercel-CDN-Cache-Control'] = CDN_CACHE
  return new NextResponse(resolveRouteData(entries, 'sitemap'), { headers })
}
