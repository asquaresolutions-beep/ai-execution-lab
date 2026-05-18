/**
 * components/operational/debug-context-panel.tsx
 * Server component — renders operational debug context below failure MDX content.
 *
 * Pulls from:
 *   lib/operational-memory.ts  → getDebugContext(), getRelatedEntities(), ENTITIES
 *   lib/failure-memory.ts      → getConfidenceScore(), getFailureMemory()
 *
 * Shows: confidence score, pattern family, related failures, prevention lessons,
 * resolver playbooks, and demonstrating case studies — all from the typed entity graph.
 */
import Link from 'next/link'
import { getDebugContext, getFailuresForPattern, type OperationalEntity } from '@/lib/operational-memory'
import { getConfidenceScore, getFailureMemory, type RecoveryComplexity } from '@/lib/failure-memory'
import { ConfidenceBadge } from './confidence-badge'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const COMPLEXITY_CONFIG: Record<RecoveryComplexity, { label: string; color: string }> = {
  trivial:  { label: 'Trivial',  color: 'text-green-400' },
  low:      { label: 'Low',      color: 'text-green-400' },
  moderate: { label: 'Moderate', color: 'text-yellow-400' },
  high:     { label: 'High',     color: 'text-orange-400' },
  expert:   { label: 'Expert',   color: 'text-red-400' },
}

const STEP_TYPE_LABELS: Record<string, string> = {
  failure:    '↳ Failure',
  lesson:     '→ Lesson',
  'case-study': '▶ Case Study',
  playbook:   '⊕ Playbook',
  doc:        '◎ Doc',
  pattern:    '◈ Pattern',
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function EntityLink({
  entity,
  typeLabel,
}: {
  entity: OperationalEntity
  typeLabel?: string
}) {
  return (
    <Link
      href={entity.href}
      className="group flex items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2.5 hover:border-white/[0.10] hover:bg-white/[0.03] transition-all"
    >
      {typeLabel && (
        <span className="text-[10px] font-mono text-surface-700 shrink-0 w-20">
          {typeLabel}
        </span>
      )}
      <span className="text-sm text-surface-300 group-hover:text-surface-100 transition-colors flex-1 min-w-0 truncate">
        {entity.title}
      </span>
      <span className="text-surface-700 text-xs group-hover:text-surface-400 transition-colors shrink-0">→</span>
    </Link>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-600 mb-2">
      {label}
    </p>
  )
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

interface DebugContextPanelProps {
  slug: string
}

export function DebugContextPanel({ slug }: DebugContextPanelProps) {
  const failureId     = `failure:${slug}`
  const ctx           = getDebugContext(failureId)
  const confidence    = getConfidenceScore(slug)
  const memoryEntries = getFailureMemory()
  const memEntry      = memoryEntries.find(f => f.slug === slug)

  // Nothing useful to show
  if (confidence < 0 && ctx.relatedPatterns.length === 0) return null

  // Related failures in the same patterns
  const relatedFailures: OperationalEntity[] = []
  const seenIds = new Set<string>([failureId])
  for (const pattern of ctx.relatedPatterns) {
    const members = getFailuresForPattern(pattern.id)
    for (const m of members) {
      if (!seenIds.has(m.id)) {
        seenIds.add(m.id)
        relatedFailures.push(m)
      }
    }
  }

  const hasPatterns        = ctx.relatedPatterns.length > 0
  const hasRelatedFailures = relatedFailures.length > 0
  const hasPreventionLinks = ctx.preventionLessons.length > 0
  const hasPlaybooks       = ctx.resolverPlaybooks.length > 0
  const hasCaseStudies     = ctx.demonstratingCases.length > 0
  const complexConfig      = memEntry ? COMPLEXITY_CONFIG[memEntry.recoveryComplexity] : null

  return (
    <div className="mt-12 pt-8 border-t border-white/[0.06]">

      {/* Section label */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-surface-700">
          DEBUGGING INTELLIGENCE
        </span>
        <div className="h-px flex-1 bg-white/[0.04]" />
      </div>

      {/* Top row: confidence + complexity */}
      <div className="flex flex-wrap items-start gap-4 mb-8">
        {confidence >= 0 && (
          <div>
            <p className="text-[10px] font-mono text-surface-700 mb-2 uppercase tracking-wide">Fix Confidence</p>
            <ConfidenceBadge score={confidence} showScore />
          </div>
        )}
        {memEntry && (
          <div>
            <p className="text-[10px] font-mono text-surface-700 mb-2 uppercase tracking-wide">Recovery Complexity</p>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <span className={cn('text-xs font-semibold', complexConfig?.color)}>
                {complexConfig?.label}
              </span>
              {memEntry.instanceCount >= 2 && (
                <span className="ml-2 text-[10px] font-mono text-surface-600">
                  · {memEntry.instanceCount} confirmed instances
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Grid layout for context sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Left column */}
        <div className="space-y-6">

          {/* Pattern family */}
          {hasPatterns && (
            <div>
              <SectionHeader label="Pattern Family" />
              <div className="space-y-1.5">
                {ctx.relatedPatterns.map(p => (
                  <EntityLink key={p.id} entity={p} typeLabel={STEP_TYPE_LABELS.pattern} />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-surface-600 leading-relaxed">
                This failure belongs to a named recurring pattern. Other failures in this family share the same root cause structure — understanding the pattern prevents multiple failure types simultaneously.
              </p>
            </div>
          )}

          {/* Related failures */}
          {hasRelatedFailures && (
            <div>
              <SectionHeader label="Related Failures in Same Pattern" />
              <div className="space-y-1.5">
                {relatedFailures.map(f => (
                  <EntityLink key={f.id} entity={f} typeLabel={STEP_TYPE_LABELS.failure} />
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Prevention lessons */}
          {hasPreventionLinks && (
            <div>
              <SectionHeader label="Prevention Lessons" />
              <div className="space-y-1.5">
                {ctx.preventionLessons.map(l => (
                  <EntityLink key={l.id} entity={l} typeLabel={STEP_TYPE_LABELS.lesson} />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-surface-600 leading-relaxed">
                Completing these lessons would have prevented this failure.
              </p>
            </div>
          )}

          {/* Resolver playbooks */}
          {hasPlaybooks && (
            <div>
              <SectionHeader label="Resolver Playbooks" />
              <div className="space-y-1.5">
                {ctx.resolverPlaybooks.map(p => (
                  <EntityLink key={p.id} entity={p} typeLabel={STEP_TYPE_LABELS.playbook} />
                ))}
              </div>
            </div>
          )}

          {/* Demonstrating case studies */}
          {hasCaseStudies && (
            <div>
              <SectionHeader label="Demonstrated In" />
              <div className="space-y-1.5">
                {ctx.demonstratingCases.map(c => (
                  <EntityLink key={c.id} entity={c} typeLabel={STEP_TYPE_LABELS['case-study']} />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-surface-600 leading-relaxed">
                This failure occurred in a real production context. These case studies show the full arc from incident to resolution.
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Pattern library link */}
      {hasPatterns && (
        <div className="mt-6 pt-5 border-t border-white/[0.04]">
          <Link
            href="/docs/failure-pattern-library"
            className="inline-flex items-center gap-2 text-xs text-surface-600 hover:text-brand-400 transition-colors"
          >
            View all failure patterns →
          </Link>
        </div>
      )}
    </div>
  )
}
