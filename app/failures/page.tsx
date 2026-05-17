import Link from 'next/link'
import type { Metadata } from 'next'
import { getAllMeta, type ContentMeta } from '@/lib/content'
import { formatDateMono, cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Failure Archive',
  description: 'Documented production failures — root cause analysis, resolution timelines, and prevention patterns from real AI execution work.',
}

// ─────────────────────────────────────────────────────────────
// Severity config
// ─────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  low:      { label: 'Low',      classes: 'text-blue-400 bg-blue-500/10 border-blue-500/25',       dot: 'bg-blue-400' },
  medium:   { label: 'Medium',   classes: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25', dot: 'bg-yellow-400' },
  high:     { label: 'High',     classes: 'text-orange-400 bg-orange-500/10 border-orange-500/25', dot: 'bg-orange-400' },
  critical: { label: 'Critical', classes: 'text-red-400 bg-red-500/10 border-red-500/25',          dot: 'bg-red-400' },
} as const

const STATUS_CONFIG = {
  open:          { label: 'Open',          classes: 'text-red-400 bg-red-500/10 border-red-500/25' },
  investigating: { label: 'Investigating', classes: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25' },
  resolved:      { label: 'Resolved',      classes: 'text-green-400 bg-green-500/10 border-green-500/25' },
} as const

const FAILURE_TYPE_LABELS: Record<string, string> = {
  build:       'Build',
  runtime:     'Runtime',
  deployment:  'Deployment',
  data:        'Data',
  performance: 'Performance',
  dependency:  'Dependency',
}

// ─────────────────────────────────────────────────────────────
// Failure card
// ─────────────────────────────────────────────────────────────

function FailureCard({ item }: { item: ContentMeta }) {
  const { frontmatter: fm, slug, readingTime } = item
  const sev = fm.severity ? SEVERITY_CONFIG[fm.severity] : null
  const sta = fm.failure_status ? STATUS_CONFIG[fm.failure_status] : null

  return (
    <Link
      href={`/failures/${slug}`}
      className="group flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 hover:border-red-500/20 hover:bg-red-500/[0.02] transition-all"
    >
      {/* Severity dot + date */}
      <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1.5 shrink-0">
        {sev && (
          <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', sev.dot)} />
        )}
        <span className="text-[11px] text-surface-700 font-mono sm:w-20 sm:text-right">
          {formatDateMono(fm.date)}
        </span>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span className="text-sm font-semibold text-surface-200 group-hover:text-surface-50 transition-colors">
            {fm.title}
          </span>
          {sev && (
            <span className={cn('text-[10px] font-mono rounded px-1.5 py-0.5 border', sev.classes)}>
              {sev.label}
            </span>
          )}
          {sta && (
            <span className={cn('text-[10px] font-mono rounded px-1.5 py-0.5 border', sta.classes)}>
              {sta.label}
            </span>
          )}
          {fm.failure_type && (
            <span className="text-[10px] font-mono text-surface-700 bg-surface-800/50 border border-white/[0.05] rounded px-1.5 py-0.5">
              {FAILURE_TYPE_LABELS[fm.failure_type] ?? fm.failure_type}
            </span>
          )}
        </div>

        {fm.impact && (
          <p className="text-sm text-surface-500 leading-snug line-clamp-2 mb-2">
            {fm.impact}
          </p>
        )}

        {fm.project && (
          <span className="text-[10px] font-mono text-surface-700">
            {fm.project}
            {fm.resolution_time && ` · resolved in ${fm.resolution_time}`}
          </span>
        )}
      </div>

      {/* Reading time */}
      <div className="shrink-0 text-[11px] text-surface-700 font-mono sm:pt-0.5 sm:text-right hidden sm:block">
        {readingTime}
      </div>
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────────────────────

function ArchiveStats({ items }: { items: ContentMeta[] }) {
  const total    = items.length
  const resolved = items.filter(i => i.frontmatter.failure_status === 'resolved').length
  const high     = items.filter(i => i.frontmatter.severity === 'high' || i.frontmatter.severity === 'critical').length

  if (total === 0) return null

  return (
    <div className="grid grid-cols-3 gap-3 mb-8">
      {[
        { label: 'Total Documented', value: total },
        { label: 'Resolved',         value: resolved },
        { label: 'High / Critical',  value: high },
      ].map(({ label, value }) => (
        <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-center">
          <p className="text-2xl font-bold font-mono text-red-400">{value}</p>
          <p className="text-[10px] font-mono text-surface-600 mt-1 uppercase tracking-wide">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function FailuresPage() {
  const items = getAllMeta('failures')

  return (
    <div className="px-6 lg:px-8 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest rounded px-2 py-1 border text-red-400 bg-red-500/10 border-red-500/25">
            FAILURE ARCHIVE
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-50">
          Failure Archive
        </h1>
        <p className="mt-2 text-sm text-surface-400 leading-relaxed max-w-2xl">
          Documented production failures from real AI execution work. Every entry has a root cause analysis,
          resolution timeline, and a prevention pattern so the same failure doesn&apos;t happen twice.
        </p>
        <p className="mt-2 text-xs font-mono text-surface-600">
          No fabricated incidents. Everything here happened.
        </p>
      </div>

      <ArchiveStats items={items} />

      {/* Items */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] border-dashed p-12 text-center">
          <p className="text-surface-600 text-sm">No failures documented yet. Work in progress.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <FailureCard key={item.slug} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
