// ─────────────────────────────────────────────────────────────────
// lib/trustseal/jsonld.ts  (asq-trustseal-harden-seo)
// TrustSeal-specific JSON-LD structured data. TrustSeal is a STANDALONE product:
// its page schema must describe ONLY TrustSeal (+ its parent org A Square
// Solutions) — never sibling ecosystem brands (AI Execution Lab, ScamCheck).
// Emitted by the [locale] layout so every /trustseal/* page carries a clean,
// self-contained entity graph. The ecosystem/org graph for the Lab/ScamCheck
// surfaces lives separately in components/seo/ecosystem-jsonld.tsx.
// ─────────────────────────────────────────────────────────────────
import { LOCALES, DEFAULT_LOCALE, type Locale } from './locales'
import { t } from './messages'

const BASE = (process.env.TRUSTSEAL_BASE_URL || 'https://trustseal.asquaresolution.com').replace(/\/$/, '')

const ORG_ID = `${BASE}/#organization`
const WEBSITE_ID = `${BASE}/#website`
const APP_ID = `${BASE}/#software`

/** Parent org (A Square Solutions) — co-referenced, not duplicated. */
const PARENT_ORG = {
  '@type': 'Organization',
  '@id': 'https://asquaresolution.com/#organization',
  name: 'A Square Solutions',
  url: 'https://asquaresolution.com',
}

/**
 * Build the full TrustSeal JSON-LD @graph for a locale: Organization (with
 * parentOrganization), WebSite, SoftwareApplication, and FAQPage. No Product
 * node — TrustSeal is SaaS, so a Product would trigger Google merchant-listing
 * errors (image/availability/shipping/returns). Contains NO references to AI
 * Execution Lab or ScamCheck.
 */
export function buildTrustSealJsonLd(locale: Locale): string {
  const lc: Locale = LOCALES.includes(locale) ? locale : DEFAULT_LOCALE
  const url = `${BASE}/${lc}`
  const tagline = t(lc, 'common.tagline')
  const heroSub = t(lc, 'hero.subtitle')

  const organization = {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'TrustSeal',
    url: BASE,
    description: tagline,
    parentOrganization: PARENT_ORG,
    sameAs: ['https://asquaresolution.com'],
    knowsAbout: [
      'Business verification',
      'Domain ownership verification',
      'Trust score',
      'DNS TXT verification',
      'Trust badges',
      'Online trust intelligence',
    ],
  }

  const website = {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: 'TrustSeal',
    url: BASE,
    description: tagline,
    inLanguage: LOCALES.map((l) => l),
    publisher: { '@id': ORG_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${BASE}/${lc}/verify?domain={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }

  // TrustSeal is SaaS, not a physical product. We model the offering as a
  // SoftwareApplication (Google's sanctioned type for software) — NOT a Product,
  // which would (wrongly) demand image/availability/shippingDetails/
  // hasMerchantReturnPolicy and a physical-goods brand. The pricing tiers live
  // here as Offers; `availability: InStock` simply means the plan is sign-up-able.
  const application = {
    '@type': 'SoftwareApplication',
    '@id': APP_ID,
    name: 'TrustSeal',
    url: BASE,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: heroSub,
    publisher: { '@id': ORG_ID },
    offers: [
      { '@type': 'Offer', name: t(lc, 'pricing.freeName'), price: '0', priceCurrency: 'INR', url: `${BASE}/${lc}/pricing`, availability: 'https://schema.org/InStock' },
      { '@type': 'Offer', name: t(lc, 'pricing.proName'), price: '499', priceCurrency: 'INR', url: `${BASE}/${lc}/pricing`, availability: 'https://schema.org/InStock' },
    ],
  }

  const faqPage = {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity: ([1, 2, 3, 4, 5] as const).map((n) => ({
      '@type': 'Question',
      name: t(lc, `faq.q${n}`),
      acceptedAnswer: { '@type': 'Answer', text: t(lc, `faq.a${n}`) },
    })),
  }

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [organization, website, application, faqPage],
  })
}
