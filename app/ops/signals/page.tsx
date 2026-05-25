import Link from 'next/link'
import type { Metadata } from 'next'
import {
  getOperationalSignals,
  getSignalSummary,
  type OperationalSignal,
  type SignalType,
  type SignalPriority,
} from '@/lib/operational-signals'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Operational Signals — AI Execution Lab',
  description: 'Automatically detected gaps, risks, and blind spots in operational intelligence coverage.',
  robots: { index: false, follow: false },
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<SignalPriority, { badge: string; dot: string; label: string }> = {
  critical: {
    badge: 'text-red-400 bg-red-500/10 border-red-500/25',
    dot:   'bg-red-500 animate-pulse',
    label: 'Critical',
  },
  high: {
    badge: 'text-orange-400 bg-orange-500/10 border-orange-500/25',
    dot:   'bg-orange-400',
    label: 'High',
  },
  medium: {
    badge: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25',
    dot:   'bg-yellow-400',
    label: 'Medium',
  },
  low: {
    badge: 'text-surface-500 bg-white/[0.03] border-white/[0.08]',
    dot:   'bg-surface-600',
    label: 'Low',
  },
}

const TYPE_LABELS: Record<SignalType, string> = {
  unscored_failure:      'Unscored Failures',
  low_confidence_fix:    'Low Confidence Fixes',
  pattern_gap:           'Pattern Coverage Gaps',
  missing_playbook:      'Missing Playbooks',
  stale_section:         'Stale Sections',
  single_instance:       'Single-Instance High Severity',
  weak_evidence:         'Weak Evidence Coverage',
  missing_case_study:    'Missing Case Studies',
  entity_inconsistency:  'Entity Naming Inconsistencies',
  unhealthy_cadence:     'Unhealthy Publishing Cadence',
  missing_geo_coverage:  'Missing GEO Coverage',
  no_failure_coverage:   'Systems Without Failure Coverage',
  // Phase 1 — Autonomous Signal Engine
  stale_assumption:      'Stale Operational Assumptions',
  underdeveloped_track:  'Underdeveloped Topic Clusters',
  publishing_imbalance:  'Publishing Portfolio Imbalance',
  operational_blind_spot: 'Operational Blind Spots',
  weak_geo_cluster:      'Weak GEO Query Clusters',
  low_link_density:      'Low Internal Link Density',
}

const TYPE_DESCRIPTIONS: Record<SignalType, string> = {
  unscored_failure:      'Failure reports without confidence scoring. Prevents debugging intelligence from loading.',
  low_confidence_fix:    'Failures with confidence below 60/100. Single instance or undocumented recovery path.',
  pattern_gap:           'Named failure patterns with ≥2 member failures but no resolver playbook.',
  missing_playbook:      'Recurring failures without documented resolution procedures.',
  stale_section:         'Content sections that have not been updated past their cadence threshold.',
  single_instance:       'High-severity failures with only one confirmed instance — fix reliability unverified.',
  weak_evidence:         'Content entries without evidence images or external citations. Reduces GEO citation credibility.',
  missing_case_study:    'Execution tracks with no end-to-end case study. Case studies are the highest-value GEO content type.',
  entity_inconsistency:  'Entity names in content diverge from canonical platform entity definitions.',
  unhealthy_cadence:     'Publishing velocity has dropped below minimum viable threshold across multiple sections simultaneously.',
  missing_geo_coverage:  'Core platform entities with no GEO-optimised definitional or procedural content.',
  no_failure_coverage:   'Documented systems or deployments with no linked failure archive entry.',
  // Phase 1 — Autonomous Signal Engine
  stale_assumption:      'Docs with no updated: timestamp and age > 60 days. Operational procedures may no longer reflect current platform state.',
  underdeveloped_track:  'Topic clusters with < 3 content items. Thin areas lack the depth needed for GEO citation and query coverage.',
  publishing_imbalance:  'One content section has 5× more items than the lowest populated section. Portfolio imbalance limits cross-query coverage.',
  operational_blind_spot: 'Active ecosystem properties with no docs or failure coverage. Live systems without documentation are the highest operational risk.',
  weak_geo_cluster:      'GEO query category where zero queries have a mapped content target. Entire intent category is invisible to AI retrieval.',
  low_link_density:      'High-severity failures with no related lessons or resolver playbooks. Isolated failures reduce knowledge-graph value and debugging discoverability.',
}

const TYPE_ORDER: SignalType[] = [
  // Critical operational gaps (block intelligence systems)
  'unscored_failure',
  'low_confidence_fix',
  'operational_blind_spot',
  // Pattern + playbook gaps
  'pattern_gap',
  'missing_playbook',
  // Cadence + staleness
  'unhealthy_cadence',
  'stale_section',
  'stale_assumption',
  // Content quality
  'single_instance',
  'weak_evidence',
  'low_link_density',
  // Publishing health
  'publishing_imbalance',
  'underdeveloped_track',
  // GEO coverage
  'missing_geo_coverage',
  'weak_geo_cluster',
  'missing_case_study',
  // Entity + consistency
  'entity_inconsistency',
  'no_failure_coverage',
]

const TEMPLATE_LINKS: Record<string, string> = {
  'failure-report':     '/publish#failure-report',
  'execution-log':      '/publish#execution-log',
  'deployment-journal': '/publish#deployment-journal',
  'ai-workflow':        '/publish#ai-workflow',
  'seo-experiment':     '/publish#seo-experiment',
  'case-study':         '/publish#case-study',
}

// ─────────────────────────────────────────────────────────────
// Signal card
// ─────────────────────────────────────────────────────────────

