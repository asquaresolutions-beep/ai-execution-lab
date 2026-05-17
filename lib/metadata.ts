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
