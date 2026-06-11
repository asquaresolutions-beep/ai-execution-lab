import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { allCheckerSlugs, getChecker } from '@/lib/scamcheck/checkers'
import { buildMeta, SCAMCHECK_BASE as BASE } from '@/lib/seo/scamcheck-meta'
import { AuthProvider } from '@/components/auth/auth-provider'
import { QuickAnalyzer } from '@/components/scamcheck/quick-analyzer'
import { ScreenshotAnalyzer } from '@/components/scamcheck/screenshot-analyzer'
import { TrustSignals } from '@/components/scamcheck/trust-signals'
import { TrustBand } from '@/components/scamcheck/trust-band'
import { ScanCTA } from '@/components/scamcheck/scan-cta'
import { ScamResources } from '@/components/scamcheck/scam-resources'
import { CHECKER_CONTENT } from '@/lib/scamcheck/checker-content'
import { ES_CHECKERS } from '@/lib/scamcheck/es-pages'
import { AdSlot } from '@/components/ads/ad-slot'
import { TrustSealCrossSell } from '@/components/scamcheck/trustseal-crosssell'
import { TRUST_PAGE_BY_SLUG, trustPageSlugs } from '@/lib/seo/trust-pages'

// Single root-level dynamic segment. ScamCheck checker pages (`*-scam-checker`)
// and the trust/about pages both live at the site root with disjoint slug sets,
// so they share one `[slug]` route here. Having two differently-named root
// segments (`[checker]` + a `(trust)/[slug]` route group) is illegal in Next.js
// and crashes the router at init, so this file dispatches between the two.
type Props = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams(): { slug: string }[] {
  return [...allCheckerSlugs(), ...trustPageSlugs()].map((slug) => ({ slug }))
}

const TRUST_BASE = (process.env.NEXT_PUBLIC_SCAM_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://scamcheck.asquaresolution.com').replace(/\/$/, '')

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params

  const c = getChecker(slug)
  if (c) {
    // Reciprocal hreflang when localized equivalents exist (es + hi share slugs).
    const es = ES_CHECKERS.find((x) => x.enSlug === c.slug)
    return buildMeta({
      path: `/${c.slug}`, title: c.title, description: c.description,
      ...(es ? { languages: { en: `/${c.slug}`, es: `/es/${es.slug}`, hi: `/hi/${es.slug}`, 'x-default': `/${c.slug}` } } : {}),
    })
  }

  const page = TRUST_PAGE_BY_SLUG.get(slug)
  if (!page) return { title: 'ScamCheck' }
  return {
    title: { absolute: `${page.title} | ScamCheck` },
    description: page.description,
    alternates: { canonical: `${TRUST_BASE}/${page.slug}` },
    robots: { index: true, follow: true },
  }
}

export default async function RootSlugPage({ params }: Props) {
  const { slug } = await params

  const c = getChecker(slug)
  if (c) return <CheckerView c={c} />

  const page = TRUST_PAGE_BY_SLUG.get(slug)
  if (page) return <TrustView page={page} />

  notFound()
}

function CheckerView({ c }: { c: NonNullable<ReturnType<typeof getChecker>> }) {
  const url = `${BASE}/${c.slug}`
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: c.h1, applicationCategory: 'SecurityApplication', operatingSystem: 'Web', offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' }, url, publisher: { '@type': 'Organization', name: 'A Square Solutions' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: c.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'ScamCheck', item: `${BASE}/scamcheck` }, { '@type': 'ListItem', position: 2, name: c.h1, item: url }] },
  ]

  return (
    <AuthProvider>
      <main className="mx-auto max-w-3xl px-4 py-8">
        {ld.map((j, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j) }} />)}
        <nav className="text-xs text-zinc-500"><Link href="/" className="hover:underline">ScamCheck</Link> / {c.h1}</nav>
        <h1 className="mt-2 text-2xl font-bold text-zinc-100">{c.h1}</h1>
        <p className="mt-2 text-sm text-zinc-400">{c.intro}</p>

        <div id="scanner" className="mt-5 scroll-mt-20">
          {c.tab === 'screenshot' ? <ScreenshotAnalyzer /> : <QuickAnalyzer initialTab={c.tab} />}
        </div>

        {/* asq-trustband-v1 */}
        <TrustBand className="mt-5" />

        <TrustSignals />

        {c.guide && (
          <a href={c.guide.url} className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-sky-500/30 bg-sky-500/[0.06] px-4 py-3 text-sm hover:border-sky-500/50">
            <span className="text-zinc-200">📘 Read the full guide: <strong className="text-sky-300">{c.guide.title}</strong></span>
            <span className="shrink-0 text-sky-400">Read guide →</span>
          </a>
        )}

        <TrustSealCrossSell className="mt-6" />
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

        {/* asq-growth-links-v1 — ScamCheck → blog authority cluster (internal links + ItemList JSON-LD) */}
        <ScamResources currentSlug={c.slug} className="mt-8" />

        {/* asq-scancta-v1 — contextual conversion CTA + relevant checker suggestions (replaces plain link list) */}
        <ScanCTA currentSlug={c.slug} className="mt-8" />
      </main>
    </AuthProvider>
  )
}

function TrustView({ page }: { page: NonNullable<ReturnType<typeof TRUST_PAGE_BY_SLUG.get>> }) {
  const schema = {
    '@context': 'https://schema.org', '@type': 'AboutPage',
    name: page.title, description: page.description,
    url: `${TRUST_BASE}/${page.slug}`,
    dateModified: new Date(page.updated).toISOString(),
    publisher: { '@type': 'Organization', name: 'A Square Solutions', url: 'https://asquaresolution.com' },
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <nav className="mb-4 text-xs text-neutral-500"><Link href="/scams" className="hover:text-neutral-300">ScamCheck</Link> / {page.title}</nav>
      <h1 className="text-2xl font-semibold text-white sm:text-3xl">{page.title}</h1>
      <p className="mt-2 text-xs text-neutral-500">Last updated: {page.updated}</p>
      <p className="mt-3 text-sm text-neutral-300">{page.description}</p>
      {page.sections.map((s) => (
        <section key={s.heading} className="mt-6">
          <h2 className="mb-2 text-lg font-semibold text-white">{s.heading}</h2>
          {s.body.map((p, i) => <p key={i} className="mb-2 text-sm leading-relaxed text-neutral-300">{p}</p>)}
        </section>
      ))}
      <footer className="mt-10 flex flex-wrap gap-2 border-t border-neutral-800 pt-5 text-xs">
        {trustPageSlugs().filter((s) => s !== page.slug).map((s) => (
          <Link key={s} href={`/${s}`} className="rounded-full border border-neutral-700 px-3 py-1 text-neutral-400 hover:text-white">{s.replace(/-/g, ' ')}</Link>
        ))}
      </footer>
    </main>
  )
}
