/**
 * components/mdx/case-study-meta.tsx
 * Structured metadata header for long-form operational case studies.
 * Renders timeline, stack, outcomes, and operational context.
 */

import { cn } from '@/lib/utils'

interface Outcome {
  metric:  string
  before:  string
  after:   string
  delta?:  string   // e.g. "+340%", "-47s", "0 → 1k"
}

interface Props {
  dateRange:   string              // "March–May 2026" or "2026-04-12"
  duration?:   string              // "6 weeks", "3 hours"
  stack:       string[]            // tools used
  outcomes:    Outcome[]           // measurable results
  context?:    string              // one-line operational context
  difficulty?: 'resolved' | 'ongoing' | 'partial'
}

const STATUS_STYLES = {
  resolved: { dot: 'bg-green-500', text: 'text-green-400', label: 'Resolved' },
  ongoing:  { dot: 'bg-yellow-500 animate-pulse', text: 'text-yellow-400', label: 'Ongoing' },
  partial:  { dot: 'bg-orange-500', text: 'text-orange-400', label: 'Partial resolution' },
}

export function CaseStudyMeta({
  dateRange,
  duration,
  stack,
  outcomes,
  context,
  difficulty = 'resolved',
}: Props) {
  const status = STATUS_STYLES[difficulty]

  return (
    <div className="my-6 rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] flex-wrap">
        <div className={cn('w-2 h-2 rounded-full shrink-0', status.dot)} />
        <span className={cn('text-[10px] font-mono font-semibold uppercase', status.text)}>
          {status.label}
        </span>
        <span className="text-[10px] font-mono text-surface-600">{dateRange}</span>
        {duration && (
          <>
            <span className="text-surface-800">·</span>
            <span className="text-[10px] font-mono text-surface-600">{duration}</span>
          </>
        )}
        {context && (
          <>
            <span className="text-surface-800">·</span>
            <span className="text-[10px] text-surface-500 truncate">{context}</span>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">

        {/* Outcomes table */}
        <div className="px-5 py-4">
          <p className="text-[10px] font-mono text-surface-700 uppercase tracking-wider mb-3">
            Measurable outcomes
          </p>
          <div className="space-y-2">
            {outcomes.map((o, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-[10px] font-mono text-surface-600 w-20 shrink-0 pt-0.5">{o.metric}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono text-surface-500 line-through">{o.before}</span>
                    <span className="text-[10px] text-surface-700">→</span>
                    <span className="text-[11px] font-mono text-surface-200">{o.after}</span>
                    {o.delta && (
                      <span className={cn(
                        'text-[10px] font-mono font-semibold',
                        o.delta.startsWith('+') ? 'text-green-400' :
                        o.delta.startsWith('-') ? 'text-red-400' :
                        'text-surface-400'
                      )}>
                        {o.delta}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stack */}
        <div className="px-5 py-4">
          <p className="text-[10px] font-mono text-surface-700 uppercase tracking-wider mb-3">
            Stack
          </p>
          <div className="flex flex-wrap gap-1.5">
            {stack.map(tool => (
              <span
                key={tool}
                className="text-[10px] font-mono text-surface-400 bg-surface-800/60 border border-surface-700/40 rounded px-2 py-0.5"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
