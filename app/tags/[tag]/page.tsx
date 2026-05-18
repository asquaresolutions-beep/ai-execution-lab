import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildTagIndex, getAllTagSlugs, getTagItems } from '@/lib/tags'
import { SECTION_META, ACCENT_CLASSES, formatDateMono } from '@/lib/utils'

const SITE_URL  = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lab.asquaresolution.com'
const SITE_NAME = 'AI Execution Lab'
const TWITTER   = '@asquaresolution'

interface Props { params: Promise<{ tag: string }> }

export async function generateStaticParams() {
  return getAllTagSlugs().map((tag) => ({ tag }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params
  const items   = getTagItems(tag)
  if (items.length === 0) return {}
  const title       = `#${tag}`
  const description = `${items.length} items tagged #${tag} — AI execution documentation, failure reports, labs, and logs.`
  const url         = `${SITE_URL}/tags/${tag}`
  return {
    title,
    description,
    // Thin tag pages (fewer than 3 items) don't provide enough value to index
    ...(items.length < 3 ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: 'website',
      title: `${title} | ${SITE_NAME}`,
      description,
      url,
      siteName: SITE_NAME,
    },
    twitter: {
      card:    'summary',
      title:   `${title} | ${SITE_NAME}`,
      description,
      creator: TWITTER,
    },
    alternates: { canonical: url },
  }
}

export default async function TagPage({ params }: Props) {
  const { tag } = await params
  const items   = getTagItems(tag)
  if (items.length === 0) notFound()

  const allTags  = buildTagIndex()
  const related  = allTags
    .filter(e => e.tag !== tag && e.items.some(i => items.some(j => j.slug === i.slug)))
    .slice(0, 8)

  return (
    <div className="px-6 lg:px-8 py-8 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-surface-600">
        <Link href="/" className="hover:text-surface-400 transition-colors">Home</Link>
        <span>/</span>
        <Link href="/tags" className="hover:text-surface-400 transition-colors">Topics</Link>
        <span>/</span>
        <span className="text-surface-500">#{tag}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-surface-50 mb-2">
          #{tag}
        </h1>
        <p className="text-sm text-surface-500">
          {items.length} {items.length === 1 ? 'item' : 'items'} across{' '}
          {new Set(items.map(i => i.section)).size} sections
        </p>
      </div>

      {/* Items */}
      <div className="space-y-2 mb-10">
        {items.map((item) => {
          const meta = SECTION_META[item.section]
          const ac   = ACCENT_CLASSES[meta.accent]
          return (
            <Link
              key={`${item.section}/${item.slug}`}
              href={`${meta.href}/${item.slug}`}
              className="group flex items-start gap-4 rounded-xl border border-white/[0.05] bg-white/[0.02] px-5 py-4 hover:border-white/[0.10] hover:bg-white/[0.04] transition-all"
            >
              {/* Date */}
              <time className="text-[11px] font-mono text-surface-700 shrink-0 w-20 pt-0.5 hidden sm:block">
                {formatDateMono(item.frontmatter.date)}
              </time>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`text-[10px] font-mono font-semibold uppercase shrink-0 ${ac.text}`}>
                    {meta.label}
                  </span>
                  <span className="text-sm font-medium text-surface-200 group-hover:text-surface-50 transition-colors truncate">
                    {item.frontmatter.title}
                  </span>
                </div>
                {item.frontmatter.description && (
                  <p className="text-sm text-surface-500 line-clamp-1 leading-snug">
                    {item.frontmatter.description}
                  </p>
                )}
                {/* Other tags on this item */}
                {item.frontmatter.tags && item.frontmatter.tags.length > 1 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 hidden sm:flex">
                    {item.frontmatter.tags
                      .filter(t => t !== tag)
                      .slice(0, 4)
                      .map(t => (
                        <Link
                          key={t}
                          href={`/tags/${t}`}
                          className="text-[10px] text-surface-700 hover:text-brand-400 transition-colors"
                        >
                          #{t}
                        </Link>
                      ))}
                  </div>
                )}
              </div>

              {/* Reading time */}
              <div className="shrink-0 text-[11px] font-mono text-surface-700 pt-0.5 hidden md:block">
                {item.readingTime}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Related tags */}
      {related.length > 0 && (
        <div>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-surface-700 mb-3">
            Related topics
          </p>
          <div className="flex flex-wrap gap-2">
            {related.map(({ tag: t, count }) => (
              <Link
                key={t}
                href={`/tags/${t}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-3 py-1 text-xs font-mono text-surface-500 hover:text-surface-200 hover:border-white/[0.14] transition-all"
              >
                #{t}
                <span className="text-surface-700">{count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
