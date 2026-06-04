import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AUTHORS, getAuthor, allAuthorSlugs } from '@/lib/authors'
import { getItemsByAuthor } from '@/lib/content'
import { SECTION_META, formatDateMono } from '@/lib/utils'

const LAB = process.env.NEXT_PUBLIC_LAB_URL ?? 'https://lab.asquaresolution.com'

export const dynamicParams = false
export function generateStaticParams() { return allAuthorSlugs().map((slug) => ({ slug })) }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const a = AUTHORS[slug]
  if (!a) return { title: 'Author' }
  const url = `${LAB}/authors/${a.slug}`
  return {
    title: { absolute: `${a.name} — ${a.role} | AI Execution Lab` },
    description: a.bio,
    alternates: { canonical: url },
    openGraph: { title: `${a.name} — ${a.role}`, description: a.bio, url, type: 'profile' },
  }
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const a = AUTHORS[slug]
  if (!a) notFound()
  const author = getAuthor(slug)
  const items = getItemsByAuthor(author.name)
  const url = `${LAB}/authors/${author.slug}`

  const personSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${url}#person`,
    name: author.name,
    jobTitle: author.role,
    description: author.bio,
    url,
    sameAs: [author.website, author.linkedin],
    worksFor: { '@type': 'Organization', '@id': 'https://asquaresolution.com/#organization', name: author.org, url: author.orgUrl },
  }

  return (
    <div className="px-5 sm:px-6 lg:px-8 py-10 max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }} />
      <nav aria-label="Breadcrumb" className="mb-7 flex items-center gap-1.5 text-xs text-surface-600">
        <Link href="/" className="hover:text-surface-400">Home</Link><span>/</span>
        <span className="text-surface-500">Authors</span><span>/</span>
        <span className="text-surface-500">{author.name}</span>
      </nav>

      <header className="flex items-start gap-5 border-b border-white/[0.06] pb-8">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand-500/15 text-2xl font-bold text-brand-300">
          {author.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-50">{author.name}</h1>
          <p className="text-sm text-surface-500">{author.role}</p>
          <p className="mt-3 text-sm leading-relaxed text-surface-400">{author.bio}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 text-xs">
            <a href={author.website} target="_blank" rel="noopener" className="text-brand-400 hover:underline">{author.website.replace(/^https?:\/\//, '')}</a>
            <a href={author.linkedin} target="_blank" rel="noopener" className="text-brand-400 hover:underline">LinkedIn</a>
          </div>
        </div>
      </header>

      <h2 className="mt-8 mb-4 text-[10px] font-semibold uppercase tracking-widest text-surface-600">{items.length} articles by {author.name}</h2>
      <div className="space-y-2">
        {items.map((i) => (
          <Link key={`${i.section}/${i.slug}`} href={`${SECTION_META[i.section].href}/${i.slug}`}
            className="group flex items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.015] px-4 py-3 hover:border-white/[0.10] hover:bg-white/[0.035] transition-all">
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm text-surface-300 group-hover:text-surface-100">{i.frontmatter.title}</p>
              <p className="text-[10px] font-mono uppercase tracking-widest text-surface-700">{SECTION_META[i.section].label}</p>
            </div>
            <time className="shrink-0 text-[10px] font-mono text-surface-700">{formatDateMono(i.frontmatter.date)}</time>
          </Link>
        ))}
      </div>
    </div>
  )
}
