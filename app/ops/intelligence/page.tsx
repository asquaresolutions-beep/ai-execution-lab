import Link from 'next/link'
import type { Metadata } from 'next'
import {
  getPlatformMaturityScore,
  type DimensionScore,
  type OperationalGuidance,
  type GuidanceCategory,
} from '@/lib/platform-intelligence'
import {
  getContentRecommendations,
  getContentIntelligenceSummary,
  type ContentRecommendation,
  type ContentAction,
  type PublishWindow,
} from '@/lib/content-intelligence'
import { getSignalSummary } from '@/lib/operational-signals'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Operational Intelligence — AI Execution Lab',
  description: 'Platform maturity score, autonomous publishing guidance, and self-improving content intelligence.',
  robots: { index: false, follow: false },
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const WINDOW_STYLES: Record<PublishWindow, { badge: string; label: string }> = {
  immediate:    { badge: 'text-red-400 bg-red-500/10 border-red-500/25',        label: 'Immediate' },
  'this-week':  { badge: 'text-orange-400 bg-orange-500/10 border-orange-500/25', label: 'This Week' },
  'this-month': { badge: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25', label: 'This Month' },
  backlog:      { badge: 'text-surface-500 bg-white/[0.03] border-white/[0.08]', label: 'Backlog' },
}

const ACTION_ICONS: Record<ContentAction, string> = {
  'create-new':          '✦',
  'add-evidence':        '◈',
  'add-depth':           '◉',
  'add-internal-links':  '◎',
  'update-stale':        '↺',
  'add-case-study':      '◆',
  'add-playbook':        '▸',
  'add-geo-content':     '◐',
  'add-specificity':     '◑',
}

const ACTION_LABELS: Record<ContentAction, string> = {
  'create-new':          'Create New',
  'add-evidence':        'Add Evidence',
  'add-depth':           'Add Depth',
  'add-internal-links':  'Add Links',
  'update-stale':        'Update',
  'add-case-study':      'Case Study',
  'add-playbook':        'Playbook',
  'add-geo-content':     'GEO Content',
  'add-specificity':     'Specificity',
}

const GUIDANCE_CATEGORY_STYLES: Record<GuidanceCategory, { color: string; label: string }> = {
  deploy:    { color: 'text-brand-400',   label: 'Deploy'    },
  debug:     { color: 'text-red-400',     label: 'Debug'     },
  content:   { color: 'text-green-400',   label: 'Content'   },
  geo:       { color: 'text-blue-400',    label: 'GEO'       },
  telemetry: { color: 'text-purple-400',  label: 'Telemetry' },
  knowledge: { color: 'text-orange-400',  label: 'Knowledge' },
}

const URGENCY_STYLES = {
  'now':        'text-red-400 bg-red-500/10 border-red-500/25',
  'this-week':  'text-orange-400 bg-orange-500/10 border-orange-500/25',
  'this-month': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25',
} as const

const IMPACT_COLOR = { low: 'text-surface-600', medium: 'text-yellow-500', high: 'text-green-400' } as const
const EFFORT_COLOR = { low: 'text-green-400', medium: 'text-yellow-400', high: 'text-red-400' } as const

const STATUS_DOT: Record<DimensionScore['status'], string> = {
  strong:   'bg-green-500',
  adequate: 'bg-yellow-400',
  weak:     'bg-red-500 animate-pulse',
}

// ─────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────

function DimensionBar({ dim }: { dim: DimensionScore }) {
  const barColor =
    dim.score >= 70 ? 'bg-green-500'  :
    dim.score >= 45 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-2 h-2 rounded-full shrink-0', STATUS_DOT[dim.status])} />
        <span className="text-[11px] font-semibold text-surface-300 flex-1">{dim.name}</span>
        <span className="text-[11px] font-mono text-surface-400 font-bold">{dim.score}</span>
        <span className="text-[10px] font-mono text-surface-700">/100</span>
      </div>
      <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden mb-2">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${dim.score}%` }}
        />
      </div>
      <p className="text-[10px] text-surface-500 leading-relaxed mb-1">{dim.insight}</p>
      <p className="text-[10px] text-surface-700 leading-relaxed">
        <span className="text-surface-800">Gap: </span>{dim.topGap}
      </p>
    </div>
  )
}

