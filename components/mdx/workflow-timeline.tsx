/**
 * WorkflowTimeline + TimelineStep — visual numbered workflow sequence.
 *
 * Usage:
 *   <WorkflowTimeline>
 *     <TimelineStep n={1} title="Read" duration="~1s" status="verified">
 *       GET the current content with context=edit...
 *     </TimelineStep>
 *     <TimelineStep n={2} title="Transform" status="verified">
 *       Apply changes to the in-memory copy...
 *     </TimelineStep>
 *   </WorkflowTimeline>
 */

import { cn } from '@/lib/utils'

const STATUS_CONFIG = {
  verified:     { label: 'Verified',    classes: 'text-green-400 bg-green-500/10 border-green-500/25' },
  critical:     { label: 'Critical',   classes: 'text-red-400 bg-red-500/10 border-red-500/25' },
  gate:         { label: 'Gate',        classes: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25' },
  automated:    { label: 'Automated',   classes: 'text-brand-400 bg-brand-500/10 border-brand-500/25' },
} as const

type StepStatus = keyof typeof STATUS_CONFIG

interface TimelineStepProps {
  n: number
  title: string
  duration?: string
  status?: StepStatus
  children: React.ReactNode
}

export function TimelineStep({ n, title, duration, status, children }: TimelineStepProps) {
  return (
    <div className="flex gap-5 relative">
      {/* Connector line (hidden on last child) */}
      <div className="flex flex-col items-center">
        {/* Step badge */}
        <div className="w-9 h-9 rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-sm font-bold font-mono text-brand-400 shrink-0 relative z-10">
          {n}
        </div>
        {/* Vertical line */}
        <div className="flex-1 w-px bg-gradient-to-b from-brand-500/25 to-transparent mt-1 min-h-[1rem]" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-7 pt-1">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <h4 className="text-sm font-semibold text-surface-100">{title}</h4>
          {duration && (
            <span className="text-[10px] font-mono text-surface-600">{duration}</span>
          )}
          {status && (
            <span className={cn(
              'text-[10px] font-mono rounded px-1.5 py-0.5 border',
              STATUS_CONFIG[status].classes
            )}>
              {STATUS_CONFIG[status].label}
            </span>
          )}
        </div>
        <div className="text-sm text-surface-400 leading-relaxed
          [&>p]:mb-2 [&>p:last-child]:mb-0
          [&>code]:bg-surface-800/80 [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-[11px] [&>code]:font-mono [&>code]:text-surface-300">
          {children}
        </div>
      </div>
    </div>
  )
}

export function WorkflowTimeline({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <div className="my-8">
      {title && (
        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-surface-600 mb-5">
          {title}
        </p>
      )}
      <div className="[&>*:last-child_div.flex-1.w-px]:hidden">
        {children}
      </div>
    </div>
  )
}
