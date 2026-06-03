import { MetadataRoute } from 'next'
import { getAllMeta, type ContentSection } from '@/lib/content'
import { SECTION_META } from '@/lib/utils'
import { TRACKS, getAllLessonPaths } from '@/lib/tracks'
import { buildTagIndex } from '@/lib/tags'
import { allScamPaths } from '@/lib/seo/paths'
import { trustPageSlugs } from '@/lib/seo/trust-pages'
import { allIntelSlugs } from '@/lib/scam-intel/intel-pages'
import { allCheckerSlugs } from '@/lib/scamcheck/checkers'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lab.asquaresolution.com'
const SCAM_BASE = process.env.NEXT_PUBLIC_SCAM_BASE_URL ?? BASE_URL

const SECTIONS: ContentSection[] = ['docs', 'systems', 'labs', 'case-studies', 'playbooks', 'failures', 'logs']

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL,                         lastModified: new Date(), changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/start-here`,         lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    // /ops and /syndicate are noindex internal tools — excluded from sitemap
    ...SECTIONS.map((section) => ({
      url: `${BASE_URL}${SECTION_META[section].href}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]

  const contentRoutes: MetadataRoute.Sitemap = SECTIONS.flatMap((section) =>
    getAllMeta(section).map((item) => ({
      url: `${BASE_URL}${SECTION_META[section].href}/${item.slug}`,
      lastModified: new Date(item.frontmatter.updated ?? item.frontmatter.date),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))
  )

  // Tag routes
  const tagRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/tags`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    ...buildTagIndex().map(({ tag }) => ({
      url: `${BASE_URL}/tags/${tag}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
  ]

  // Track routes
  const trackRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/tracks`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.9 },
    ...TRACKS.map((track) => ({
      url: `${BASE_URL}/tracks/${track.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...getAllLessonPaths()
      .filter(({ track: t, module: m, lesson: l }) => {
        const tr = TRACKS.find((x) => x.id === t)
        const mod = tr?.modules.find((x) => x.id === m)
        const les = mod?.lessons.find((x) => x.id === l)
        return les?.status === 'available'
      })
      .map(({ track: t, module: m, lesson: l }) => ({
        url: `${BASE_URL}/tracks/${t}/${m}/${l}`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      })),
  ]

  // Widgets gallery (backlink-attraction page) + trust/E-E-A-T pages
  const widgetRoute: MetadataRoute.Sitemap = [
    { url: `${SCAM_BASE}/widgets`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    ...trustPageSlugs().map((slug) => ({
      url: `${SCAM_BASE}/${slug}`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.5,
    })),
  ]

  // Programmatic scam pages (city/bank/UPI/platform/type + combos)
  const scamRoutes: MetadataRoute.Sitemap = allScamPaths().map((path) => ({
    url: `${SCAM_BASE}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '/scams' ? ('daily' as const) : ('weekly' as const),
    priority: path === '/scams' ? 0.9 : 0.7,
  }))

  // Public scam-intelligence pages + the screenshot tool
  const intelRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/scam-intelligence`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/scam-database`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/latest-scams`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/scamcheck/screenshot`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    ...allIntelSlugs().map((slug) => ({
      url: `${BASE_URL}/scam-intelligence/${slug}`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.7,
    })),
    ...allCheckerSlugs().map((slug) => ({
      url: `${BASE_URL}/${slug}`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.8,
    })),
  ]

  return [...staticRoutes, ...contentRoutes, ...tagRoutes, ...trackRoutes, ...widgetRoute, ...scamRoutes, ...intelRoutes]
}
