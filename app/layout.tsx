import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'
import { TopBar } from '@/components/layout/top-bar'
import { SearchModal } from '@/components/search/search-modal'
import { Analytics } from '@/components/analytics'
import { WebVitals } from '@/components/analytics/web-vitals'
import { Analytics as VercelAnalytics } from '@vercel/analytics/react'
import { EcosystemFooter } from '@/components/platform/ecosystem-footer'

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
  alternates: { canonical: SITE_URL },
}

// ─── JSON-LD structured data ─────────────────────────────────
const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'AI Execution Lab',
  url: SITE_URL,
  description:
    'A practical AI systems lab by A Square Solutions. Real workflows, real tools, real results — built while shipping production AI systems, SEO engineering pipelines, and GEO strategies.',
  publisher: {
    '@type': 'Organization',
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body className="text-surface-200 antialiased">
        <div className="flex min-h-screen">
          {/* Desktop sidebar */}
          <Sidebar />

          {/* Main content column */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Mobile top bar */}
            <TopBar />

            <main className="flex-1">
              {children}
            </main>

            <EcosystemFooter />
          </div>
        </div>

        {/* Global search modal — registers Cmd+K globally */}
        <SearchModal />

        {/* Plausible + GA4 — production only, env-gated via NEXT_PUBLIC_* vars */}
        <Analytics />

        {/* Vercel Analytics — single script, all routes, minimal overhead */}
        <VercelAnalytics />

        {/* Web Vitals reporter — logs in dev, beacons to /api/vitals in prod */}
        <WebVitals />
      </body>
    </html>
  )
}
