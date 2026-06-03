// ─────────────────────────────────────────────────────────────────
// lib/distribution/schema.ts
// JSON-LD builders: FAQPage + Article/NewsArticle. Emitted in the bundle
// and ready to drop into <script type="application/ld+json"> on publish.
// ─────────────────────────────────────────────────────────────────

import type { FaqItem, ScamInput, SeoMetadata } from './types'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://scamcheck.asquaresolution.com'
const ORG = {
  '@type': 'Organization',
  name: 'A Square Solutions',
  url: 'https://asquaresolution.com',
}

export function buildFaqSchema(faq: FaqItem[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }
}

export function buildArticleSchema(
  input: ScamInput,
  seo: SeoMetadata,
  opts: { datePublished?: string; locale?: string } = {},
): object {
  const url = `${SITE}${seo.canonicalPath}`
  const now = opts.datePublished || new Date().toISOString()
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: seo.metaTitle,
    description: seo.metaDescription,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    inLanguage: opts.locale || 'en-IN',
    datePublished: now,
    dateModified: now,
    keywords: seo.keywords.join(', '),
    about: { '@type': 'Thing', name: `${input.platform} scam`, description: input.title },
    author: ORG,
    publisher: {
      ...ORG,
      logo: { '@type': 'ImageObject', url: 'https://asquaresolution.com/logo.png' },
    },
  }
}
