// components/seo/ecosystem-jsonld.tsx  (asq-trustseal-harden-seo)
// The A Square Solutions ecosystem WebSite + Organization JSON-LD. This used to
// live hardcoded in the root <head> for EVERY route, which leaked AI Execution
// Lab / ScamCheck entities onto the standalone TrustSeal pages. It now renders
// ONLY on the Lab / ScamCheck surfaces (via SiteChrome's non-trustseal branches);
// TrustSeal pages emit their own self-contained graph (lib/trustseal/jsonld.ts).
import type { ReactNode } from 'react'

// The WebSite entity is per-tenant. It used to read NEXT_PUBLIC_SITE_URL, but that
// is a build-time constant and ONE deployment serves both lab.asquaresolution.com
// and scamcheck.asquaresolution.com — so no single value was correct for both. In
// production it resolved to the ScamCheck host, which made the Lab declare the
// ScamCheck URL *and* made ScamCheck declare the name "AI Execution Lab". The
// tenant is now passed explicitly by SiteChrome, which already knows which branch
// it is rendering. Do not reintroduce an env-var default here.
const WEBSITE_DESCRIPTIONS: Record<string, string> = {
  'AI Execution Lab':
    'A practical AI systems lab by A Square Solutions. Real workflows, real tools, real results — built while shipping production AI systems, SEO engineering pipelines, and GEO strategies.',
  ScamCheck:
    'Free AI scam detection by A Square Solutions. Check messages, links, emails, phone numbers and screenshots for fraud indicators before you click, pay, or share details.',
}

function buildWebsiteSchema(siteUrl: string, siteName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    name: siteName,
    url: siteUrl,
    description: WEBSITE_DESCRIPTIONS[siteName] ?? WEBSITE_DESCRIPTIONS['AI Execution Lab'],
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
      target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }
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

export function EcosystemJsonLd({
  siteUrl,
  siteName,
}: {
  siteUrl: string
  siteName: string
}): ReactNode {
  const websiteSchema = buildWebsiteSchema(siteUrl, siteName)
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
    </>
  )
}
