import type { Metadata } from 'next'
import NewsletterDashboard from './dashboard'

// asq-newsletter-dash-v1 — admin newsletter analytics dashboard (read-only).
export const metadata: Metadata = {
  title: 'Newsletter Analytics — A Square Solutions',
  description: 'Admin newsletter analytics: subscribers over time, verdict/device mix, conversion by verdict, daily/weekly trend, top sources.',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-white">Newsletter Analytics</h1>
          <p className="text-sm text-zinc-500">ScamCheck · subscriber growth, verdict &amp; device mix, conversion and acquisition — read-only.</p>
        </header>
        <NewsletterDashboard />
      </div>
    </main>
  )
}
