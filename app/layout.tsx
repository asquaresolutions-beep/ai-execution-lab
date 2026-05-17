import type { Metadata } from 'next'
import './globals.css'
import { Nav } from '@/components/nav'
import { Footer } from '@/components/footer'

export const metadata: Metadata = {
  title: {
    default: 'AI Execution Lab — A Square Solutions',
    template: '%s | AI Execution Lab',
  },
  description:
    'A practical AI systems lab. Real workflows, real tools, real results — from the team behind asquaresolution.com, TrustSeal, and ScamCheck.',
  keywords: [
    'AI execution',
    'Claude Code',
    'GEO',
    'generative engine optimization',
    'AI workflows',
    'AI automation',
    'SEO engineering',
    'A Square Solutions',
  ],
  authors: [{ name: 'A Square Solutions', url: 'https://asquaresolution.com' }],
  creator: 'A Square Solutions',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'AI Execution Lab',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-surface-950 text-surface-100 antialiased">
        <Nav />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
