import Link from 'next/link'
import type { ContentItem, ContentMeta } from '@/lib/content'
import { getRelatedItems } from '@/lib/content'
import { SECTION_META, ACCENT_CLASSES, formatDate, formatDateMono, cn } from '@/lib/utils'
import { extractHeadings } from '@/lib/toc'
import { Badge } from '@/components/ui/badge'
import { ContentRenderer } from './content-renderer'
import { TableOfContents } from './layout/toc'
import { ReadingProgress } from './layout/reading-progress'
import { ArticleShare } from './article-share'

interface ContentPageProps {
  item: ContentItem
  prev?: ContentMeta | null
  next?: ContentMeta | null
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lab.asquaresolution.com'

export async function ContentPage({ item, prev, next }: ContentPageProps) {
  const sectionMeta = SECTION_META[item.section]
  const ac          = ACCENT_CLASSES[sectionMeta.accent]
  const fm          = item.frontmatter
  const headings    = extractHeadings(item.content)
  const related     = getRelatedItems(item.section, item.slug, 3)
  const canonicalUrl = `${SITE_URL}${sectionMeta.href}/${item.slug}`

  // ── Article JSON-LD ───────────────────────────────────────
  const articleType = item.section === 'docs' || item.section === 'systems' ? 'TechArticle' : 'Article'
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': articleType,
    headline: fm.title,
    description: fm.description,
    url: canonicalUrl,
    datePublished: fm.date,
    dateModified: fm.updated ?? fm.date,
    author: {
      '@type': 'Organization',
      name: 'A Square Solutions',
      url: 'https://asquaresolution.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'A Square Solutions',
      url: 'https://asquaresolution.com',
    },
    keywords: fm.tags?.join(', '),
    articleSection: sectionMeta.title,
    ...(fm.impact   ? { abstract: fm.impact }   : {}),
    ...(fm.goal     ? { description: `${fm.description} Goal: ${fm.goal}` } : {}),
  }

