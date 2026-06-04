import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { allCheckerSlugs, getChecker } from '@/lib/scamcheck/checkers'
import { CHECKERS } from '@/lib/scamcheck/checkers'
import { buildMeta, SCAMCHECK_BASE as BASE } from '@/lib/seo/scamcheck-meta'
import { AuthProvider } from '@/components/auth/auth-provider'
import { QuickAnalyzer } from '@/components/scamcheck/quick-analyzer'
import { ScreenshotAnalyzer } from '@/components/scamcheck/screenshot-analyzer'
import { TrustSignals } from '@/components/scamcheck/trust-signals'
import { CHECKER_CONTENT } from '@/lib/scamcheck/checker-content'
import { AdSlot } from '@/components/ads/ad-slot'

type Props = { params: Promise<{ checker: string }> }

export const dynamicParams = false
export function generateStaticParams(): { checker: string }[] {
  return allCheckerSlugs().map((checker) => ({ checker }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = getChecker((await params).checker)
  if (!c) return { title: 'ScamCheck' }
  return buildMeta({ path: `/${c.slug}`, title: c.title, description: c.description })
}

export default async function CheckerPage({ params }: Props) {
  const c = getChecker((await params).checker)
  if (!c) notFound()
  const url = `${BASE}/${c.slug}`
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: c.h1, applicationCategory: 'SecurityApplication', operatingSystem: 'Web', offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' }, url, publisher: { '@type': 'Organization', name: 'A Square Solutions' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: c.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'ScamCheck', item: `${BASE}/scamcheck` }, { '@type': 'ListItem', position: 2, name: c.h1, item: url }] },
  ]
  const others = CHECKERS.filter((x) => x.slug !== c.slug)

  return (
    <AuthProvider>
      <main className="mx-auto max-w-3xl px-4 py-8">
        {ld.map((j, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j) }} />)}
        <nav className="text-xs text-zinc-500"><Link href="/" className="hover:underline">ScamCheck</Link> / {c.h1}</nav>
        <h1 className="mt-2 text-2xl font-bold text-zinc-100">{c.h1}</h1>
        <p className="mt-2 text-sm text-zinc-400">{c.intro}</p>

        <div className="mt-5">
          {c.tab === 'screenshot' ? <ScreenshotAnalyzer /> : <QuickAnalyzer initialTab={c.tab} />}
        </div>

        <TrustSignals />
        <AdSlot id={`checker-${c.slug}`} format="horizontal" />

        {(() => { const ct = CHECKER_CONTENT[c.tab]; return (
          <div className="mt-8 space-y-6 text-sm text-zinc-300">
            <section>
              <h2 className="text-lg font-semibold text-zinc-100">How these scams work</h2>
              <ol className="mt-2 list-inside list-decimal space-y-1">{ct.howItWorks.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-zinc-100">Red flags</h2>
              <ul className="mt-2 list-inside list-disc space-y-1">{ct.redFlags.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-zinc-100">Real examples</h2>
              <ul className="mt-2 space-y-2">{ct.examples.map((s, i) => <li key={i} className="rounded-lg border-l-4 border-red-500/50 bg-zinc-900/60 p-3 text-zinc-300">{s}</li>)}</ul>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-zinc-100">How to protect yourself</h2>
              <ul className="mt-2 list-inside list-disc space-y-1">{ct.protect.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </section>
          </div>
        ) })()}

        <section className="mt-8 text-sm">
          <h2 className="text-base font-semibold text-zinc-200">FAQ</h2>
          <div className="mt-2 space-y-3">{c.faqs.map((f, i) => (<div key={i}><p className="font-medium text-zinc-100">{f.q}</p><p className="text-zinc-400">{f.a}</p></div>))}</div>
        </section>

        <section className="mt-8 text-sm">
          <h2 className="text-base font-semibold text-zinc-200">More scam checkers</h2>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {others.map((o) => <li key={o.slug}><Link href={`/${o.slug}`} className="text-sky-400 hover:underline">{o.h1}</Link></li>)}
            <li><Link href="/scam-intelligence" className="text-sky-400 hover:underline">Trending scam campaigns →</Link></li>
          </ul>
        </section>
      </main>
    </AuthProvider>
  )
}
