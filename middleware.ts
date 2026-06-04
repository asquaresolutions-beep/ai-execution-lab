// middleware.ts
// Host-scoped routing for the scamcheck.asquaresolution.com product domain.
// Only acts when the request host is the scamcheck subdomain — the lab domain
// (and any other host) passes through untouched. Responsibilities:
//   1. Serve the screenshot analyzer at the ROOT ("/") of the scamcheck domain.
//   2. 301-redirect the legacy GitHub-Pages indexed URLs → new equivalents
//      (preserve SEO/indexing after the origin cutover).
//   3. Temporary 404-protection: on the scamcheck host, only the ScamCheck
//      product surface + legal pages + required APIs are reachable; lab-only
//      routes return 404 so the product domain stays focused & SEO-clean.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const LEGACY_301: Record<string, string> = {
  '/scam-alerts': '/scam-intelligence',
  '/types-of-scams': '/scam-intelligence',
  '/how-to-report': '/scam-intelligence',
  '/protect-yourself': '/scam-intelligence',
  // Clean nav aliases → canonical pages (no nav item 404s).
  '/trending-scams': '/scam-intelligence',
  '/screenshot-scanner': '/scamcheck/screenshot',
  '/report-scam': '/contact',
  '/my-dashboard': '/scamcheck/account',
  '/scam-guides': '/scam-database',
}

// Path prefixes allowed on the scamcheck product domain.
const ALLOW_PREFIXES = [
  '/scamcheck', '/scam-intelligence', '/scam-database', '/latest-scams',
  '/privacy-policy', '/terms', '/contact', '/about', '/how-it-works', '/methodology', // legal + E-E-A-T
  '/api/scam-intel', '/api/geo', '/api/semantic-search', '/api/credits', '/api/scans', '/api/contact',
  '/_next', '/sitemap', '/robots', '/manifest', '/icon', '/apple-icon', '/opengraph-image', '/favicon',
]

function isScamCheckHost(host: string): boolean {
  return host.startsWith('scamcheck.') || host.startsWith('scamcheck-')
}
function isAllowed(path: string): boolean {
  if (path === '/') return true
  if (/\.[a-z0-9]+$/i.test(path)) return true        // static assets (.png/.xml/.ico…)
  if (path.endsWith('-scam-checker')) return true     // SEO checker landing pages
  return ALLOW_PREFIXES.some((p) => path === p || path.startsWith(p + '/') || path.startsWith(p))
}

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').toLowerCase()
  if (!isScamCheckHost(host)) return NextResponse.next() // lab/other hosts untouched

  const { pathname } = req.nextUrl

  // 1. Preserve legacy indexed URLs (301).
  if (LEGACY_301[pathname]) {
    const url = req.nextUrl.clone(); url.pathname = LEGACY_301[pathname]
    return NextResponse.redirect(url, 301)
  }
  // Lab programmatic /scams + /scams/hub/* aren't part of the product → 301 to
  // the product's trending intelligence (fixes those 404s on this domain).
  if (pathname === '/scams' || pathname.startsWith('/scams/')) {
    const url = req.nextUrl.clone(); url.pathname = '/scam-intelligence'; url.search = ''
    return NextResponse.redirect(url, 301)
  }
  // 2. Root experience = the screenshot analyzer.
  if (pathname === '/') {
    const url = req.nextUrl.clone(); url.pathname = '/scamcheck'
    return NextResponse.rewrite(url)
  }
  // 3. Temporary 404-protection for non-ScamCheck routes on this domain.
  if (!isAllowed(pathname)) {
    return new NextResponse('Not Found', { status: 404, headers: { 'content-type': 'text/plain' } })
  }
  return NextResponse.next()
}

export const config = {
  // Run on everything except Next internals/static; host + path gating is in code.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
