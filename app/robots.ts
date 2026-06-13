import { MetadataRoute } from 'next'
import { headers } from 'next/headers'

// Host-aware: the same deployment serves lab.*, trustseal.* and scamcheck.*, so
// robots must advertise the correct per-host sitemap and preferred host (a host
// without its own branch falls through to ScamCheck, which suppressed indexing
// for that domain — that was the trustseal bug).
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = ((await headers()).get('host') || '').toLowerCase()
  const base = host.startsWith('lab.')
    ? 'https://lab.asquaresolution.com'
    : host.startsWith('trustseal.')
    ? 'https://trustseal.asquaresolution.com'
    : 'https://scamcheck.asquaresolution.com'
  return {
    rules: [
      { userAgent: '*', allow: ['/', '/api/og'], disallow: ['/api/', '/ops', '/syndicate'] },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
