import Link from 'next/link'
import { getAllMeta } from '@/lib/content'
import { cn, formatDateMono } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const SEV_DOT: Record<string, string> = {
  low:      'bg-blue-400',
  medium:   'bg-yellow-400',
  high:     'bg-orange-400',
  critical: 'bg-red-500',
}

const STATUS_LABEL: Record<string, { text: string; class: string }> = {
  open:          { text: 'Open',     class: 'text-red-400' },
  investigating: { text: 'Active',   class: 'text-yellow-400' },
  resolved:      { text: 'Resolved', class: 'text-green-400' },
}

const TYPE_LABEL: Record<string, string> = {
  build:       'Build',
  runtime:     'Runtime',
  deployment:  'Deploy',
  data:        'Data',
  performance: 'Perf',
  dependency:  'Dep',
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function FeaturedFailures() {
  const items = getAllMeta('failures').slice(0, 3)
  if (items.length === 0) return null

  const total    = getAllMeta('failures').length
  const resolved = getAllMeta('failures').filter(i => i.frontmatter.failure_status === 'resolved').length

  return (
    <div className="mb-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600">
            Failure Archive
          </h2>
          <div className="flex items-center gap-2 text-[10px] font-mono text-surface-700">
            <span>{total} documented</span>
            <span>·</span>
            <span className="text-green-400">{resolved} resolved</span>
          </div>
        </div>
        <Link
          href="/failures"
          className="text-[11px] font-mono text-surface-700 hover:text-red-400 transition-colors"
        >
          All incidents →
        </Link>
      </div>

      {/* Incident list */}
      <div className="rounded-xl border border-white/[0.05] divide-y divide-white/[0.04] overflow-hidden">
        {items.map((item) => {
          const fm  = item.frontmatter
          const dot = fm.severity ? SEV_DOT[fm.severity] : 'bg-surface-600'
          const sta = fm.failure_status ? STATUS_LABEL[fm.failure_status] : null
          const typ = fm.failure_type ? TYPE_LABEL[fm.failure_type] : null

          return (
            <Link
              key={item.slug}
              href={`/failures/${item.slug}`}
              className="group flex items-center gap-3.5 px-4 py-3 bg-white/[0.01] hover:bg-red-500/[0.025] transition-colors"
            >
              {/* Severity dot */}
              <div className={cn('w-2 h-2 rounded-full shrink-0', dot)} />

              {/* Title */}
              <div className="flex-1 min-w-0">
                <span className="text-sm text-surface-300 group-hover:text-surface-100 transition-colors truncate block">
                  {fm.title}
                </span>
                {fm.impact && (
                  <span className="text-[11px] text-surface-600 truncate block mt-0.5 hidden sm:block">
                    {fm.impact.split('.')[0]}.
                  </span>
                )}
              </div>

              {/* Meta */}
              <div className="flex items-center gap-2.5 shrink-0">
                {typ && (
                  <span className="text-[10px] font-mono text-surface-700 hidden md:block">
                    {typ}
                  </span>
                )}
                {sta && (
                  <span className={cn('text-[10px] font-mono', sta.class)}>
                    {sta.text}
                  </span>
                )}
                {fm.resolution_time && (
                  <span className="text-[10px] font-mono text-surface-700 hidden sm:block">
                    {fm.resolution_time}
                  </span>
                )}
                <time className="text-[10px] font-mono text-surface-700 hidden sm:block">
                  {formatDateMono(fm.date)}
                </time>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
