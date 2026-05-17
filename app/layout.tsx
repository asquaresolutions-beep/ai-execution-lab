import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'
import { TopBar } from '@/components/layout/top-bar'
import { SearchModal } from '@/components/search/search-modal'

export const metadata: Metadata = {
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
    siteName: 'AI Execution Lab',
    title: 'AI Execution Lab — A Square Solutions',
    description: 'Real AI workflows, systems, and research from building production tools.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Execution Lab — A Square Solutions',
    description: 'Real AI workflows, systems, and research from building production tools.',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
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
