/**
 * components/mdx/failure-intelligence.tsx
 * Enhanced failure intelligence panel for failure archive entries.
 * Renders: severity, recovery complexity, prevention patterns,
 * related failures, and deployment risk signals.
 */

import Link from 'next/link'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type Severity = 'low' | 'medium' | 'high' | 'critical'
type RecoveryComplexity = 'minutes' | 'hours' | 'days'
type FailureCategory =
  | 'build'
  | 'runtime'
  | 'deployment'
  | 'data'
  | 'performance'
  | 'dependency'
  | 'configuration'
  | 'authentication'

interface RelatedFailure {
  title: string
  href:  string
  relation: 'same-root' | 'same-category' | 'prevention-pair' | 'escalation-risk'
}

interface Props {
  severity:           Severity
  recoveryComplexity: RecoveryComplexity
  category:           FailureCategory
  preventionPatterns: string[]
  relatedFailures?:   RelatedFailure[]
  deploymentRisk?:    'low' | 'medium' | 'high'
  ecosystemImpact?:   string[]
  timeToDetect?:      string   // "immediate" | "3 hours" | "next deploy"
  repeatRisk?:        'low' | 'medium' | 'high'
}

// ─────────────────────────────────────────────────────────────
// Style maps
// ─────────────────────────────────────────────────────────────

const SEV_STYLES: Record<Severity, { dot: string; text: string; bg: string; border: string; label: string }> = {
  low:      { dot: 'bg-blue-400',   text: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   label: 'Low' },
  medium:   { dot: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', label: 'Medium' },
  high:     { dot: 'bg-orange-400', text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', label: 'High' },
  critical: { dot: 'bg-red-500 animate-pulse', text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Critical' },
}

const COMPLEXITY_STYLES: Record<RecoveryComplexity, { text: string; label: string }> = {
  minutes: { text: 'text-green-400',  label: 'Quick fix (minutes)' },
  hours:   { text: 'text-yellow-400', label: 'Complex (hours)' },
  days:    { text: 'text-red-400',    label: 'Major recovery (days)' },
}

const RELATION_LABEL: Record<string, string> = {
  'same-root':       'Same root cause',
  'same-category':   'Same category',
  'prevention-pair': 'Prevention pair',
  'escalation-risk': 'Can escalate to',
}

const RISK_STYLES: Record<string, string> = {
  low:    'text-green-400',
  medium: 'text-yellow-400',
  high:   'text-red-400',
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function FailureIntelligence({
  severity,
  recoveryComplexity,
  category,
  preventionPatterns,
  relatedFailures = [],
  deploymentRisk,
  ecosystemImpact = [],
  timeToDetect,
  repeatRisk,
}: Props) {
  const sev  = SEV_STYLES[severity]
  const comp = COMPLEXITY_STYLES[recoveryComplexity]

  return (
    <div className="my-6 rounded-xl border border-white/[0.08] overflow-hidden">

      {/* Intelligence header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.06] flex-wrap">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-surface-600">
          Failure Intelligence
        </span>
        <span className="flex-1" />
        {/* Severity badge */}
        <span className={cn(
          'inline-flex items-center gap-1.5 text-[10px] font-mono rounded px-2 py-0.5 border',
          sev.text, sev.bg, sev.border
        )}>
          <span className={cn('w-1.5 h-1.5 rounded-full', sev.dot)} />
          {sev.label} severity
        </span>
        {/* Category */}
        <span className="text-[10px] font-mono text-surface-600 bg-surface-800/60 border border-surface-700/40 rounded px-2 py-0.5 capitalize">
          {category}
        </span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/[0.06] border-b border-white/[0.06]">
        <div className="px-4 py-3">
          <p className="text-[10px] font-mono text-surface-700 uppercase tracking-wider mb-1">Recovery</p>
          <p className={cn('text-xs font-mono font-semibold', comp.text)}>{comp.label}</p>
        </div>
        {deploymentRisk && (
          <div className="px-4 py-3">
            <p className="text-[10px] font-mono text-surface-700 uppercase tracking-wider mb-1">Deploy risk</p>
            <p className={cn('text-xs font-mono font-semibold capitalize', RISK_STYLES[deploymentRisk])}>
              {deploymentRisk}
            </p>
          </div>
        )}
        {timeToDetect && (
          <div className="px-4 py-3">
            <p className="text-[10px] font-mono text-surface-700 uppercase tracking-wider mb-1">Detectable</p>
            <p className="text-xs font-mono text-surface-300">{timeToDetect}</p>
          </div>
        )}
        {repeatRisk && (
          <div className="px-4 py-3">
            <p className="text-[10px] font-mono text-surface-700 uppercase tracking-wider mb-1">Repeat risk</p>
            <p className={cn('text-xs font-mono font-semibold capitalize', RISK_STYLES[repeatRisk])}>
              {repeatRisk}
            </p>
          </div>
        )}
      </div>

      {/* Prevention patterns */}
      {preventionPatterns.length > 0 && (
        <div className="px-4 py-4 border-b border-white/[0.06]">
          <p className="text-[10px] font-mono text-surface-700 uppercase tracking-wider mb-2">
            Prevention patterns
          </p>
          <ul className="space-y-1.5">
            {preventionPatterns.map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-green-500 text-[10px] mt-0.5 shrink-0">✓</span>
                <span className="text-xs text-surface-400 leading-snug">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ecosystem impact */}
      {ecosystemImpact.length > 0 && (
        <div className="px-4 py-4 border-b border-white/[0.06]">
          <p className="text-[10px] font-mono text-surface-700 uppercase tracking-wider mb-2">
            Ecosystem impact
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ecosystemImpact.map(impact => (
              <span
                key={impact}
                className="text-[10px] font-mono text-orange-400/80 bg-orange-500/[0.08] border border-orange-500/20 rounded px-2 py-0.5"
              >
                {impact}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Related failures */}
      {relatedFailures.length > 0 && (
        <div className="px-4 py-4">
          <p className="text-[10px] font-mono text-surface-700 uppercase tracking-wider mb-2">
            Related failures
          </p>
          <div className="space-y-2">
            {relatedFailures.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-surface-700 w-28 shrink-0">
                  {RELATION_LABEL[f.relation] ?? f.relation}
                </span>
                <Link
                  href={f.href}
                  className="text-xs text-surface-400 hover:text-red-400 transition-colors truncate"
                >
                  {f.title}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
