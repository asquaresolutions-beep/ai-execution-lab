import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lab.asquaresolution.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        // Allow OG image route (needed for Discover/social image fetching).
        allow: ['/', '/api/og'],
        // Block internal tools + other API routes from crawlers
        disallow: ['/api/', '/ops', '/syndicate'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
