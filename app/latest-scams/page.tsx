import type { Metadata } from 'next'
import Link from 'next/link'
import { buildMeta, SCAMCHECK_BASE as BASE } from '@/lib/seo/scamcheck-meta'
import { TrendingIsland } from '@/components/scam-intel/trending-island'
import { AdSlot } from '@/components/ads/ad-slot'
import { INTEL_PAGES } from '@/lib/scam-intel/intel-pages'
import { NewsletterCapture } from '@/components/scamcheck/newsletter-capture'
import { FAKE_UPI_MAGNET } from '@/lib/newsletter/lead-magnets'

export const metadata: Metadata = buildMeta({
  path: '/latest-scams',
  title: 'Latest Scams & Public Scam Reports in India | ScamCheck',
  description: 'Latest scams and trending fraud campaigns reported in India — fake KYC, UPI refunds, courier fees, investment & job scams. Updated as new campaigns emerge.',
  keywords: ['latest scams', 'trending scams', 'scam reports', 'new scams India'],
})

export default function LatestScams() {
  const ld = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: 'Latest scams',
    itemListElement: INTEL_PAGES.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${BASE}/scam-intelligence/${p.slug}`, name: p.h1 })),
  }
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-zinc-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <AdSlot id="latest-header" format="leaderboard" />
      <h1 className="text-2xl font-bold">Latest Scams &amp; Reports</h1>
      <p className="mt-2 text-sm text-zinc-400">Trending fraud campaigns and the scams people are checking right now. New ones are added as they emerge.</p>

      {/* Live public reports (trending) — falls back to a curated overview. */}
      <TrendingIsland />

      <h2 className="mt-8 text-base font-semibold text-zinc-200">Documented scams</h2>
      <ul className="mt-2 grid gap-3 sm:grid-cols-2">
        {INTEL_PAGES.map((p) => (
          <li key={p.slug} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 hover:border-zinc-600">
            <Link href={`/scam-intelligence/${p.slug}`}>
              <h3 className="font-medium text-zinc-100">{p.h1}</h3>
              <p className="mt-1 text-xs text-zinc-400">{p.directAnswer.slice(0, 110)}…</p>
            </Link>
          </li>
        ))}
      </ul>

      <AdSlot id="latest-mid" format="rectangle" />

      <p className="mt-6 flex flex-wrap gap-x-4 text-xs text-zinc-500">
        <Link href="/scam-database" className="hover:text-zinc-300">Search the scam database →</Link>
        <Link href="/" className="hover:text-zinc-300">Check a message →</Link>
        <Link href="/contact" className="hover:text-zinc-300">Report a scam →</Link>
      </p>

      <section className="mt-10">
        <NewsletterCapture source="research:latest-scams" magnet={FAKE_UPI_MAGNET} />
      </section>
    </main>
  )
}
