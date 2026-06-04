import { MetadataRoute } from 'next'
import { allIntelSlugs } from '@/lib/scam-intel/intel-pages'
import { allCheckerSlugs } from '@/lib/scamcheck/checkers'

// The public product served on this domain is ScamCheck. The sitemap therefore
// lists ONLY the ScamCheck product surface — every URL here is reachable (200)
// on scamcheck.asquaresolution.com. (Lab routes are not public and are blocked
// by middleware on this host, so they must not appear here or they'd 404.)
const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://scamcheck.asquaresolution.com').replace(/\/$/, '')

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const fixed: MetadataRoute.Sitemap = [
    { url: `${BASE}/`,                  lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE}/scam-intelligence`, lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/latest-scams`,      lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${BASE}/scam-database`,     lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${BASE}/scamcheck/screenshot`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    ...['/about', '/how-it-works', '/methodology', '/contact', '/privacy-policy', '/terms', '/disclaimer'].map((p) => ({
      url: `${BASE}${p}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.5,
    })),
  ]

  const checkers: MetadataRoute.Sitemap = allCheckerSlugs().map((slug) => ({
    url: `${BASE}/${slug}`, lastModified: now, changeFrequency: 'weekly', priority: 0.8,
  }))

  const intel: MetadataRoute.Sitemap = allIntelSlugs().map((slug) => ({
    url: `${BASE}/scam-intelligence/${slug}`, lastModified: now, changeFrequency: 'weekly', priority: 0.7,
  }))

  return [...fixed, ...checkers, ...intel]
}