function GuidanceCard({ g }: { g: OperationalGuidance }) {
  const cat = GUIDANCE_CATEGORY_STYLES[g.category]
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
      <div className="flex items-start gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn('text-[9px] font-mono font-bold uppercase', cat.color)}>
              [{cat.label}]
            </span>
            <h3 className="text-[12px] font-semibold text-surface-200 leading-snug">
              {g.title}
            </h3>
          </div>
          <p className="text-[11px] text-surface-500 leading-relaxed mb-2">{g.why}</p>
          <div className="rounded-lg bg-surface-900/50 border border-white/[0.04] px-3 py-2">
            <p className="text-[9px] font-mono text-surface-700 uppercase tracking-wide mb-1">Action</p>
            <p className="text-[11px] text-surface-400 leading-relaxed font-mono">{g.action}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap mt-2">
        <span className={cn('text-[9px] font-mono font-bold uppercase rounded px-1.5 py-0.5 border', URGENCY_STYLES[g.urgency])}>
          {g.urgency.replace('-', ' ')}
        </span>
        <span className={cn('text-[10px] font-mono', EFFORT_COLOR[g.effort])}>
          {g.effort} effort
        </span>
        <span className="text-[10px] font-mono text-surface-700 ml-auto">→ {g.dimension}</span>
      </div>
    </div>
  )
}

