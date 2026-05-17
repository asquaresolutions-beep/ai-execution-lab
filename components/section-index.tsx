import Link from 'next/link'
import type { ContentMeta, ContentSection } from '@/lib/content'
import { SECTION_META, formatDateShort, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface SectionIndexProps {
  section: ContentSection
  items: ContentMeta[]
}

const DIFFICULTY_BADGE = {
  beginner:     { label: 'Beginner',     variant: 'green'  as const },
  intermediate: { label: 'Intermediate', variant: 'yellow' as const },
  advanced:     { label: 'Advanced',     variant: 'red'    as const },
}

const RESULT_BADGE = {
  confirmed:    { label: 'Confirmed',    variant: 'green'   as const },
  refuted:      { label: 'Refuted',      variant: 'red'     as const },
  inconclusive: { label: 'Inconclusive', variant: 'yellow'  as const },
  ongoing:      { label: 'Ongoing',      variant: 'blue'    as const },
}

export function SectionIndex({ section, items }: SectionIndexProps) {
  const meta = SECTION_META[section]

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
      {/* Header */}
      <div className="max-w-2xl mb-12">
        <p className="text-2xl mb-3" aria-hidden>{meta.emoji}</p>
        <h1 className="text-3xl font-bold tracking-tight text-surface-50">
          {meta.title}
        </h1>
        <p className="mt-3 text-surface-400 leading-relaxed">
          {meta.description}
        </p>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-surface-800 border-dashed p-12 text-center">
          <p className="text-surface-500 text-sm">Nothing here yet. Work in progress.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.slug}
              href={`${meta.href}/${item.slug}`}
              className="group flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6 rounded-xl border border-surface-800 bg-surface-900/30 px-5 py-4 hover:border-surface-700 hover:bg-surface-900 transition-all"
            >
              {/* Date */}
              <div className="shrink-0 text-xs text-surface-600 font-mono sm:w-24 sm:text-right sm:pt-0.5">
                {formatDateShort(item.frontmatter.date)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-surface-100 group-hover:text-white transition-colors">
                    {item.frontmatter.title}
                  </span>
                  {item.frontmatter.status === 'draft' && (
                    <Badge variant="yellow">Draft</Badge>
                  )}
                  {item.frontmatter.difficulty && (
                    <Badge variant={DIFFICULTY_BADGE[item.frontmatter.difficulty].variant}>
                      {DIFFICULTY_BADGE[item.frontmatter.difficulty].label}
                    </Badge>
                  )}
                  {item.frontmatter.result && (
                    <Badge variant={RESULT_BADGE[item.frontmatter.result].variant}>
                      {RESULT_BADGE[item.frontmatter.result].label}
                    </Badge>
                  )}
                </div>
                {item.frontmatter.description && (
                  <p className="text-sm text-surface-400 line-clamp-2">
                    {item.frontmatter.description}
                  </p>
                )}
                {/* Tags */}
                {item.frontmatter.tags && item.frontmatter.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.frontmatter.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs text-surface-600 bg-surface-800/60 rounded px-1.5 py-0.5 border border-surface-700/50"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Reading time */}
              <div className="shrink-0 text-xs text-surface-600 sm:pt-0.5">
                {item.readingTime}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
