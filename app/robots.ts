import { MetadataRoute } from 'next'
import { headers } from 'next/headers'

// Host-aware: the same deployment serves lab.* and scamcheck.*, so robots must
// advertise the correct per-host sitemap and preferred host (previously both
// pointed at the ScamCheck domain, which suppressed Lab indexing).
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = ((await headers()).get('host') || '').toLowerCase()
  const base = host.startsWith('lab.')
    ? 'https://lab.asquaresolution.com'
    : 'https://scamcheck.asquaresolution.com'
  return {
    rules: [
      { userAgent: '*', allow: ['/', '/api/og'], disallow: ['/api/', '/ops', '/syndicate'] },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
