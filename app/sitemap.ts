import { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { allIntelSlugs } from '@/lib/scam-intel/intel-pages'
import { allCheckerSlugs } from '@/lib/scamcheck/checkers'
import { ES_CHECKERS } from '@/lib/scamcheck/es-pages'
import { HI_CHECKERS } from '@/lib/scamcheck/hi-pages'
import { getAllItems, type ContentSection } from '@/lib/content'
import { SECTION_META } from '@/lib/utils'
import { buildTagIndex } from '@/lib/tags'
import { TRACKS } from '@/lib/tracks'
import { allAuthorSlugs } from '@/lib/authors'

const SCAM = 'https://scamcheck.asquaresolution.com'
const LAB = 'https://lab.asquaresolution.com'

// One deployment serves two hosts. Emit the correct sitemap per host so each
// site lists only its own reachable URLs (lab content was previously missing
// from any sitemap because the file served ScamCheck URLs on both hosts).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = ((await headers()).get('host') || '').toLowerCase()
  return host.startsWith('lab.') ? labSitemap() : scamcheckSitemap()
}

function scamcheckSitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const fixed: MetadataRoute.Sitemap = [
    { url: `${SCAM}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SCAM}/scam-intelligence`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SCAM}/latest-scams`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SCAM}/scam-database`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SCAM}/scamcheck/screenshot`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    ...['/about', '/how-it-works', '/methodology', '/contact', '/privacy-policy', '/terms', '/disclaimer'].map((p) => ({
      url: `${SCAM}${p}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.5,
    })),
  ]
  const checkers: MetadataRoute.Sitemap = allCheckerSlugs().map((slug) => ({ url: `${SCAM}/${slug}`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 }))
  const intel: MetadataRoute.Sitemap = allIntelSlugs().map((slug) => ({ url: `${SCAM}/scam-intelligence/${slug}`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 }))
  const es: MetadataRoute.Sitemap = [
    { url: `${SCAM}/es`, lastModified: now, changeFrequency: 'daily', priority: 0.8, alternates: { languages: { en: `${SCAM}/`, es: `${SCAM}/es`, hi: `${SCAM}/hi` } } },
    ...ES_CHECKERS.map((c) => ({ url: `${SCAM}/es/${c.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7, alternates: { languages: { en: `${SCAM}/${c.enSlug}`, es: `${SCAM}/es/${c.slug}`, hi: `${SCAM}/hi/${c.slug}` } } })),
  ]
  const hi: MetadataRoute.Sitemap = [
    { url: `${SCAM}/hi`, lastModified: now, changeFrequency: 'daily', priority: 0.8, alternates: { languages: { en: `${SCAM}/`, es: `${SCAM}/es`, hi: `${SCAM}/hi` } } },
    ...HI_CHECKERS.map((c) => ({ url: `${SCAM}/hi/${c.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7, alternates: { languages: { en: `${SCAM}/${c.enSlug}`, es: `${SCAM}/es/${c.slug}`, hi: `${SCAM}/hi/${c.slug}` } } })),
  ]
  return [...fixed, ...checkers, ...intel, ...es, ...hi]
}

function labSitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const SECTIONS: ContentSection[] = ['docs', 'systems', 'labs', 'case-studies', 'playbooks', 'failures', 'logs']
  const fixed: MetadataRoute.Sitemap = [
    { url: `${LAB}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${LAB}/start-here`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${LAB}/tracks`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${LAB}/tags`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    ...allAuthorSlugs().map((s) => ({ url: `${LAB}/authors/${s}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.6 })),
    ...SECTIONS.map((s) => ({ url: `${LAB}${SECTION_META[s].href}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 })),
  ]
  const items: MetadataRoute.Sitemap = getAllItems().map((i) => ({
    url: `${LAB}${SECTION_META[i.section].href}/${i.slug}`,
    lastModified: new Date(i.frontmatter.updated ?? i.frontmatter.date),
    changeFrequency: 'monthly', priority: 0.7,
  }))
  const tags: MetadataRoute.Sitemap = buildTagIndex().map(({ tag }) => ({ url: `${LAB}/tags/${tag}`, lastModified: now, changeFrequency: 'weekly', priority: 0.4 }))
  const tracks: MetadataRoute.Sitemap = TRACKS.map((t) => ({ url: `${LAB}/tracks/${t.id}`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 }))
  return [...fixed, ...items, ...tags, ...tracks]
}
