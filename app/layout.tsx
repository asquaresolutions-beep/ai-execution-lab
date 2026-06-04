import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Analytics } from '@/components/analytics'
import { WebVitals } from '@/components/analytics/web-vitals'
import { Analytics as VercelAnalytics } from '@vercel/analytics/react'
import { SiteChrome } from '@/components/layout/site-chrome'
import { ConsentBanner } from '@/components/consent/consent-banner'

// A Square Solutions AdSense publisher ID (shared across properties). Overridable
// via env. Used to load AdSense + render ad units.
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || 'ca-pub-3102382127523426'

// Google Consent Mode v2 — set BEFORE any ad/analytics tag loads. Defaults to
// denied (GDPR/UK/EU); the consent banner upgrades on user choice. Reflects a
// previously-stored "accept" immediately to avoid a denied flash.
const CONSENT_DEFAULT = `
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});
try{var c=JSON.parse(localStorage.getItem('sc-consent-v1')||'null');if(c){gtag('consent','update',{ad_storage:c.ads?'granted':'denied',ad_user_data:c.ads?'granted':'denied',ad_personalization:c.ads?'granted':'denied',analytics_storage:c.analytics?'granted':'denied'});}}catch(e){}
`

// ─── Fonts ───────────────────────────────────────────────────
const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
})

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
})

// ─── Base URL ────────────────────────────────────────────────
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lab.asquaresolution.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'AI Execution Lab — A Square Solutions',
    template: '%s | AI Execution Lab',
  },
  description:
    'A practical AI systems lab by A Square Solutions. Real workflows, real tools, real results — built while shipping production AI systems, SEO engineering pipelines, and GEO strategies.',
  keywords: [
    'AI execution',
    'Claude Code',
    'GEO',
    'generative engine optimization',
    'AI workflows',
    'AI automation',
    'SEO engineering',
    'A Square Solutions',
    'WordPress automation',
    'LiteSpeed',
  ],
  authors: [{ name: 'A Square Solutions', url: 'https://asquaresolution.com' }],
  creator: 'A Square Solutions',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'AI Execution Lab',
    title: 'AI Execution Lab — A Square Solutions',
    description: 'Real AI workflows, systems, and research from building production tools.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Execution Lab — A Square Solutions',
    description: 'Real AI workflows, systems, and research from building production tools.',
    creator: '@asquaresolution',
  },
  robots: { index: true, follow: true },
  // RSS discovery for the Lab. ScamCheck pages override `alternates` via buildMeta,
  // so this only surfaces on Lab pages.
  alternates: { types: { 'application/rss+xml': 'https://lab.asquaresolution.com/feed.xml' } },
  // No hardcoded canonical here: a fixed canonical made every page that didn't
  // override it (all Lab pages) canonicalize to the ScamCheck domain. Each page
  // now self-canonicalizes (ScamCheck pages set their own via buildMeta; Lab
  // pages default to the requested URL).
}

// ─── JSON-LD structured data ─────────────────────────────────
const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  // @id used as co-reference target in per-article isPartOf fields
  '@id': `${SITE_URL}/#website`,
  name: 'AI Execution Lab',
  url: SITE_URL,
  description:
    'A practical AI systems lab by A Square Solutions. Real workflows, real tools, real results — built while shipping production AI systems, SEO engineering pipelines, and GEO strategies.',
  publisher: {
    '@type': 'Organization',
    // Co-reference to the canonical org entity on asquaresolution.com
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
  // Co-reference to the canonical org entity defined on asquaresolution.com
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
      description: 'AI-powered fact-checking for publishers. Verifies claims against real-time sources.',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${fontSans.variable} ${fontMono.variable}`}>
      <head>
        {/* Consent Mode v2 defaults — MUST run before AdSense/analytics load. */}
        <script dangerouslySetInnerHTML={{ __html: CONSENT_DEFAULT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        {/* Google AdSense loader — consent governs personalisation (non-personalised
            ads serve until the visitor accepts). Placement is explicit via <AdSlot>. */}
        {ADSENSE_CLIENT && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body className="text-surface-200 antialiased">
        {/* Chrome is route-aware: ScamCheck product nav/footer on ScamCheck
            routes, AI Execution Lab chrome (passed as props) elsewhere. */}
        <SiteChrome>
          {children}
        </SiteChrome>

        {/* Plausible + GA4 — production only, env-gated via NEXT_PUBLIC_* vars */}
        <Analytics />

        {/* Vercel Analytics — single script, all routes, minimal overhead */}
        <VercelAnalytics />

        {/* Web Vitals reporter — logs in dev, beacons to /api/vitals in prod */}
        <WebVitals />

        {/* GDPR/UK/EU cookie consent — Google Consent Mode v2 */}
        <ConsentBanner />
      </body>
    </html>
  )
}
