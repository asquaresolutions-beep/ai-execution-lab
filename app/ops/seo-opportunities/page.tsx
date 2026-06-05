import type { Metadata } from 'next'
import SeoOpportunities from './dashboard'

export const metadata: Metadata = {
  title: 'SEO Opportunity Dashboard — A Square Solutions',
  description: 'Reporting-only GSC opportunity finder: low-CTR pages, traffic-gain ranking, rising/declining and impression movers.',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-white">SEO Opportunity Dashboard</h1>
          <p className="text-sm text-zinc-500">Upload Google Search Console Pages exports — find the best CTR &amp; ranking opportunities. Reporting only; no content, title, meta or indexing changes.</p>
        </header>
        <SeoOpportunities />
      </div>
    </main>
  )
}
