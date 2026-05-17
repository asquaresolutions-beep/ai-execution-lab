import { MetadataRoute } from 'next'
import { getAllMeta, type ContentSection } from '@/lib/content'
import { SECTION_META } from '@/lib/utils'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ai-execution-lab.vercel.app'

const SECTIONS: ContentSection[] = ['docs', 'systems', 'labs', 'case-studies', 'playbooks']

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
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

  return [...staticRoutes, ...contentRoutes]
}
