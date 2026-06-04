import Link from 'next/link'
import type { ContentMeta, ContentSection } from '@/lib/content'
import { SECTION_META, ACCENT_CLASSES, formatDateMono, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { FeaturedArticles } from '@/components/lab/featured-articles'

// Tag pill — links to /tags/[tag]
function TagPill({ tag }: { tag: string }) {
  return (
    <Link
      href={`/tags/${tag}`}
      className="text-[11px] text-surface-700 bg-white/[0.03] rounded px-1.5 py-0.5 border border-white/[0.05] hover:text-brand-400 hover:border-brand-500/20 transition-colors"
    >
      #{tag}
    </Link>
  )
}

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
  confirmed:    { label: 'Confirmed',    variant: 'green'  as const },
  refuted:      { label: 'Refuted',      variant: 'red'    as const },
  inconclusive: { label: 'Inconclusive', variant: 'yellow' as const },
  ongoing:      { label: 'Ongoing',      variant: 'blue'   as const },
}

export function SectionIndex({ section, items }: SectionIndexProps) {
  const meta = SECTION_META[section]
  const ac   = ACCENT_CLASSES[meta.accent]

  return (
    <div className="px-6 lg:px-8 py-8 max-w-4xl">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className={cn(
            'text-[10px] font-mono font-bold uppercase tracking-widest rounded px-2 py-1 border',
            ac.text, ac.bg, ac.border
          )}>
            {meta.label}
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-50">
          {meta.title}
        </h1>
        <p className="mt-2 text-sm text-surface-400 leading-relaxed max-w-lg">
          {meta.description}
        </p>
      </div>

      {/* ── Featured (above the normal list) ─────────────────── */}
      <FeaturedArticles heading="Featured" />

      {/* ── Item count ─────────────────────────────────────────── */}
      {items.length > 0 && (
        <p className="text-[11px] font-mono text-surface-700 mb-4 uppercase tracking-widest">
          {items.length} {items.length === 1 ? 'entry' : 'entries'}
        </p>
      )}

      {/* ── Items ────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] border-dashed p-12 text-center">
          <p className="text-surface-600 text-sm">Nothing here yet. Work in progress.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.slug}
              href={`${meta.href}/${item.slug}`}
              className="group flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-5 rounded-xl border border-white/[0.05] bg-white/[0.02] px-5 py-4 hover:border-white/[0.10] hover:bg-white/[0.04] transition-all"
            >
              {/* Date */}
              <div className="shrink-0 text-[11px] text-surface-700 font-mono sm:w-24 sm:pt-0.5">
                {formatDateMono(item.frontmatter.date)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-surface-200 group-hover:text-surface-50 transition-colors">
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
                  <p className="text-sm text-surface-500 line-clamp-2 leading-snug">
                    {item.frontmatter.description}
                  </p>
                )}

                {item.frontmatter.tags && item.frontmatter.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.frontmatter.tags.map((tag) => (
                      <TagPill key={tag} tag={tag} />
                    ))}
                  </div>
                )}
              </div>

              {/* Reading time */}
              <div className="shrink-0 text-[11px] text-surface-700 font-mono sm:pt-0.5 sm:text-right">
                {item.readingTime}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
