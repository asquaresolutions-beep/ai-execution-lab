import type { Metadata } from 'next'
import { SECTION_META } from './utils'
import type { ContentItem } from './content'

// ─────────────────────────────────────────────────────────────
// Shared metadata builder for all content article pages
// ─────────────────────────────────────────────────────────────

const SITE_URL     = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lab.asquaresolution.com'
const SITE_NAME    = 'AI Execution Lab'
const AUTHOR_NAME  = 'A Square Solutions'
const AUTHOR_URL   = 'https://asquaresolution.com'
const TWITTER_HANDLE = '@asquaresolution'

export function buildArticleMetadata(item: ContentItem): Metadata {
  const fm          = item.frontmatter
  const sectionMeta = SECTION_META[item.section]
  const url         = `${SITE_URL}${sectionMeta.href}/${item.slug}`

  // Dynamic OG image — rendered server-side at /api/og
  const ogImageUrl = `${SITE_URL}/api/og?${new URLSearchParams({
    title:       fm.title,
    section:     sectionMeta.label,
    description: fm.description ?? '',
  }).toString()}`

  const ogImage = { url: ogImageUrl, width: 1200, height: 630, alt: fm.title }

  return {
    title:       fm.title,
    description: fm.description,
    keywords:    fm.tags,
    authors:     [{ name: AUTHOR_NAME, url: AUTHOR_URL }],
    // Internal planning docs opt out of indexing via frontmatter noindex: true
    ...(fm.noindex ? { robots: { index: false, follow: false } } : {}),

    openGraph: {
      type:          'article',
      title:          fm.title,
      description:    fm.description,
      url,
      siteName:       SITE_NAME,
      publishedTime:  fm.date,
      modifiedTime:   fm.updated ?? fm.date,
      tags:           fm.tags,
      section:        sectionMeta.title,
      images:         [ogImage],
    },

    twitter: {
      card:        'summary_large_image',
      title:        fm.title,
      description:  fm.description,
      creator:      TWITTER_HANDLE,
      site:         TWITTER_HANDLE,
      images:       [ogImageUrl],
    },

    alternates: {
      canonical: url,
    },
  }
}

/**
 * Failure-optimized Next.js Metadata (Open Graph, Twitter, canonical).
 * For HowTo JSON-LD, call buildHowToSchema() separately and inject
 * it as a <script type="application/ld+json"> in the page JSX.
 */
export function buildFailureMetadata(item: ContentItem): Metadata {
  return buildArticleMetadata(item)
}

/**
 * Build a Schema.org HowTo object for a failure page.
 * JSON-LD for procedural debugging content — surfaces in AI search for
 * "how to fix X", "how to resolve Y in Next.js", etc.
 *
 * Usage in page.tsx:
 *   <script type="application/ld+json"
 *     dangerouslySetInnerHTML={{ __html: JSON.stringify(buildHowToSchema(item)) }}
 *   />
 */
export function buildHowToSchema(item: ContentItem): Record<string, unknown> {
  const fm      = item.frontmatter
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lab.asquaresolution.com'

  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `How to fix: ${fm.title}`,
    description: fm.description,
    url: `${siteUrl}/failures/${item.slug}`,
    datePublished: fm.date,
    dateModified: fm.updated ?? fm.date,
    author: {
      '@type': 'Organization',
      name: AUTHOR_NAME,
      url: AUTHOR_URL,
    },
    // Resolution time from frontmatter (e.g. "15-30 min" → label only; ISO PT format requires exact minutes)
    ...(fm.resolution_time ? { performTime: fm.resolution_time } : {}),
    // Affected systems as HowToTool items
    ...(fm.affected_systems?.length ? {
      tool: fm.affected_systems.map((sys: string) => ({
        '@type': 'HowToTool',
        name: sys,
      })),
    } : {}),
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Identify the failure',
        text: fm.description,
      },
      ...(fm.tags?.slice(0, 4).map((tag: string, i: number) => ({
        '@type': 'HowToStep',
        position: i + 2,
        name: `Investigate: ${tag}`,
      })) ?? []),
    ],
  }
}

/** Minimal metadata for a section list page. */
export function buildSectionMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  const url = `${SITE_URL}${path}`
  return {
    title,
    description,
    openGraph: {
      type:        'website',
      title:       `${title} | ${SITE_NAME}`,
      description,
      url,
      siteName:    SITE_NAME,
    },
    twitter: {
      card:        'summary',
      title:       `${title} | ${SITE_NAME}`,
      description,
      creator:     TWITTER_HANDLE,
    },
    alternates: { canonical: url },
  }
}