  return (
    <>
      {/* Article JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      {/* Reading progress bar (client, fixed to viewport top) */}
      <ReadingProgress />

      <div className="px-5 sm:px-6 lg:px-8 py-8">
        {/* Flex row: article content + optional TOC column */}
        <div className="flex gap-10 max-w-[64rem]">

          {/* ── Main article column ──────────────────────────── */}
          <div className="flex-1 min-w-0 max-w-3xl">

            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="mb-7 flex items-center gap-1.5 text-xs text-surface-600">
              <Link href="/" className="hover:text-surface-400 transition-colors">Home</Link>
              <span>/</span>
              <Link href={sectionMeta.href} className="hover:text-surface-400 transition-colors">
                {sectionMeta.title}
              </Link>
              <span>/</span>
              <span className="text-surface-500 truncate max-w-[28ch]">{fm.title}</span>
            </nav>

            {/* Header */}
            <header className="mb-10 pb-8 border-b border-white/[0.06]">

              {/* Section label + badges */}
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                <Link
                  href={sectionMeta.href}
                  className={cn(
                    'inline-flex items-center text-[10px] font-mono font-bold uppercase tracking-widest rounded px-2 py-1 border transition-opacity hover:opacity-70',
                    ac.text, ac.bg, ac.border
                  )}
                >
                  {sectionMeta.label}
                </Link>
                {fm.status === 'draft' && <Badge variant="yellow">Draft</Badge>}
                {fm.difficulty && (
                  <Badge variant={
                    fm.difficulty === 'advanced' ? 'red' :
                    fm.difficulty === 'intermediate' ? 'yellow' : 'green'
                  }>{fm.difficulty}</Badge>
                )}
                {fm.result && (
                  <Badge variant={
                    fm.result === 'confirmed' ? 'green' :
                    fm.result === 'refuted'   ? 'red'   :
                    fm.result === 'ongoing'   ? 'blue'  : 'yellow'
                  }>{fm.result}</Badge>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-surface-50 text-balance leading-[1.2]">
                {fm.title}
              </h1>

              {fm.description && (
                <p className="mt-3 text-base text-surface-400 leading-relaxed max-w-2xl">
                  {fm.description}
                </p>
              )}

              {/* Meta row */}
              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-surface-600 font-mono">
                <time dateTime={fm.date}>{formatDate(fm.date)}</time>
                {fm.updated && fm.updated !== fm.date && (
                  <span className="text-surface-700">· updated {formatDate(fm.updated)}</span>
                )}
                <span className="text-surface-700">· {item.readingTime}</span>
                {fm.stack && fm.stack.length > 0 && (
                  <span className="text-surface-700">· {fm.stack.join(' · ')}</span>
                )}
                {fm.estimated_time && (
                  <span className="text-surface-700">· ~{fm.estimated_time}</span>
                )}
              </div>

              {/* Lab hypothesis */}
              {fm.hypothesis && (
                <div className="mt-5 rounded-lg border border-brand-500/25 bg-brand-500/[0.05] px-4 py-3">
                  <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest mb-1.5">
                    Hypothesis
                  </p>
                  <p className="text-sm text-surface-300 leading-relaxed">{fm.hypothesis}</p>
                </div>
              )}

              {/* Case study impact */}
              {fm.impact && (
                <div className="mt-5 rounded-lg border border-green-500/25 bg-green-500/[0.05] px-4 py-3">
                  <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-1.5">
                    Impact
                  </p>
                  <p className="text-sm text-surface-300 leading-relaxed">{fm.impact}</p>
                </div>
              )}

              {/* Playbook goal */}
              {fm.goal && (
                <div className="mt-5 rounded-lg border border-blue-500/25 bg-blue-500/[0.05] px-4 py-3">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1.5">
                    Goal
                  </p>
                  <p className="text-sm text-surface-300 leading-relaxed">{fm.goal}</p>
                </div>
              )}

              {/* Playbook prerequisites */}
              {fm.prerequisites && fm.prerequisites.length > 0 && (
                <div className="mt-3 rounded-lg border border-surface-700/40 bg-surface-900/30 px-4 py-3">
                  <p className="text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-2">
                    Prerequisites
                  </p>
                  <ul className="space-y-1">
                    {fm.prerequisites.map((p, i) => (
                      <li key={i} className="text-sm text-surface-400 flex items-start gap-2">
                        <span className="text-surface-600 shrink-0 mt-0.5">—</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tags */}
              {fm.tags && fm.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {fm.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/tags/${tag}`}
                      className="text-xs text-surface-600 bg-white/[0.03] rounded-full px-2.5 py-0.5 border border-white/[0.06] hover:text-brand-400 hover:border-brand-500/20 transition-colors"
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              )}

              {/* Share actions */}
              <div className="mt-5 pt-4 border-t border-white/[0.05] flex items-center justify-between flex-wrap gap-3">
                <ArticleShare
                  title={fm.title}
                  description={fm.description}
                  url={canonicalUrl}
                  tags={fm.tags}
                />
                <Link
                  href="/syndicate"
                  className="text-[10px] font-mono text-surface-700 hover:text-brand-400 transition-colors"
                >
                  Generate post copy →
                </Link>
              </div>
            </header>

            {/* MDX content */}
            <ContentRenderer source={item.content} />

            {/* Related content */}
            {related.length > 0 && (
              <div className="mt-12 pt-8 border-t border-white/[0.06]">
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-surface-600 mb-4">
                  Related in {sectionMeta.title}
                </h3>
                <div className="space-y-2">
                  {related.map((r) => (
                    <Link
                      key={r.slug}
                      href={`${sectionMeta.href}/${r.slug}`}
                      className="group flex items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.015] px-4 py-3 hover:border-white/[0.10] hover:bg-white/[0.035] transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-surface-300 group-hover:text-surface-100 transition-colors truncate">
                          {r.frontmatter.title}
                        </p>
                        {r.frontmatter.description && (
                          <p className="text-xs text-surface-600 truncate mt-0.5 hidden sm:block">
                            {r.frontmatter.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <time className="text-[10px] font-mono text-surface-700">
                          {formatDateMono(r.frontmatter.date)}
                        </time>
                        <span className="text-surface-700 text-xs group-hover:text-surface-400 transition-colors">→</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Prev / next navigation */}
            {(prev || next) && (
              <nav
                aria-label="Article navigation"
                className="mt-14 pt-8 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                {prev ? (
                  <Link
                    href={`${sectionMeta.href}/${prev.slug}`}
                    className="group flex flex-col gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 hover:border-white/[0.12] hover:bg-white/[0.04] transition-all"
                  >
                    <span className="text-[10px] font-mono text-surface-600 uppercase tracking-widest">← Previous</span>
                    <span className="text-sm font-medium text-surface-300 group-hover:text-surface-100 transition-colors line-clamp-2">
                      {prev.frontmatter.title}
                    </span>
                  </Link>
                ) : <div />}

                {next ? (
                  <Link
                    href={`${sectionMeta.href}/${next.slug}`}
                    className="group flex flex-col gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 hover:border-white/[0.12] hover:bg-white/[0.04] transition-all sm:text-right"
                  >
                    <span className="text-[10px] font-mono text-surface-600 uppercase tracking-widest">Next →</span>
                    <span className="text-sm font-medium text-surface-300 group-hover:text-surface-100 transition-colors line-clamp-2">
                      {next.frontmatter.title}
                    </span>
                  </Link>
                ) : <div />}
              </nav>
            )}

            {/* Back link */}
            <div className="mt-6">
              <Link
                href={sectionMeta.href}
                className="inline-flex items-center gap-2 text-sm text-surface-600 hover:text-surface-300 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                All {sectionMeta.title}
              </Link>
            </div>

          </div>

          {/* ── TOC column — xl+ only ─────────────────────── */}
          {headings.length > 1 && (
            <aside
              aria-label="Table of contents"
              className="hidden xl:block w-52 shrink-0"
            >
              <div className="sticky top-8">
                <TableOfContents headings={headings} />
              </div>
            </aside>
          )}

        </div>
      </div>
    </>
  )
}
