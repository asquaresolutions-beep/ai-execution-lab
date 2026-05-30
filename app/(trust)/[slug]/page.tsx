import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { TRUST_PAGE_BY_SLUG, trustPageSlugs } from '@/lib/seo/trust-pages'

export const dynamic = 'error'
export const dynamicParams = false

const BASE = (process.env.NEXT_PUBLIC_SCAM_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://scamcheck.asquaresolution.com').replace(/\/$/, '')

interface Props { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return trustPageSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = TRUST_PAGE_BY_SLUG.get(slug)
  if (!page) return {}
  return {
    title: { absolute: `${page.title} | ScamCheck` },
    description: page.description,
    alternates: { canonical: `${BASE}/${page.slug}` },
    robots: { index: true, follow: true },
  }
}

export default async function TrustPage({ params }: Props) {
  const { slug } = await params
  const page = TRUST_PAGE_BY_SLUG.get(slug)
  if (!page) notFound()

  const schema = {
    '@context': 'https://schema.org', '@type': 'AboutPage',
    name: page.title, description: page.description,
    url: `${BASE}/${page.slug}`,
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
