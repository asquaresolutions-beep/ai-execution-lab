import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'
import { TopBar } from '@/components/layout/top-bar'
import { SearchModal } from '@/components/search/search-modal'

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
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ai-execution-lab.vercel.app'

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${fontSans.variable} ${fontMono.variable}`}>
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
          </div>
        </div>

        {/* Global search modal — registers Cmd+K globally */}
        <SearchModal />
      </body>
    </html>
  )
}
