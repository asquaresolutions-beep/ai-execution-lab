/**
 * IncidentReport — structured production incident documentation component.
 * Used in the Failure Archive content section.
 *
 * Usage:
 *   <IncidentReport
 *     id="INC-001"
 *     severity="high"
 *     status="resolved"
 *     date="2026-05-15"
 *     project="ai-execution-lab"
 *     impact="Production deployment blocked — Vercel edge step failed"
 *     resolutionTime="25 min"
 *     rootCause="export const runtime = 'edge' in opengraph-image.tsx prevents static pre-rendering"
 *     resolution="Removed the edge runtime export — OG image pre-renders as static PNG"
 *     prevention="Metadata image files should never export edge runtime"
 *   />
 */

import { cn } from '@/lib/utils'

type Severity = 'low' | 'medium' | 'high' | 'critical'
type IncidentStatus = 'open' | 'investigating' | 'resolved'
type FailureType = 'build' | 'runtime' | 'deployment' | 'data' | 'performance' | 'dependency'

const SEVERITY_CONFIG: Record<Severity, { label: string; classes: string; dot: string }> = {
  low:      { label: 'Low',      classes: 'text-blue-400 bg-blue-500/10 border-blue-500/30',     dot: 'bg-blue-400' },
  medium:   { label: 'Medium',   classes: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', dot: 'bg-yellow-400' },
  high:     { label: 'High',     classes: 'text-orange-400 bg-orange-500/10 border-orange-500/30', dot: 'bg-orange-400' },
  critical: { label: 'Critical', classes: 'text-red-400 bg-red-500/10 border-red-500/30',         dot: 'bg-red-400' },
}

const STATUS_CONFIG: Record<IncidentStatus, { label: string; classes: string }> = {
  open:          { label: 'Open',          classes: 'text-red-400 bg-red-500/10 border-red-500/25' },
  investigating: { label: 'Investigating', classes: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25' },
  resolved:      { label: 'Resolved',      classes: 'text-green-400 bg-green-500/10 border-green-500/25' },
}

const FAILURE_TYPE_LABELS: Record<FailureType, string> = {
  build:       'Build Failure',
  runtime:     'Runtime Failure',
  deployment:  'Deployment Failure',
  data:        'Data Failure',
  performance: 'Performance Issue',
  dependency:  'Dependency Issue',
}

interface IncidentReportProps {
  id: string
  severity: Severity
  status: IncidentStatus
  date: string
  project: string
  failureType?: FailureType
  impact: string
  resolutionTime?: string
  rootCause: string
  resolution: string
  prevention: string
  affectedSystems?: string
}

export function IncidentReport({
  id,
  severity,
  status,
  date,
  project,
  failureType,
  impact,
  resolutionTime,
  rootCause,
  resolution,
  prevention,
  affectedSystems,
}: IncidentReportProps) {
  const sev = SEVERITY_CONFIG[severity]
  const sta = STATUS_CONFIG[status]

  return (
    <div className="my-8 rounded-xl border border-white/[0.08] overflow-hidden">
      {/* Incident header */}
      <div className="flex items-start justify-between gap-4 px-5 py-4 bg-surface-900/60 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Severity dot */}
          <div className={cn('w-2.5 h-2.5 rounded-full shrink-0 mt-0.5', sev.dot)} />

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono text-surface-600">{id}</span>
              <span className={cn('text-[10px] font-mono rounded px-1.5 py-0.5 border', sev.classes)}>
                {sev.label}
              </span>
              <span className={cn('text-[10px] font-mono rounded px-1.5 py-0.5 border', sta.classes)}>
                {sta.label}
              </span>
              {failureType && (
                <span className="text-[10px] font-mono text-surface-600 bg-surface-800/60 border border-white/[0.06] rounded px-1.5 py-0.5">
                  {FAILURE_TYPE_LABELS[failureType]}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-[10px] font-mono text-surface-600">{date}</p>
          <p className="text-[10px] font-mono text-surface-700 mt-0.5">{project}</p>
        </div>
      </div>

      {/* Impact */}
      <div className="px-5 py-4 border-b border-white/[0.04] bg-red-500/[0.03]">
        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-red-500/70 mb-2">
          Impact
        </p>
        <p className="text-sm text-surface-300 leading-relaxed">{impact}</p>
        {affectedSystems && (
          <p className="text-xs font-mono text-surface-600 mt-1.5">
            Affected: {affectedSystems}
          </p>
        )}
        {resolutionTime && (
          <p className="text-xs font-mono text-surface-600 mt-1">
            Time to resolve: {resolutionTime}
          </p>
        )}
      </div>

      {/* Root cause */}
      <div className="px-5 py-4 border-b border-white/[0.04]">
        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-orange-500/70 mb-2">
          Root Cause
        </p>
        <p className="text-sm text-surface-300 leading-relaxed">{rootCause}</p>
      </div>

      {/* Resolution */}
      <div className="px-5 py-4 border-b border-white/[0.04] bg-green-500/[0.02]">
        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-green-500/70 mb-2">
          Resolution
        </p>
        <p className="text-sm text-surface-300 leading-relaxed">{resolution}</p>
      </div>

      {/* Prevention */}
      <div className="px-5 py-4 bg-brand-500/[0.03]">
        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-400/70 mb-2">
          Prevention Pattern
        </p>
        <p className="text-sm text-surface-300 leading-relaxed">{prevention}</p>
      </div>
    </div>
  )
}
