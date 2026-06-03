import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { allIntelSlugs, getIntelPage } from '@/lib/scam-intel/intel-pages'
import { getCountry } from '@/lib/scam-intel/countries'
import { AdSlot } from '@/components/ads/ad-slot'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lab.asquaresolution.com'

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams(): { slug: string }[] {
  return allIntelSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const p = getIntelPage(slug)
  if (!p) return { title: 'Scam Intelligence | ScamCheck' }
  const url = `${BASE}/scam-intelligence/${p.slug}`
  return {
    title: p.title,
    description: p.metaDescription,
    alternates: { canonical: url },
    openGraph: { title: p.h1, description: p.metaDescription, url, type: 'article' },
  }
}

export default async function IntelPage({ params }: Props) {
  const { slug } = await params
  const p = getIntelPage(slug)
  if (!p) notFound()
  const url = `${BASE}/scam-intelligence/${p.slug}`
  const country = getCountry(p.country)
  const inLanguage = p.lang ?? 'en-IN'

  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: p.h1, description: p.metaDescription, datePublished: p.updated, dateModified: p.updated,
      inLanguage, mainEntityOfPage: url,
      author: { '@type': 'Organization', name: 'A Square Solutions' },
      publisher: { '@type': 'Organization', name: 'A Square Solutions' },
      about: p.brands.map((b) => ({ '@type': 'Thing', name: b })),
      ...(country.code !== 'INT' ? { spatialCoverage: { '@type': 'Country', name: country.name } } : {}),
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage,
      mainEntity: p.faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Scam Intelligence', item: `${BASE}/scam-intelligence` },
        { '@type': 'ListItem', position: 2, name: p.h1, item: url },
      ],
    },
  ]

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-zinc-100">
      {ld.map((j, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j) }} />)}

      <nav className="text-sm text-zinc-500"><Link href="/scam-intelligence" className="hover:underline">Scam Intelligence</Link> / {p.h1}</nav>
      <h1 className="mt-2 text-3xl font-bold">{p.h1}</h1>
      <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-zinc-200">{p.directAnswer}</p>

      <Link href="/scamcheck/screenshot" className="mt-5 inline-block rounded-lg bg-sky-500 px-5 py-3 font-medium text-white hover:bg-sky-400">
        Got a message like this? Check the screenshot →
      </Link>

      <h2 className="mt-8 text-xl font-semibold">How the scam works</h2>
      <ol className="mt-2 list-inside list-decimal space-y-1 text-zinc-300">{p.howItWorks.map((s, i) => <li key={i}>{s}</li>)}</ol>

      <h2 className="mt-8 text-xl font-semibold">Red flags</h2>
      <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-300">{p.redFlags.map((s, i) => <li key={i}>{s}</li>)}</ul>

      <h2 className="mt-8 text-xl font-semibold">Example message</h2>
      <blockquote className="mt-2 rounded-lg border-l-4 border-red-500/60 bg-zinc-900/60 p-4 text-sm text-zinc-300">{p.exampleText}</blockquote>

      <h2 className="mt-8 text-xl font-semibold">What to do</h2>
      <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-300">{p.safetyAdvice.map((s, i) => <li key={i}>{s}</li>)}</ul>

      <AdSlot id="intel-mid" format="horizontal" />

      <h2 className="mt-8 text-xl font-semibold">FAQ</h2>
      <div className="mt-2 space-y-3">{p.faqs.map((f, i) => (
        <div key={i}><p className="font-medium text-zinc-100">{f.question}</p><p className="text-sm text-zinc-400">{f.answer}</p></div>
      ))}</div>

      <section className="mt-10 border-t border-zinc-800 pt-6 text-sm">
        <h2 className="text-base font-semibold text-zinc-200">Related scams &amp; tools</h2>
        <ul className="mt-2 space-y-1">
          {p.related.map((r) => { const rp = getIntelPage(r); return rp ? <li key={r}><Link href={`/scam-intelligence/${r}`} className="text-sky-400 hover:underline">{rp.h1}</Link></li> : null })}
          <li><Link href="/scamcheck/screenshot" className="text-sky-400 hover:underline">ScamCheck — screenshot scam detector</Link></li>
          <li><Link href="/scam-intelligence" className="text-sky-400 hover:underline">All scam intelligence</Link></li>
        </ul>
      </section>

      <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm">
        <h2 className="text-base font-semibold text-zinc-200">Report it — {country.name}</h2>
        <p className="mt-1 text-zinc-400">{country.bankingGuidance}</p>
        <p className="mt-1 text-zinc-300">{country.agency}: <span className="text-zinc-100">{country.helpline}</span></p>
        <a href={country.reportUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">{country.reportUrl.replace(/^https?:\/\//, '')}</a>
      </section>

      <p className="mt-6 text-xs text-zinc-500">This is general safety information, not legal or financial advice. If you have lost money or shared sensitive details, contact your bank and your national fraud agency immediately.</p>
    </main>
  )
}