function RecommendationCard({ rec }: { rec: ContentRecommendation }) {
  const ws = WINDOW_STYLES[rec.window]
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
      <div className="flex items-start gap-3 mb-2">
        <span className="text-base shrink-0 mt-0.5 text-surface-600" title={ACTION_LABELS[rec.action]}>
          {ACTION_ICONS[rec.action]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap mb-1">
            <h3 className="text-[12px] font-semibold text-surface-200 leading-snug flex-1">
              {rec.title}
            </h3>
            <span className={cn('text-[9px] font-mono font-bold uppercase rounded px-1.5 py-0.5 border shrink-0', ws.badge)}>
              {ws.label}
            </span>
          </div>
          <p className="text-[11px] text-surface-500 leading-relaxed mb-2">{rec.rationale}</p>
          <div className="rounded-lg bg-surface-900/50 border border-white/[0.04] px-3 py-2">
            <p className="text-[9px] font-mono text-surface-700 uppercase tracking-wide mb-1">Deliverable</p>
            <p className="text-[11px] text-surface-400 leading-relaxed">{rec.deliverable}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap mt-2">
        <span className="text-[9px] font-mono uppercase text-surface-600 bg-white/[0.03] border border-white/[0.06] rounded px-1.5 py-0.5">
          {ACTION_LABELS[rec.action]}
        </span>
        <span className={cn('text-[10px] font-mono', IMPACT_COLOR[rec.impact])}>
          {rec.impact} impact
        </span>
        <span className={cn('text-[10px] font-mono', EFFORT_COLOR[rec.effort])}>
          {rec.effort} effort
        </span>
        <span className="text-[10px] font-mono text-surface-800 ml-auto">score {rec.score}</span>
      </div>
      {rec.relatedSection && (
        <div className="mt-2">
          <Link
            href={rec.relatedSlug ? `/${rec.relatedSection}/${rec.relatedSlug}` : `/${rec.relatedSection}`}
            className="text-[10px] font-mono text-surface-700 hover:text-brand-400 transition-colors"
          >
            View /{rec.relatedSection}{rec.relatedSlug ? `/${rec.relatedSlug}` : ''} →
          </Link>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  const maturity      = getPlatformMaturityScore()
  const allRecs       = getContentRecommendations()
  const contentSummary = getContentIntelligenceSummary()
  const signalSummary = getSignalSummary()

  // Split recommendations by window
  const immediate  = allRecs.filter(r => r.window === 'immediate')
  const thisWeek   = allRecs.filter(r => r.window === 'this-week')
  const thisMonth  = allRecs.filter(r => r.window === 'this-month').slice(0, 5)

  // Maturity score ring color
  const scoreColor =
    maturity.overall >= 70 ? 'text-green-400' :
    maturity.overall >= 45 ? 'text-yellow-400' :
    maturity.overall >= 25 ? 'text-orange-400' : 'text-red-400'

  return (
    <div className="px-6 lg:px-8 py-8 max-w-4xl">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest rounded px-2 py-1 border text-surface-500 bg-surface-800/60 border-surface-700/40">
            INTELLIGENCE
          </span>
          <Link href="/ops" className="text-[10px] font-mono text-surface-700 hover:text-brand-400 transition-colors">
            ← Ops
          </Link>
          {signalSummary.critical > 0 && (
            <span className="text-[10px] font-mono text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-0.5">
              {signalSummary.critical} critical signal{signalSummary.critical > 1 ? 's' : ''}
            </span>
          )}
          {contentSummary.immediateCount > 0 && (
            <span className="text-[10px] font-mono text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded px-2 py-0.5">
              {contentSummary.immediateCount} immediate action{contentSummary.immediateCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-50">
          Operational Intelligence
        </h1>
        <p className="mt-2 text-sm text-surface-400 leading-relaxed max-w-2xl">
          Platform maturity score, autonomous publishing guidance, and self-improving content intelligence.
          The platform analyses its own corpus to surface what to build, fix, and prioritise.
        </p>
      </div>

      {/* ── Maturity score strip ── */}
      <div className="mb-8 rounded-xl border border-white/[0.06] bg-white/[0.01] p-5">
        <div className="flex items-start gap-6 flex-wrap">
          {/* Score */}
          <div className="text-center shrink-0">
            <p className={cn('text-5xl font-bold font-mono tracking-tight', scoreColor)}>
              {maturity.overall}
            </p>
            <p className="text-[10px] font-mono text-surface-600 mt-1 uppercase tracking-wide">/ 100</p>
          </div>
          {/* Tier + milestone */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('text-lg font-bold tracking-tight', maturity.tierColor)}>
                {maturity.tierLabel}
              </span>
              <span className="text-[10px] font-mono text-surface-700 bg-white/[0.03] border border-white/[0.06] rounded px-2 py-0.5">
                {maturity.tier}
              </span>
            </div>
            <p className="text-[11px] text-surface-500 leading-relaxed mb-3">
              {maturity.nextMilestone}
            </p>
            <div className="flex items-center gap-4 flex-wrap text-[10px] font-mono">
              <span className="text-surface-600">
                {maturity.signals.total} open signals
              </span>
              {maturity.signals.critical > 0 && (
                <span className="text-red-400">{maturity.signals.critical} critical</span>
              )}
              {maturity.signals.high > 0 && (
                <span className="text-orange-400">{maturity.signals.high} high</span>
              )}
              <Link href="/ops/signals" className="text-surface-700 hover:text-brand-400 transition-colors">
                view signals →
              </Link>
            </div>
          </div>
          {/* Recommendation counts */}
          <div className="grid grid-cols-3 gap-3 shrink-0">
            {([
              { label: 'Immediate', value: contentSummary.immediateCount, color: 'text-red-400' },
              { label: 'This Week', value: contentSummary.thisWeekCount,  color: 'text-orange-400' },
              { label: 'Total Recs', value: contentSummary.totalRecommendations, color: 'text-surface-400' },
            ] as const).map(({ label, value, color }) => (
              <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-center">
                <p className={cn('text-xl font-bold font-mono', color)}>{value}</p>
                <p className="text-[9px] font-mono text-surface-700 mt-0.5 uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Maturity dimensions ── */}
      <div className="mb-10">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-4">
          Maturity Dimensions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {maturity.dimensions.map(dim => (
            <DimensionBar key={dim.name} dim={dim} />
          ))}
        </div>
      </div>

      {/* ── Top guidance (operational recovery paths) ── */}
      {maturity.topActions.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600">
              Operational Guidance
            </h2>
            <span className="text-[10px] font-mono text-surface-700">
              {maturity.topActions.length} action{maturity.topActions.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-3">
            {maturity.topActions.map(g => (
              <GuidanceCard key={g.id} g={g} />
            ))}
          </div>
        </div>
      )}

      {/* ── Publishing queue: immediate ── */}
      {immediate.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600">
              Immediate Publishing Queue
            </h2>
            <span className="text-[10px] font-mono text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-0.5">
              {immediate.length} item{immediate.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-3">
            {immediate.map(rec => (
              <RecommendationCard key={rec.id} rec={rec} />
            ))}
          </div>
        </div>
      )}

      {/* ── Publishing queue: this week ── */}
      {thisWeek.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600">
              This Week
            </h2>
            <span className="text-[10px] font-mono text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded px-2 py-0.5">
              {thisWeek.length} item{thisWeek.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-3">
            {thisWeek.slice(0, 6).map(rec => (
              <RecommendationCard key={rec.id} rec={rec} />
            ))}
            {thisWeek.length > 6 && (
              <p className="text-[10px] font-mono text-surface-700 text-center py-2">
                + {thisWeek.length - 6} more this-week items
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Publishing queue: this month ── */}
      {thisMonth.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600">
              This Month
            </h2>
          </div>
          <div className="space-y-3">
            {thisMonth.map(rec => (
              <RecommendationCard key={rec.id} rec={rec} />
            ))}
          </div>
        </div>
      )}

      {/* ── System connections ── */}
      <div className="mb-10">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-4">
          Intelligence Sources
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              label:   'Operational Signals',
              desc:    `${signalSummary.total} active signals across 18 detection types`,
              href:    '/ops/signals',
              badge:   signalSummary.high > 0 ? `${signalSummary.high} high priority` : null,
              badgeColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
            },
            {
              label:   'GEO Intelligence',
              desc:    'Query taxonomy, entity graph, answerability scoring',
              href:    '/ops/geo',
              badge:   null,
              badgeColor: '',
            },
            {
              label:   'Telemetry Dashboard',
              desc:    'Deployment health, uptime, search, sitemap, performance',
              href:    '/ops/telemetry',
              badge:   null,
              badgeColor: '',
            },
            {
              label:   'Failure Archive',
              desc:    'Confidence scoring, pattern coverage, debug paths',
              href:    '/failures',
              badge:   null,
              badgeColor: '',
            },
          ].map(({ label, desc, href, badge, badgeColor }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.025] hover:border-white/[0.10] transition-all p-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[11px] font-semibold text-surface-300 group-hover:text-surface-100 transition-colors">
                  {label}
                </p>
                {badge && (
                  <span className={cn('text-[9px] font-mono rounded px-1.5 py-0.5 border', badgeColor)}>
                    {badge}
                  </span>
                )}
                <span className="ml-auto text-[10px] font-mono text-surface-700 group-hover:text-brand-400 transition-colors">→</span>
              </div>
              <p className="text-[10px] text-surface-600 leading-relaxed">{desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Platform philosophy ── */}
      <div className="pt-8 border-t border-white/[0.05]">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-3">
          Platform Direction
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[9px] font-mono uppercase tracking-widest text-green-600 mb-2">Maintain</p>
            <ul className="space-y-1">
              {[
                'Execution-first philosophy',
                'Operational realism',
                'Evidence-backed publishing',
                'Infrastructure discipline',
                'Ecosystem coherence',
                'Retrieval quality',
                'Implementation density',
              ].map(item => (
                <li key={item} className="text-[10px] text-surface-600 font-mono">+ {item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[9px] font-mono uppercase tracking-widest text-red-700 mb-2">Avoid</p>
            <ul className="space-y-1">
              {[
                'Fake engagement mechanics',
                'Shallow AI content',
                'Generic tutorials',
                'Unnecessary social systems',
                'Gimmick dashboards',
                'Productivity-theater features',
              ].map(item => (
                <li key={item} className="text-[10px] text-surface-600 font-mono">− {item}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-4 text-[11px] text-surface-700 leading-relaxed">
          The moat is accumulated operational intelligence — telemetry, evidence, failure memory, and institutional memory
          generated through continuous real-world execution across the A Square Solutions ecosystem.
          Intelligence computed by{' '}
          <code className="text-[10px] text-surface-600">lib/platform-intelligence.ts</code>{' '}
          and{' '}
          <code className="text-[10px] text-surface-600">lib/content-intelligence.ts</code>.
        </p>
      </div>

    </div>
  )
}
