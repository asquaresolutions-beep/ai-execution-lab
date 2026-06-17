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
import { getStore } from '@/lib/store/adapter'
import { LOCALES, DEFAULT_LOCALE } from '@/lib/trustseal/locales'
import { LEGAL_SLUGS } from '@/lib/trustseal/legal-content'

const SCAM = 'https://scamcheck.asquaresolution.com'
const LAB = 'https://lab.asquaresolution.com'
const TRUST = 'https://trustseal.asquaresolution.com'

// One deployment serves three hosts. Emit the correct sitemap per host so each
// site lists only its own reachable URLs (a host without its own branch served
// ScamCheck URLs — that left lab content, then trustseal seal pages, out of any
// sitemap). ScamCheck stays the default; lab + trustseal branch explicitly.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = ((await headers()).get('host') || '').toLowerCase()
  if (host.startsWith('lab.')) return labSitemap()
  if (host.startsWith('trustseal.')) return trustSealSitemap()
  return scamcheckSitemap()
}

// TrustSeal: the public seal pages are the indexable acquisition surface. List
// one entry per VERIFIED domain (matching the seal page's index:true gate —
// unverified domains are noindex/soft-404 and must NOT appear). Read-only,
// equality-only Firestore query (auto single-field index; no composite index).
// Never 500 the sitemap if the store is unavailable — degrade to empty.
async function trustSealSitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Static marketing / authority / legal surfaces — one entry PER LOCALE with full
  // hreflang alternates (+ x-default → en). These were previously absent from the
  // sitemap, so the Trust Center / docs / legal content was undiscoverable.
  const langs = (subpath: string): Record<string, string> => {
    const m: Record<string, string> = {}
    for (const l of LOCALES) m[l] = `${TRUST}/${l}${subpath}`
    m['x-default'] = `${TRUST}/${DEFAULT_LOCALE}${subpath}`
    return m
  }
  const staticPaths: { sub: string; priority: number; freq: 'daily' | 'weekly' | 'monthly' }[] = [
    { sub: '', priority: 1.0, freq: 'daily' },
    { sub: '/pricing', priority: 0.9, freq: 'weekly' },
    { sub: '/verify', priority: 0.9, freq: 'weekly' },
    { sub: '/trust-center', priority: 0.8, freq: 'weekly' },
    { sub: '/customers', priority: 0.7, freq: 'weekly' },
    { sub: '/security', priority: 0.7, freq: 'monthly' },
    { sub: '/docs', priority: 0.7, freq: 'weekly' },
    { sub: '/about', priority: 0.6, freq: 'monthly' },
    ...LEGAL_SLUGS.map((slug) => ({ sub: `/legal/${slug}`, priority: 0.4, freq: 'monthly' as const })),
  ]
  const staticEntries: MetadataRoute.Sitemap = staticPaths.flatMap(({ sub, priority, freq }) =>
    LOCALES.map((l) => ({
      url: `${TRUST}/${l}${sub}`,
      lastModified: now,
      changeFrequency: freq,
      priority,
      alternates: { languages: langs(sub) },
    })),
  )

  // Public seal pages — one per VERIFIED domain (index:true gate).
  let domains: string[] = []
  try {
    const rows = await getStore().query<{ domain: string; status: string }>('ts_claims', {
      where: [{ field: 'status', op: '==', value: 'verified' }],
      limit: 5000,
    })
    domains = rows.map((r) => r.data.domain).filter(Boolean)
  } catch {
    /* store unavailable → still return the static entries rather than a 500 */
  }
  const sealEntries: MetadataRoute.Sitemap = domains.map((d) => ({
    url: `${TRUST}/en/trust/${d}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [...staticEntries, ...sealEntries]
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
