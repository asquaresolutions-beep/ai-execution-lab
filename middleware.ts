// middleware.ts
// Host-scoped routing for the scamcheck.asquaresolution.com product domain.
// Only acts when the request host is the scamcheck subdomain — the lab domain
// (and any other) passes through untouched. Two jobs:
//   1. Serve the screenshot analyzer at the ROOT ("/") of the scamcheck domain.
//   2. 301-redirect the legacy GitHub-Pages indexed URLs to their new
//      equivalents so existing SEO/indexing is preserved after the origin cutover.
// Path-scoped via `matcher` so it never runs on app routes or assets.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Legacy static URLs currently indexed on the GitHub Pages site → new pages.
const LEGACY_301: Record<string, string> = {
  '/scam-alerts': '/scam-intelligence',
  '/types-of-scams': '/scam-intelligence',
  '/how-to-report': '/scam-intelligence',
  '/protect-yourself': '/scam-intelligence',
}

function isScamCheckHost(host: string): boolean {
  return host.startsWith('scamcheck.') || host.startsWith('scamcheck-')
}

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').toLowerCase()
  if (!isScamCheckHost(host)) return NextResponse.next() // lab/other hosts untouched

  const { pathname } = req.nextUrl

  // Preserve indexed link-equity from the old static site.
  if (LEGACY_301[pathname]) {
    const url = req.nextUrl.clone()
    url.pathname = LEGACY_301[pathname]
    return NextResponse.redirect(url, 301)
  }

  // Root experience on the product domain = the screenshot analyzer.
  if (pathname === '/') {
    const url = req.nextUrl.clone()
    url.pathname = '/scamcheck'
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  // Run only on the root + the known legacy paths — nothing else.
  matcher: ['/', '/scam-alerts', '/types-of-scams', '/how-to-report', '/protect-yourself'],
}
