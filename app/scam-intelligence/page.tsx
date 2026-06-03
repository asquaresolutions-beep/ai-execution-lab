import type { Metadata } from 'next'
import Link from 'next/link'
import { INTEL_PAGES } from '@/lib/scam-intel/intel-pages'
import { TrendingIsland } from '@/components/scam-intel/trending-island'
import { AdSlot } from '@/components/ads/ad-slot'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lab.asquaresolution.com'

export const metadata: Metadata = {
  title: 'Scam Intelligence — Trending Scam Campaigns & How to Spot Them | ScamCheck',
  description: 'Public scam intelligence for India: fake SBI KYC, UPI refund, courier customs, and Telegram investment scams — how they work, the red flags, and an instant screenshot checker.',
  alternates: { canonical: `${BASE}/scam-intelligence` },
  openGraph: { title: 'Scam Intelligence — Trending Scam Campaigns', description: 'How the latest scams work and how to check a screenshot instantly.', url: `${BASE}/scam-intelligence`, type: 'website' },
}

export default function ScamIntelligenceIndex() {
  const itemList = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    itemListElement: INTEL_PAGES.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${BASE}/scam-intelligence/${p.slug}`, name: p.h1 })),
  }
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-zinc-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      <h1 className="text-3xl font-bold">Scam Intelligence</h1>
      <p className="mt-3 text-zinc-400">How India&apos;s most common scams work, the red flags to look for, and an instant way to check a suspicious screenshot. Updated as new campaigns emerge.</p>

      <Link href="/scamcheck/screenshot" className="mt-6 inline-block rounded-lg bg-sky-500 px-5 py-3 font-medium text-white hover:bg-sky-400">
        Check a screenshot now →
      </Link>

      <h2 className="mt-10 text-xl font-semibold">Scam campaigns</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {INTEL_PAGES.map((p) => (
          <li key={p.slug} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-zinc-600">
            <Link href={`/scam-intelligence/${p.slug}`} className="block">
              <h3 className="font-semibold text-zinc-100">{p.h1}</h3>
              <p className="mt-1 text-sm text-zinc-400">{p.directAnswer.slice(0, 130)}…</p>
              <span className="mt-2 inline-block text-xs text-sky-400">Read intelligence →</span>
            </Link>
          </li>
        ))}
      </ul>

      <TrendingIsland />

      <AdSlot id="intel-index" format="horizontal" />

      <section className="mt-10 text-sm text-zinc-400">
        <h2 className="text-base font-semibold text-zinc-200">Related</h2>
        <ul className="mt-2 space-y-1">
          <li><Link href="/scamcheck/screenshot" className="text-sky-400 hover:underline">ScamCheck — screenshot scam detector</Link></li>
          <li><Link href="/docs/multimodal-scamcheck" className="text-sky-400 hover:underline">How multimodal ScamCheck works</Link></li>
          <li><Link href="/docs/gcp-ai-infrastructure" className="text-sky-400 hover:underline">The AI infrastructure behind ScamCheck</Link></li>
        </ul>
      </section>
    </main>
  )
}
