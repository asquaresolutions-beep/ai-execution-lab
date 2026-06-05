import type { Metadata } from 'next'
import LeadsDashboard from './dashboard'

export const metadata: Metadata = {
  title: 'Lead Analytics — A Square Solutions',
  description: 'Admin lead & newsletter analytics: sources, services, attribution, funnel, status and exports.',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-white">Lead Analytics</h1>
          <p className="text-sm text-zinc-500">A Square Solutions · leads, subscribers, attribution &amp; exports — read-only.</p>
        </header>
        <LeadsDashboard />
      </div>
    </main>
  )
}
