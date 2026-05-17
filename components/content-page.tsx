import Link from 'next/link'
import type { ContentItem } from '@/lib/content'
import { SECTION_META, formatDate, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ContentRenderer } from './content-renderer'

interface ContentPageProps {
  item: ContentItem
}

export async function ContentPage({ item }: ContentPageProps) {
  const sectionMeta = SECTION_META[item.section]
  const fm = item.frontmatter

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-4xl mx-auto">

        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-xs text-surface-500">
          <Link href="/" className="hover:text-surface-300 transition-colors">Home</Link>
          <span>/</span>
          <Link href={sectionMeta.href} className="hover:text-surface-300 transition-colors">
            {sectionMeta.title}
          </Link>
          <span>/</span>
          <span className="text-surface-400 truncate max-w-xs">{fm.title}</span>
        </nav>

        {/* Header */}
        <header className="mb-10 pb-8 border-b border-surface-800">

          {/* Section badge */}
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <Link
              href={sectionMeta.href}
              className="inline-flex items-center gap-1 text-xs text-surface-500 hover:text-brand-400 transition-colors"
            >
              <span>{sectionMeta.emoji}</span>
              <span>{sectionMeta.title}</span>
            </Link>
            {fm.status === 'draft' && <Badge variant="yellow">Draft</Badge>}
            {fm.difficulty && (
              <Badge variant={fm.difficulty === 'advanced' ? 'red' : fm.difficulty === 'intermediate' ? 'yellow' : 'green'}>
                {fm.difficulty}
              </Badge>
            )}
            {fm.result && (
              <Badge variant={
                fm.result === 'confirmed' ? 'green' :
                fm.result === 'refuted' ? 'red' :
                fm.result === 'ongoing' ? 'blue' : 'yellow'
              }>
                {fm.result}
              </Badge>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-surface-50 text-balance leading-[1.15]">
            {fm.title}
          </h1>

          {fm.description && (
            <p className="mt-4 text-lg text-surface-400 leading-relaxed max-w-3xl">
              {fm.description}
            </p>
          )}

          {/* Meta row */}
          <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-surface-500">
            <time dateTime={fm.date}>{formatDate(fm.date)}</time>
            {fm.updated && fm.updated !== fm.date && (
              <span>Updated {formatDate(fm.updated)}</span>
            )}
            <span>{item.readingTime}</span>
            {fm.stack && fm.stack.length > 0 && (
              <span className="flex items-center gap-1">
                <span>Stack:</span>
                <span className="text-surface-400">{fm.stack.join(' · ')}</span>
              </span>
            )}
          </div>

          {/* Lab-specific: hypothesis */}
          {fm.hypothesis && (
            <div className="mt-5 rounded-lg border border-brand-500/30 bg-brand-500/5 px-4 py-3">
              <p className="text-xs font-semibold text-brand-400 uppercase tracking-wide mb-1">Hypothesis</p>
              <p className="text-sm text-surface-300">{fm.hypothesis}</p>
            </div>
          )}

          {/* Case study: impact */}
          {fm.impact && (
            <div className="mt-5 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3">
              <p className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-1">Impact</p>
              <p className="text-sm text-surface-300">{fm.impact}</p>
            </div>
          )}

          {/* Tags */}
          {fm.tags && fm.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {fm.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs text-surface-500 bg-surface-800 rounded-full px-2.5 py-0.5 border border-surface-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* MDX content */}
        <ContentRenderer source={item.content} />

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-surface-800">
          <Link
            href={sectionMeta.href}
            className="inline-flex items-center gap-2 text-sm text-surface-400 hover:text-surface-200 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to {sectionMeta.title}
          </Link>
        </div>
      </div>
    </div>
  )
}
