import Link from 'next/link'
import type { Metadata } from 'next'
import { buildTagIndex } from '@/lib/tags'
import { SECTION_META, ACCENT_CLASSES } from '@/lib/utils'
import { buildSectionMetadata } from '@/lib/metadata'

export const metadata: Metadata = buildSectionMetadata(
  'Topics',
  'Browse all topics across AI execution documentation, systems, labs, case studies, failure reports, and execution logs.',
  '/tags'
)

export default function TagsPage() {
  const tags = buildTagIndex()

  // Group into two tiers: 3+ uses = primary, 1-2 = secondary
  const primary   = tags.filter(t => t.count >= 3)
  const secondary = tags.filter(t => t.count < 3)

  // Get section spread for a tag
  function sectionSpread(items: typeof tags[0]['items']): string[] {
    const sections = new Set(items.map(i => SECTION_META[i.section].label))
    return Array.from(sections)
  }

  return (
    <div className="px-6 lg:px-8 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest rounded px-2 py-1 border text-brand-400 bg-brand-500/10 border-brand-500/25">
            TOPICS
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-50">
          All Topics
        </h1>
        <p className="mt-2 text-sm text-surface-400 leading-relaxed max-w-2xl">
          {tags.length} topics across {tags.reduce((n, t) => n + t.count, 0)} published items.
          Browse by topic to find related executions, failures, experiments, and documentation.
        </p>
      </div>

      {/* Primary tags — high-frequency */}
      {primary.length > 0 && (
        <div className="mb-8">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-surface-700 mb-4">
            Core topics
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {primary.map(({ tag, count, items }) => {
              const spread = sectionSpread(items)
              return (
                <Link
                  key={tag}
                  href={`/tags/${tag}`}
                  className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 hover:border-brand-500/20 hover:bg-brand-500/[0.03] transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-surface-300 group-hover:text-surface-100 transition-colors">
                        #{tag}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {spread.map(s => (
                        <span key={s} className="text-[10px] font-mono text-surface-700">{s}</span>
                      ))}
                    </div>
                  </div>
                  <span className="text-sm font-mono font-bold text-brand-500 ml-4 shrink-0">
                    {count}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Secondary tags — lower frequency */}
      {secondary.length > 0 && (
        <div>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-surface-700 mb-4">
            All topics
          </p>
          <div className="flex flex-wrap gap-2">
            {secondary.map(({ tag, count }) => (
              <Link
                key={tag}
                href={`/tags/${tag}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-3 py-1 text-xs font-mono text-surface-500 hover:text-surface-200 hover:border-white/[0.14] transition-all"
              >
                #{tag}
                <span className="text-surface-700">{count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {tags.length === 0 && (
        <div className="rounded-xl border border-white/[0.06] border-dashed p-12 text-center">
          <p className="text-surface-600 text-sm">No tagged content yet.</p>
        </div>
      )}
    </div>
  )
}
