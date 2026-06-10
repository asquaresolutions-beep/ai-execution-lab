import type { Metadata } from 'next'
import Link from 'next/link'
import { buildMeta, SCAMCHECK_BASE as BASE } from '@/lib/seo/scamcheck-meta'
import { ScamSearch } from '@/components/scamcheck/scam-search'
import { AdSlot } from '@/components/ads/ad-slot'
import { INTEL_PAGES } from '@/lib/scam-intel/intel-pages'
import { NewsletterCapture } from '@/components/scamcheck/newsletter-capture'
import { FAKE_UPI_MAGNET } from '@/lib/newsletter/lead-magnets'

export const metadata: Metadata = buildMeta({
  path: '/scam-database',
  title: 'Scam Database — Search Known Scams & Phishing Campaigns | ScamCheck',
  description: 'Searchable database of known scams: UPI refund fraud, fake KYC, courier-fee scams, investment & phishing campaigns — how they work and how to spot them.',
  keywords: ['scam database', 'search scams', 'phishing database', 'known scam list'],
})

export default function ScamDatabase() {
  const ld = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Scam Database', url: `${BASE}/scam-database`, description: 'Searchable database of known scams and phishing campaigns.' }
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-zinc-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <AdSlot id="db-header" format="leaderboard" />
      <h1 className="text-2xl font-bold">Scam Database</h1>
      <p className="mt-2 text-sm text-zinc-400">Search known scams and phishing campaigns. Tap a result to see how it works, the red flags, and how to report it.</p>
      <div className="mt-5"><ScamSearch /></div>
      <AdSlot id="db-mid" format="rectangle" />
      <section className="mt-8 text-sm">
        <h2 className="text-base font-semibold text-zinc-200">Browse all</h2>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {INTEL_PAGES.map((p) => <li key={p.slug}><Link href={`/scam-intelligence/${p.slug}`} className="text-sky-400 hover:underline">{p.h1}</Link></li>)}
        </ul>
        <p className="mt-4 flex flex-wrap gap-x-4 text-xs text-zinc-500">
          <Link href="/" className="hover:text-zinc-300">Check a message →</Link>
          <Link href="/latest-scams" className="hover:text-zinc-300">Latest scams →</Link>
          <Link href="/scam-intelligence" className="hover:text-zinc-300">Trending campaigns →</Link>
        </p>
      </section>

      <section className="mt-10">
        <NewsletterCapture source="research:scam-database" magnet={FAKE_UPI_MAGNET} />
      </section>
    </main>
  )
}
