import Link from 'next/link'
import type { Metadata } from 'next'
import { getAllMeta, type ContentMeta } from '@/lib/content'
import { buildSectionMetadata } from '@/lib/metadata'
import { formatDateMono, cn } from '@/lib/utils'
import { getFailureMemory, getPatternCoverage, getFailureMemorySummary } from '@/lib/failure-memory'
import { getFailuresForPattern, ENTITIES } from '@/lib/operational-memory'
import { ConfidenceChip } from '@/components/operational/confidence-badge'

export const metadata: Metadata = buildSectionMetadata(
  'Failure Archive',
  'Documented production failures — root cause analysis, resolution timelines, and prevention patterns from real AI execution work.',
  '/failures',
)

// ─────────────────────────────────────────────────────────────
// Config
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
  build:          'Build',
  runtime:        'Runtime',
  deployment:     'Deployment',
  data:           'Data',
  performance:    'Performance',
  dependency:     'Dependency',
  configuration:  'Config',
  authentication: 'Auth',
}

// ─────────────────────────────────────────────────────────────
// Failure card
// ─────────────────────────────────────────────────────────────

function FailureCard({
  item,
  confidenceScore,
  isRecurring,
  patternName,
}: {
  item: ContentMeta
  confidenceScore?: number
  isRecurring?: boolean
  patternName?: string
}) {
  const { frontmatter: fm, slug, readingTime } = item
  const sev = fm.severity ? SEVERITY_CONFIG[fm.severity as keyof typeof SEVERITY_CONFIG] : null
  const sta = fm.failure_status ? STATUS_CONFIG[fm.failure_status as keyof typeof STATUS_CONFIG] : null

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
          {isRecurring && (
            <span className="text-[10px] font-mono text-orange-400 bg-orange-500/10 border border-orange-500/25 rounded px-1.5 py-0.5">
              Recurring
            </span>
          )}
        </div>

        {fm.impact && (
          <p className="text-sm text-surface-500 leading-snug line-clamp-2 mb-2">
            {fm.impact}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {fm.project && (
            <span className="text-[10px] font-mono text-surface-700">
              {fm.project}
              {fm.resolution_time && ` · resolved in ${fm.resolution_time}`}
            </span>
          )}
          {patternName && (
            <span className="text-[10px] font-mono text-surface-700">
              ◈ {patternName}
            </span>
          )}
        </div>
      </div>

      {/* Right column: confidence + reading time */}
      <div className="shrink-0 flex flex-col items-end gap-2">
        {confidenceScore !== undefined && confidenceScore >= 0 && (
          <ConfidenceChip score={confidenceScore} />
        )}
        <span className="text-[11px] text-surface-700 font-mono hidden sm:block">
          {readingTime}
        </span>
      </div>
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────
// Pattern cluster summary strip
// ─────────────────────────────────────────────────────────────

function PatternClusters() {
  const coverage = getPatternCoverage().filter(p => p.instanceCount >= 2)
  if (coverage.length === 0) return null

  return (
    <div className="mb-8">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-600 mb-3">
        Recurring Pattern Families
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {coverage.map(p => {
          const slug = p.patternId.replace('pattern:', '')
          const href = `/docs/failure-pattern-library#${slug}`
          return (
            <Link
              key={p.patternId}
              href={href}
              className="group flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 hover:border-orange-500/20 hover:bg-orange-500/[0.02] transition-all"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-surface-300 group-hover:text-surface-100 transition-colors truncate">
                  {p.patternName}
                </p>
                <p className="text-[10px] font-mono text-surface-600 mt-0.5">
                  {p.instanceCount} instances · {p.confidence} confidence
                </p>
              </div>
              <span className="text-surface-700 text-xs ml-2 group-hover:text-surface-400 shrink-0 transition-colors">→</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Archive stats
// ─────────────────────────────────────────────────────────────

function ArchiveStats({ items }: { items: ContentMeta[] }) {
  const total    = items.length
  const resolved = items.filter(i => i.frontmatter.failure_status === 'resolved').length
  const high     = items.filter(i => i.frontmatter.severity === 'high' || i.frontmatter.severity === 'critical').length
  const summary  = getFailureMemorySummary()

  if (total === 0) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {[
        { label: 'Documented',       value: total,                   color: 'text-red-400' },
        { label: 'Resolved',          value: resolved,                color: 'text-green-400' },
        { label: 'High / Critical',   value: high,                   color: 'text-orange-400' },
        { label: 'High Confidence',   value: `${summary.highConfidence}/${total}`, color: 'text-brand-400' },
      ].map(({ label, value, color }) => (
        <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-center">
          <p className={cn('text-2xl font-bold font-mono', color)}>{value}</p>
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
  const items        = getAllMeta('failures')
  const memoryTable  = getFailureMemory()

  // Build lookup maps
  const confidenceMap = Object.fromEntries(memoryTable.map(f => [f.slug, f.confidenceScore]))
  const instanceMap   = Object.fromEntries(memoryTable.map(f => [f.slug, f.instanceCount]))

  // Build slug → primary pattern name map
  const patternMap: Record<string, string> = {}
  for (const entity of ENTITIES.filter(e => e.type === 'pattern')) {
    const members = getFailuresForPattern(entity.id)
    for (const m of members) {
      const slug = m.href.split('/').pop() ?? ''
      if (slug && !patternMap[slug]) {
        patternMap[slug] = entity.title
      }
    }
  }

  return (
    <div className="px-6 lg:px-8 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest rounded px-2 py-1 border text-red-400 bg-red-500/10 border-red-500/25">
            FAILURE ARCHIVE
          </span>
          <Link
            href="/docs/failure-pattern-library"
            className="text-[10px] font-mono text-surface-700 hover:text-brand-400 transition-colors"
          >
            Pattern Library →
          </Link>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-50">
          Failure Archive
        </h1>
        <p className="mt-2 text-sm text-surface-400 leading-relaxed max-w-2xl">
          Documented production failures from real AI execution work. Every entry has a root cause analysis,
          resolution timeline, prevention pattern, and a confidence score for the verified fix.
        </p>
        <p className="mt-2 text-xs font-mono text-surface-600">
          No fabricated incidents. Everything here happened.
        </p>
      </div>

      <ArchiveStats items={items} />
      <PatternClusters />

      {/* Items */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] border-dashed p-12 text-center">
          <p className="text-surface-600 text-sm">No failures documented yet. Work in progress.</p>
        </div>
      ) : (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-600 mb-3">
            All Failures — Chronological
          </p>
          <div className="space-y-2">
            {items.map((item) => (
              <FailureCard
                key={item.slug}
                item={item}
                confidenceScore={confidenceMap[item.slug]}
                isRecurring={(instanceMap[item.slug] ?? 1) >= 2}
                patternName={patternMap[item.slug]}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
