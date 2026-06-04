import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AuthProvider } from '@/components/auth/auth-provider'
import { QuickAnalyzer } from '@/components/scamcheck/quick-analyzer'
import { AdSlot } from '@/components/ads/ad-slot'
import { buildMeta } from '@/lib/seo/scamcheck-meta'
import { SCAMCHECK_BASE } from '@/lib/seo/scamcheck-meta'
import { ES_CHECKERS, allEsCheckerSlugs, getEsChecker } from '@/lib/scamcheck/es-pages'

export const dynamicParams = false
export function generateStaticParams() { return allEsCheckerSlugs().map((checker) => ({ checker })) }

export async function generateMetadata({ params }: { params: Promise<{ checker: string }> }): Promise<Metadata> {
  const { checker } = await params
  const c = getEsChecker(checker)
  if (!c) return buildMeta({ path: `/es/${checker}`, title: 'ScamCheck', description: 'Detector de estafas con IA gratis.' })
  return buildMeta({
    path: `/es/${c.slug}`, title: c.title, description: c.description,
    languages: { es: `/es/${c.slug}`, en: `/${c.enSlug}`, 'x-default': `/${c.enSlug}` },
    locale: 'es_ES',
  })
}

export default async function EsCheckerPage({ params }: { params: Promise<{ checker: string }> }) {
  const { checker } = await params
  const c = getEsChecker(checker)
  if (!c) notFound()

  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: c.h1, applicationCategory: 'SecurityApplication', operatingSystem: 'Web', inLanguage: 'es', offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }, publisher: { '@type': 'Organization', name: 'A Square Solutions' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: 'es', mainEntity: c.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ScamCheck', item: `${SCAMCHECK_BASE}/es` },
      { '@type': 'ListItem', position: 2, name: c.h1, item: `${SCAMCHECK_BASE}/es/${c.slug}` },
    ] },
  ]
  return (
    <AuthProvider>
      <main className="mx-auto max-w-3xl px-4 py-8">
        {ld.map((j, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j) }} />)}
        <nav className="text-xs text-zinc-500"><Link href="/es" className="hover:underline">ScamCheck</Link> / {c.h1}</nav>
        <h1 className="mt-2 text-2xl font-bold text-zinc-100 sm:text-3xl">{c.h1}</h1>
        <p className="mt-2 text-sm text-zinc-400">{c.intro}</p>

        <section className="mt-6"><QuickAnalyzer initialTab={c.tab} /></section>
        <AdSlot id={`es-${c.slug}-mid`} format="horizontal" />

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-zinc-100">Señales de alerta</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-300">{c.redFlags.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-zinc-100">Preguntas frecuentes</h2>
          <div className="mt-3 space-y-3">{c.faqs.map((f, i) => (<div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"><p className="font-medium text-zinc-100">{f.q}</p><p className="mt-1 text-sm text-zinc-400">{f.a}</p></div>))}</div>
        </section>

        <p className="mt-8 flex flex-wrap gap-x-4 text-sm text-sky-400">
          {ES_CHECKERS.filter((x) => x.slug !== c.slug).slice(0, 3).map((x) => <Link key={x.slug} href={`/es/${x.slug}`} className="hover:underline">{x.h1} →</Link>)}
          <Link href={`/${c.enSlug}`} className="hover:underline">English →</Link>
        </p>
      </main>
    </AuthProvider>
  )
}
