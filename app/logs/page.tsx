import Link from 'next/link'
import type { Metadata } from 'next'
import { getAllMeta, type ContentMeta } from '@/lib/content'
import { buildSectionMetadata } from '@/lib/metadata'
import { formatDateMono, cn } from '@/lib/utils'

export const metadata: Metadata = buildSectionMetadata(
  'Execution Logs',
  'Daily build logs, deployment journals, debugging sessions, and weekly execution summaries from active production AI work.',
  '/logs',
)

// ─────────────────────────────────────────────────────────────
// Type config
// ─────────────────────────────────────────────────────────────

const LOG_TYPE_CONFIG = {
  daily:      { label: 'Daily',      classes: 'text-surface-400 bg-surface-800/60 border-surface-700/40' },
  weekly:     { label: 'Weekly',     classes: 'text-blue-400 bg-blue-500/10 border-blue-500/25' },
  deployment: { label: 'Deploy',     classes: 'text-green-400 bg-green-500/10 border-green-500/25' },
  debug:      { label: 'Debug',      classes: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25' },
  experiment: { label: 'Experiment', classes: 'text-purple-400 bg-purple-500/10 border-purple-500/25' },
  release:    { label: 'Release',    classes: 'text-brand-400 bg-brand-500/10 border-brand-500/25' },
} as const

// ─────────────────────────────────────────────────────────────
// Log entry row
// ─────────────────────────────────────────────────────────────

function LogRow({ item }: { item: ContentMeta }) {
  const { frontmatter: fm, slug, readingTime } = item
  const typeConf = fm.log_type ? LOG_TYPE_CONFIG[fm.log_type] : null

  return (
    <Link
      href={`/logs/${slug}`}
      className="group flex items-start gap-3 sm:gap-5 px-4 py-3.5 hover:bg-white/[0.025] transition-colors"
    >
      {/* Date */}
      <time className="text-[11px] font-mono text-surface-700 shrink-0 w-20 pt-0.5 hidden sm:block">
        {formatDateMono(fm.date)}
      </time>

      {/* Type badge */}
      <div className="shrink-0 pt-0.5">
        {typeConf ? (
          <span className={cn('text-[10px] font-mono rounded px-1.5 py-0.5 border', typeConf.classes)}>
            {typeConf.label}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-surface-700 rounded px-1.5 py-0.5 border border-white/[0.05]">
            Log
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-surface-200 group-hover:text-surface-50 transition-colors">
            {fm.title}
          </span>
          {fm.duration && (
            <span className="text-[10px] font-mono text-surface-700 hidden sm:inline">
              {fm.duration}
            </span>
          )}
        </div>
        {fm.outcome && (
          <p className="mt-0.5 text-xs text-surface-500 line-clamp-1">
            {fm.outcome}
          </p>
        )}
        {fm.tags && fm.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1 hidden sm:flex">
            {fm.tags.slice(0, 4).map(tag => (
              <span key={tag} className="text-[10px] text-surface-700">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Reading time */}
      <div className="shrink-0 text-[11px] font-mono text-surface-700 pt-0.5 hidden md:block">
        {readingTime}
      </div>
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function LogsPage() {
  const items = getAllMeta('logs')

  // Group by month
  const grouped: Record<string, ContentMeta[]> = {}
  for (const item of items) {
    const month = item.frontmatter.date.slice(0, 7) // "2026-05"
    if (!grouped[month]) grouped[month] = []
    grouped[month].push(item)
  }
  const months = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="px-6 lg:px-8 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest rounded px-2 py-1 border text-purple-400 bg-purple-500/10 border-purple-500/25">
            EXECUTION LOGS
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-50">
          Execution Logs
        </h1>
        <p className="mt-2 text-sm text-surface-400 leading-relaxed max-w-2xl">
          Daily build sessions, deployment journals, debugging notes, and weekly summaries from
          active production AI work. Lightweight format — written during or immediately after execution.
        </p>
        <p className="mt-2 text-xs font-mono text-surface-600">
          {items.length} {items.length === 1 ? 'entry' : 'entries'} · ordered by date
        </p>
      </div>

      {/* Log list */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] border-dashed p-12 text-center">
          <p className="text-surface-600 text-sm">No logs yet. First entry coming soon.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {months.map((month) => {
            const [year, m] = month.split('-')
            const label = new Date(Number(year), Number(m) - 1).toLocaleString('en-US', {
              month: 'long', year: 'numeric',
            })
            return (
              <div key={month}>
                <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-surface-700 mb-2 px-4">
                  {label}
                </p>
                <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
                  {grouped[month].map((item) => (
                    <LogRow key={item.slug} item={item} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
