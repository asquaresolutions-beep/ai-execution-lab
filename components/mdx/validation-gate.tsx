/**
 * ValidationGate — shows a pipeline validation gate with pass/fail/pending state.
 * Used in deployment checklists, pre-deploy gates, and automation pipelines.
 *
 * Usage:
 *   <ValidationGate
 *     title="TypeScript validation"
 *     command="tsc --noEmit"
 *     status="pass"
 *     output="No errors found."
 *   />
 *
 *   <ValidationGate
 *     title="Production build"
 *     command="next build"
 *     status="fail"
 *     output="Module not found: Can't resolve 'fs'"
 *   />
 */

import { cn } from '@/lib/utils'

type GateStatus = 'pass' | 'fail' | 'pending' | 'skip'

const STATUS_CONFIG: Record<GateStatus, {
  icon: string
  label: string
  borderClass: string
  bgClass: string
  iconClass: string
  labelClass: string
}> = {
  pass: {
    icon: '✓',
    label: 'Pass',
    borderClass: 'border-green-500/25',
    bgClass: 'bg-green-500/[0.04]',
    iconClass: 'text-green-400 bg-green-500/15 border-green-500/30',
    labelClass: 'text-green-400',
  },
  fail: {
    icon: '✕',
    label: 'Fail',
    borderClass: 'border-red-500/30',
    bgClass: 'bg-red-500/[0.04]',
    iconClass: 'text-red-400 bg-red-500/15 border-red-500/30',
    labelClass: 'text-red-400',
  },
  pending: {
    icon: '◎',
    label: 'Pending',
    borderClass: 'border-surface-700/50',
    bgClass: 'bg-surface-900/30',
    iconClass: 'text-surface-500 bg-surface-800/60 border-surface-700/50',
    labelClass: 'text-surface-500',
  },
  skip: {
    icon: '—',
    label: 'Skipped',
    borderClass: 'border-surface-800/40',
    bgClass: 'bg-surface-900/20',
    iconClass: 'text-surface-700 bg-surface-900/50 border-surface-800/40',
    labelClass: 'text-surface-700',
  },
}

interface ValidationGateProps {
  title: string
  command?: string
  status: GateStatus
  output?: string
  required?: boolean
}

export function ValidationGate({ title, command, status, output, required = true }: ValidationGateProps) {
  const config = STATUS_CONFIG[status]

  return (
    <div className={cn('my-3 rounded-lg border overflow-hidden', config.borderClass, config.bgClass)}>
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Status icon */}
        <div className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border shrink-0',
          config.iconClass
        )}>
          {config.icon}
        </div>

        {/* Title + command */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-surface-200">{title}</span>
            {required && status === 'pending' && (
              <span className="text-[10px] font-mono text-surface-700">required</span>
            )}
          </div>
          {command && (
            <code className="text-[11px] font-mono text-surface-600 mt-0.5 block">{command}</code>
          )}
        </div>

        {/* Status label */}
        <span className={cn('text-[11px] font-mono font-bold shrink-0', config.labelClass)}>
          {config.label}
        </span>
      </div>

      {/* Output */}
      {output && status !== 'skip' && (
        <div className={cn(
          'px-4 py-2 border-t text-xs font-mono leading-relaxed',
          status === 'fail' ? 'border-red-500/15 text-red-400/70' : 'border-white/[0.04] text-surface-600'
        )}>
          {output}
        </div>
      )}
    </div>
  )
}

/**
 * ValidationPipeline — groups multiple ValidationGates into a pipeline view.
 */
export function ValidationPipeline({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <div className="my-6">
      {title && (
        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-surface-600 mb-3">
          {title}
        </p>
      )}
      <div className="space-y-1">
        {children}
      </div>
    </div>
  )
}
