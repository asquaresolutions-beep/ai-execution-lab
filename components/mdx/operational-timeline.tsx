/**
 * components/mdx/operational-timeline.tsx
 * Timeline renderer for case studies. Shows dated operational events
 * with evidence links, severity indicators, and phase grouping.
 */

import { cn } from '@/lib/utils'

export interface TimelineEvent {
  date:       string           // "2026-04-12" or "Week 1"
  event:      string           // what happened
  type?:      'build' | 'deploy' | 'failure' | 'fix' | 'milestone' | 'measurement' | 'decision'
  evidence?:  string           // link text
  evidenceHref?: string
  note?:      string           // additional context
}

interface Props {
  events:   TimelineEvent[]
  title?:   string
}

const TYPE_STYLES: Record<string, { dot: string; line: string; badge: string; label: string }> = {
  build:       { dot: 'bg-brand-500',   line: 'border-brand-500/30',   badge: 'text-brand-400 bg-brand-500/10 border-brand-500/20',   label: 'build'       },
  deploy:      { dot: 'bg-green-500',   line: 'border-green-500/30',   badge: 'text-green-400 bg-green-500/10 border-green-500/20',   label: 'deploy'      },
  failure:     { dot: 'bg-red-500',     line: 'border-red-500/30',     badge: 'text-red-400 bg-red-500/10 border-red-500/20',         label: 'failure'     },
  fix:         { dot: 'bg-cyan-500',    line: 'border-cyan-500/30',    badge: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',      label: 'fix'         },
  milestone:   { dot: 'bg-amber-500',   line: 'border-amber-500/30',   badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   label: 'milestone'   },
  measurement: { dot: 'bg-purple-500',  line: 'border-purple-500/30',  badge: 'text-purple-400 bg-purple-500/10 border-purple-500/20',label: 'measurement' },
  decision:    { dot: 'bg-yellow-500',  line: 'border-yellow-500/30',  badge: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',label: 'decision'    },
}

const DEFAULT_STYLE = {
  dot: 'bg-surface-600',
  line: 'border-surface-700/30',
  badge: 'text-surface-500 bg-surface-800/60 border-surface-700/30',
  label: 'event',
}

export function OperationalTimeline({ events, title }: Props) {
  return (
    <div className="my-6">
      {title && (
        <p className="text-[10px] font-mono text-surface-700 uppercase tracking-widest mb-4">
          {title}
        </p>
      )}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[9px] top-3 bottom-3 w-px bg-white/[0.06]" />

        <div className="space-y-0">
          {events.map((ev, i) => {
            const s = ev.type ? (TYPE_STYLES[ev.type] ?? DEFAULT_STYLE) : DEFAULT_STYLE
            const isLast = i === events.length - 1

            return (
              <div key={i} className="relative flex gap-5 pb-5">
                {/* Dot */}
                <div className="relative z-10 shrink-0 mt-1.5">
                  <div className={cn('w-[7px] h-[7px] rounded-full', s.dot)} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-start gap-3 flex-wrap">
                    <time className="text-[10px] font-mono text-surface-600 shrink-0 mt-0.5">
                      {ev.date}
                    </time>
                    {ev.type && (
                      <span className={cn(
                        'text-[10px] font-mono rounded px-1.5 py-0.5 border shrink-0',
                        s.badge
                      )}>
                        {s.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-surface-300 mt-1 leading-snug">
                    {ev.event}
                  </p>
                  {ev.note && (
                    <p className="text-[11px] text-surface-600 mt-0.5 leading-relaxed">
                      {ev.note}
                    </p>
                  )}
                  {ev.evidence && ev.evidenceHref && (
                    <a
                      href={ev.evidenceHref}
                      className="inline-flex items-center gap-1 mt-1 text-[10px] font-mono text-brand-500/70 hover:text-brand-400 transition-colors"
                    >
                      ↗ {ev.evidence}
                    </a>
                  )}
                  {ev.evidence && !ev.evidenceHref && (
                    <p className="mt-1 text-[10px] font-mono text-surface-700">
                      Evidence: {ev.evidence}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
