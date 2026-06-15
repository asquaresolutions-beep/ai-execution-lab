// components/seo/ecosystem-jsonld.tsx  (asq-trustseal-harden-seo)
// The A Square Solutions ecosystem WebSite + Organization JSON-LD. This used to
// live hardcoded in the root <head> for EVERY route, which leaked AI Execution
// Lab / ScamCheck entities onto the standalone TrustSeal pages. It now renders
// ONLY on the Lab / ScamCheck surfaces (via SiteChrome's non-trustseal branches);
// TrustSeal pages emit their own self-contained graph (lib/trustseal/jsonld.ts).
import type { ReactNode } from 'react'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lab.asquaresolution.com'

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: 'AI Execution Lab',
  url: SITE_URL,
  description:
    'A practical AI systems lab by A Square Solutions. Real workflows, real tools, real results — built while shipping production AI systems, SEO engineering pipelines, and GEO strategies.',
  publisher: {
    '@type': 'Organization',
    '@id': 'https://asquaresolution.com/#organization',
    name: 'A Square Solutions',
    url: 'https://asquaresolution.com',
    sameAs: [
      'https://twitter.com/asquaresolution',
      'https://lab.asquaresolution.com',
      'https://trustseal.asquaresolution.com',
      'https://scamcheck.asquaresolution.com',
    ],
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
}

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://asquaresolution.com/#organization',
  name: 'A Square Solutions',
  url: 'https://asquaresolution.com',
  description: 'AI execution, GEO/AI-search strategy, and production WordPress engineering.',
  sameAs: [
    'https://twitter.com/asquaresolution',
    'https://lab.asquaresolution.com',
    'https://trustseal.asquaresolution.com',
    'https://scamcheck.asquaresolution.com',
  ],
  knowsAbout: [
    'Artificial Intelligence',
    'Claude Code',
    'Generative Engine Optimization',
    'AI Workflows',
    'SEO Engineering',
    'WordPress Development',
    'Production Systems',
  ],
  owns: [
    {
      '@type': 'WebSite',
      name: 'AI Execution Lab',
      url: 'https://lab.asquaresolution.com',
      description: 'Production AI engineering journal — operational records, failure archive, execution logs.',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'TrustSeal',
      url: 'https://trustseal.asquaresolution.com',
      applicationCategory: 'BusinessApplication',
      description: 'Business trust, reputation & verification — domain-ownership verified trust scores and badges.',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'ScamCheck',
      url: 'https://scamcheck.asquaresolution.com',
      applicationCategory: 'SecurityApplication',
      description: 'Free AI scam detection. Analyzes messages, UPI IDs, and links for fraud indicators.',
    },
  ],
}

export function EcosystemJsonLd(): ReactNode {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
    </>
  )
}