function SignalCard({ signal }: { signal: OperationalSignal }) {
  const pst = PRIORITY_STYLES[signal.priority]

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={cn('w-2 h-2 rounded-full shrink-0 mt-1.5', pst.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap mb-1">
            <h3 className="text-sm font-medium text-surface-200 leading-snug flex-1 min-w-0">
              {signal.title}
            </h3>
            <span className={cn('text-[9px] font-mono font-bold uppercase rounded px-2 py-0.5 border shrink-0', pst.badge)}>
              {pst.label}
            </span>
          </div>
          <p className="text-[11px] text-surface-500 leading-relaxed">
            {signal.description}
          </p>
        </div>
      </div>

      {/* Action hint */}
      <div className="ml-5 rounded-lg bg-surface-900/50 border border-white/[0.04] px-3 py-2 mb-3">
        <p className="text-[10px] font-mono text-surface-700 uppercase tracking-wide mb-1">Action</p>
        <p className="text-[11px] text-surface-400 leading-relaxed">{signal.actionableHint}</p>
      </div>

      {/* Footer links */}
      <div className="ml-5 flex items-center gap-4 flex-wrap">
        {signal.relatedHref && (
          <Link
            href={signal.relatedHref}
            className="text-[10px] font-mono text-surface-600 hover:text-surface-300 transition-colors"
          >
            View {signal.relatedSection ?? 'content'} →
          </Link>
        )}
        {signal.relatedSection && !signal.relatedHref && (
          <Link
            href={`/${signal.relatedSection}`}
            className="text-[10px] font-mono text-surface-600 hover:text-surface-300 transition-colors"
          >
            View /{signal.relatedSection} →
          </Link>
        )}
        {signal.template && TEMPLATE_LINKS[signal.template] && (
          <Link
            href={TEMPLATE_LINKS[signal.template]}
            className="text-[10px] font-mono text-brand-400/70 hover:text-brand-300 transition-colors"
          >
            Template: {signal.template} →
          </Link>
        )}
        <span className="text-[10px] font-mono text-surface-800 ml-auto">
          detected {signal.detectedAt}
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function SignalsPage() {
  const signals = getOperationalSignals()
  const summary = getSignalSummary()

  // Group by type
  const byType: Partial<Record<SignalType, OperationalSignal[]>> = {}
  for (const signal of signals) {
    if (!byType[signal.type]) byType[signal.type] = []
    byType[signal.type]!.push(signal)
  }

  const activeTypes = TYPE_ORDER.filter(t => (byType[t]?.length ?? 0) > 0)

  return (
    <div className="px-6 lg:px-8 py-8 max-w-4xl">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest rounded px-2 py-1 border text-surface-500 bg-surface-800/60 border-surface-700/40">
            SIGNALS
          </span>
          <Link href="/ops" className="text-[10px] font-mono text-surface-700 hover:text-brand-400 transition-colors">
            ← Ops
          </Link>
          {summary.high > 0 && (
            <span className="text-[10px] font-mono text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded px-2 py-0.5">
              {summary.high} high priority
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-50">
          Operational Signals
        </h1>
        <p className="mt-2 text-sm text-surface-400 leading-relaxed max-w-2xl">
          Automatically detected gaps, risks, and blind spots in operational intelligence coverage.
          These signals surface what needs attention — unscored failures, missing playbooks, low-confidence fixes, stale sections.
        </p>
      </div>

      {/* Priority summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {([
          { label: 'Total Signals', value: summary.total,    color: 'text-surface-300' },
          { label: 'High Priority', value: summary.high,     color: summary.high > 0 ? 'text-orange-400' : 'text-green-400' },
          { label: 'Medium',        value: summary.medium,   color: 'text-yellow-400' },
          { label: 'Low',           value: summary.low,      color: 'text-surface-500' },
        ] as const).map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-center">
            <p className={cn('text-2xl font-bold font-mono', color)}>{value}</p>
            <p className="text-[10px] font-mono text-surface-600 mt-1 uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {/* Signal groups */}
      {signals.length === 0 ? (
        <div className="rounded-xl border border-white/[0.05] border-dashed p-12 text-center">
          <p className="text-surface-400 text-sm font-medium mb-2">No signals detected</p>
          <p className="text-surface-700 text-xs">
            All failures are scored, patterns have resolver playbooks, sections are active. Keep shipping.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {activeTypes.map(type => {
            const typeSignals = byType[type] ?? []
            return (
              <div key={type}>
                {/* Section header */}
                <div className="flex items-center gap-3 mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-surface-300">
                      {TYPE_LABELS[type]}
                      <span className="ml-2 text-[11px] font-mono text-surface-600">
                        ({typeSignals.length})
                      </span>
                    </h2>
                    <p className="text-[11px] text-surface-600 mt-0.5">
                      {TYPE_DESCRIPTIONS[type]}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {typeSignals.map(signal => (
                    <SignalCard key={signal.id} signal={signal} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer: how signals work */}
      <div className="mt-12 pt-8 border-t border-white/[0.05]">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-4">
          How Signals Are Detected
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TYPE_ORDER.map(type => (
            <div key={type} className="rounded-lg border border-white/[0.04] px-4 py-3">
              <p className="text-[11px] font-mono font-semibold text-surface-400 mb-1">
                {TYPE_LABELS[type]}
              </p>
              <p className="text-[11px] text-surface-600 leading-relaxed">
                {TYPE_DESCRIPTIONS[type]}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-surface-700 leading-relaxed">
          Signals are computed at build time from{' '}
          <code className="text-[10px] text-surface-600">lib/operational-signals.ts</code>.
          Resolving a signal requires updating the relevant source:{' '}
          <code className="text-[10px] text-surface-600">lib/failure-memory.ts</code>,{' '}
          <code className="text-[10px] text-surface-600">lib/operational-memory.ts</code>,
          or publishing new content.
        </p>
      </div>
    </div>
  )
}
