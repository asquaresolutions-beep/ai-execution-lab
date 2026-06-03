import Link from 'next/link'
import type { Metadata } from 'next'
import {
  GEO_QUERY_TAXONOMY,
  PLATFORM_ENTITIES,
  getQueryCoverage,
  type GEOQuery,
  type QueryCategory,
} from '@/lib/geo-intelligence'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'GEO Intelligence — AI Execution Lab',
  description: 'Generative Engine Optimization coverage — query taxonomy, entity graph, answerability scoring, and citation readiness.',
  robots: { index: false, follow: false },
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const CATEGORY_META: Record<QueryCategory, { label: string; description: string; color: string; bg: string }> = {
  definitional: {
    label: 'Definitional',
    description: '"What is X?" — identity queries AI answers first',
    color: 'text-blue-400',
    bg:    'bg-blue-500/10 border-blue-500/20',
  },
  procedural: {
    label: 'Procedural',
    description: '"How do I X?" — step-by-step tasks',
    color: 'text-green-400',
    bg:    'bg-green-500/10 border-green-500/20',
  },
  diagnostic: {
    label: 'Diagnostic',
    description: '"Why is X failing?" — error & debug queries',
    color: 'text-red-400',
    bg:    'bg-red-500/10 border-red-500/20',
  },
  operational: {
    label: 'Operational',
    description: '"How do I operate X in production?" — platform ops',
    color: 'text-orange-400',
    bg:    'bg-orange-500/10 border-orange-500/20',
  },
  comparative: {
    label: 'Comparative',
    description: '"X vs Y" — decision-support queries',
    color: 'text-purple-400',
    bg:    'bg-purple-500/10 border-purple-500/20',
  },
}

const DIFFICULTY_STYLES: Record<GEOQuery['difficulty'], { badge: string; label: string }> = {
  owned:       { badge: 'text-green-400 bg-green-500/10 border-green-500/20',    label: 'Owned' },
  competitive: { badge: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', label: 'Competitive' },
  gap:         { badge: 'text-red-400 bg-red-500/10 border-red-500/20',          label: 'Gap' },
}

const CATEGORY_ORDER: QueryCategory[] = [
  'definitional', 'procedural', 'diagnostic', 'operational', 'comparative',
]

// Answerability dimension definitions (mirrors geo-intelligence.ts logic)
const ANSWERABILITY_DIMENSIONS = [
  {
    name:      'Direct Answer',
    max:       2.5,
    threshold: 2.5,
    signal:    'Content leads with a clear "X is…" or "X means…" statement near the top heading',
    positive:  ['Starts with definition', 'Section heading answers the query directly'],
    negative:  ['Buries answer in paragraph 5', 'No definitional opening'],
  },
  {
    name:      'Specificity',
    max:       2.5,
    threshold: 2.5,
    signal:    'Contains version numbers, exact measurements, file paths, or real command output',
    positive:  ['v14.2.0', '`npm run build`', '2 minutes 34 seconds', 'Error: ENOENT'],
    negative:  ['General instructions only', 'No concrete values'],
  },
  {
    name:      'Actionability',
    max:       2.5,
    threshold: 2.5,
    signal:    'Includes numbered steps, code blocks ≥20 chars, or imperative run/add/set directives',
    positive:  ['1. Run the command', '```bash\\nnpm install...```', 'Step 2: Configure'],
    negative:  ['Prose only', 'No commands or code'],
  },
  {
    name:      'Evidence',
    max:       2.5,
    threshold: 2.5,
    signal:    'References commit refs, timing data, actual error messages, or evidence file paths',
    positive:  ['commitRef=abc123', 'Deploy took 4 minutes', '/evidence/screenshot.png'],
    negative:  ['No referenced outcomes', 'No proof of execution'],
  },
]

// ─────────────────────────────────────────────────────────────
// Query row component
// ─────────────────────────────────────────────────────────────

function QueryRow({ query }: { query: GEOQuery }) {
  const diff = DIFFICULTY_STYLES[query.difficulty]
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-surface-200 font-medium leading-snug mb-0.5">
          {query.query}
        </p>
        <p className="text-[10px] text-surface-600 leading-relaxed">
          {query.intent}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        <span className={cn('text-[9px] font-mono font-bold uppercase rounded px-1.5 py-0.5 border', diff.badge)}>
          {diff.label}
        </span>
        {query.targetSlug ? (
          <Link
            href={`/failures/${query.targetSlug}`}
            className="text-[9px] font-mono text-surface-700 hover:text-brand-400 transition-colors"
          >
            /{query.targetSlug.slice(0, 20)}{query.targetSlug.length > 20 ? '…' : ''}
          </Link>
        ) : (
          <span className="text-[9px] font-mono text-surface-800">no target</span>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Entity chip
// ─────────────────────────────────────────────────────────────

function EntityChip({ label }: { label: string }) {
  return (
    <span className="inline-block text-[10px] font-mono text-surface-400 bg-white/[0.03] border border-white/[0.06] rounded px-2 py-0.5">
      {label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// Answerability dimension card
// ─────────────────────────────────────────────────────────────

function DimensionCard({ dim }: { dim: typeof ANSWERABILITY_DIMENSIONS[number] }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[12px] font-semibold text-surface-200">{dim.name}</h3>
        <span className="text-[10px] font-mono text-surface-500">max {dim.max}</span>
      </div>
      <p className="text-[11px] text-surface-500 mb-3 leading-relaxed">{dim.signal}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-wide text-green-600 mb-1">Positive signals</p>
          <ul className="space-y-0.5">
            {dim.positive.map(s => (
              <li key={s} className="text-[10px] text-surface-600 font-mono">+ {s}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[9px] font-mono uppercase tracking-wide text-red-700 mb-1">Negative signals</p>
          <ul className="space-y-0.5">
            {dim.negative.map(s => (
              <li key={s} className="text-[10px] text-surface-600 font-mono">− {s}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function GEOPage() {
  const coverage  = getQueryCoverage()

  // Group taxonomy by category
  const byCategory: Partial<Record<QueryCategory, GEOQuery[]>> = {}
  for (const q of GEO_QUERY_TAXONOMY) {
    if (!byCategory[q.category]) byCategory[q.category] = []
    byCategory[q.category]!.push(q)
  }

  // Entity buckets (first 4 are products, next group are technologies, rest are concepts/ops)
  const entityBuckets = [
    { label: 'Products',    entities: PLATFORM_ENTITIES.slice(0, 4) },
    { label: 'Technologies', entities: PLATFORM_ENTITIES.slice(4, 22) },
    { label: 'Concepts',    entities: PLATFORM_ENTITIES.slice(22, 32) },
    { label: 'Operational', entities: PLATFORM_ENTITIES.slice(32) },
  ]

  // Coverage bar width
  const covPct = coverage.coveragePct

  return (
    <div className="px-6 lg:px-8 py-8 max-w-4xl">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest rounded px-2 py-1 border text-surface-500 bg-surface-800/60 border-surface-700/40">
            GEO
          </span>
          <Link href="/ops" className="text-[10px] font-mono text-surface-700 hover:text-brand-400 transition-colors">
            ← Ops
          </Link>
          <span className="text-[10px] font-mono text-surface-700">
            {GEO_QUERY_TAXONOMY.length} tracked queries · {PLATFORM_ENTITIES.length} entities
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-50">
          GEO Intelligence
        </h1>
        <p className="mt-2 text-sm text-surface-400 leading-relaxed max-w-2xl">
          Generative Engine Optimization coverage map. Tracks how well platform content answers
          the queries AI systems surface for this domain — from definitional to operational.
        </p>
      </div>

      {/* Coverage summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {([
          { label: 'Owned',       value: coverage.owned.length,       color: 'text-green-400' },
          { label: 'Competitive', value: coverage.competitive.length,  color: 'text-yellow-400' },
          { label: 'Gaps',        value: coverage.gaps.length,         color: 'text-red-400' },
          { label: 'Coverage',    value: `${covPct}%`,                 color: covPct >= 60 ? 'text-green-400' : covPct >= 40 ? 'text-yellow-400' : 'text-red-400' },
        ] as const).map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-center">
            <p className={cn('text-2xl font-bold font-mono', color)}>{value}</p>
            <p className="text-[10px] font-mono text-surface-600 mt-1 uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {/* Coverage progress bar */}
      <div className="mb-8 rounded-lg border border-white/[0.06] bg-white/[0.01] px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Query coverage</span>
          <span className={cn('text-[10px] font-mono font-bold',
            covPct >= 60 ? 'text-green-400' : covPct >= 40 ? 'text-yellow-400' : 'text-red-400'
          )}>{covPct}%</span>
        </div>
        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all',
              covPct >= 60 ? 'bg-green-500' : covPct >= 40 ? 'bg-yellow-500' : 'bg-red-500'
            )}
            style={{ width: `${covPct}%` }}
          />
        </div>
        <p className="mt-2 text-[10px] text-surface-700 leading-relaxed">
          {coverage.owned.filter(q => q.targetSlug).length} owned + {coverage.competitive.filter(q => q.targetSlug).length} competitive queries have mapped content.
          {' '}{coverage.gaps.length} gap queries have no coverage and represent the highest-priority publishing targets.
        </p>
      </div>

      {/* Query taxonomy by category */}
      <div className="mb-10">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-4">
          Query Taxonomy
        </h2>
        <div className="space-y-6">
          {CATEGORY_ORDER.map(cat => {
            const queries = byCategory[cat] ?? []
            if (queries.length === 0) return null
            const meta = CATEGORY_META[cat]
            return (
              <div key={cat}>
                <div className="flex items-center gap-3 mb-3">
                  <span className={cn('text-[9px] font-mono font-bold uppercase rounded px-2 py-0.5 border', meta.bg, meta.color)}>
                    {meta.label}
                  </span>
                  <span className="text-[10px] text-surface-600">{meta.description}</span>
                  <span className="text-[10px] font-mono text-surface-800 ml-auto">{queries.length}</span>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] px-4 divide-y divide-white/[0.03]">
                  {queries.map(q => (
                    <QueryRow key={q.query} query={q} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Gap queries highlight */}
      {coverage.gaps.length > 0 && (
        <div className="mb-10 rounded-xl border border-red-500/15 bg-red-500/[0.03] p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <h2 className="text-[11px] font-semibold text-red-400">
              {coverage.gaps.length} Uncovered Gap Queries
            </h2>
          </div>
          <p className="text-[11px] text-surface-500 mb-3 leading-relaxed">
            These queries have no mapped content. They represent high-priority publishing targets
            — AI systems cannot surface this platform for these intents.
          </p>
          <div className="space-y-2">
            {coverage.gaps.map(q => {
              const cat = CATEGORY_META[q.category]
              return (
                <div key={q.query} className="flex items-start gap-3">
                  <span className={cn('text-[9px] font-mono shrink-0 mt-0.5', cat.color)}>
                    [{cat.label.slice(0, 3).toUpperCase()}]
                  </span>
                  <div>
                    <p className="text-[11px] text-surface-300 font-medium">{q.query}</p>
                    <p className="text-[10px] text-surface-600">{q.intent}</p>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-4 text-[10px] text-surface-700">
            Publish to{' '}
            <Link href="/publish" className="text-brand-400/70 hover:text-brand-300 transition-colors">
              /publish
            </Link>{' '}
            using the case-study or execution-log template to address these gaps.
          </p>
        </div>
      )}

      {/* Entity graph */}
      <div className="mb-10">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-4">
          Entity Graph
        </h2>
        <p className="text-[11px] text-surface-600 mb-4 leading-relaxed">
          {PLATFORM_ENTITIES.length} tracked entities. Content scoring measures how many of these
          entities appear per 100 words. Threshold: ≥0.6/100 words (3 per 500-word piece).
        </p>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 space-y-4">
          {entityBuckets.map(bucket => (
            <div key={bucket.label}>
              <p className="text-[9px] font-mono uppercase tracking-widest text-surface-700 mb-2">
                {bucket.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {bucket.entities.map(e => (
                  <EntityChip key={e} label={e} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Answerability scoring framework */}
      <div className="mb-10">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-2">
          Answerability Scoring Framework
        </h2>
        <div className="mb-4 flex items-center gap-4 flex-wrap">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-center">
            <p className="text-lg font-bold font-mono text-surface-200">10</p>
            <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wide">Max Score</p>
          </div>
          <div className="rounded-lg border border-green-500/20 bg-green-500/[0.05] px-4 py-2 text-center">
            <p className="text-lg font-bold font-mono text-green-400">≥ 7.0</p>
            <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wide">Publication Gate</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-center">
            <p className="text-lg font-bold font-mono text-surface-400">4</p>
            <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wide">Dimensions</p>
          </div>
          <div className="text-[11px] text-surface-600 leading-relaxed max-w-xs">
            Grades: A (≥9) · B (≥7) · C (≥5) · D (&lt;5). Content below gate is not GEO-publication ready.
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ANSWERABILITY_DIMENSIONS.map(dim => (
            <DimensionCard key={dim.name} dim={dim} />
          ))}
        </div>
      </div>

      {/* Citation potential guide */}
      <div className="mb-10">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-4">
          Citation Potential Scoring
        </h2>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
          <p className="text-[11px] text-surface-500 mb-4 leading-relaxed">
            Citation score (0–10) measures how likely AI retrieval systems are to pull this content
            when generating answers. Higher specificity + query taxonomy coverage = higher citation probability.
          </p>
          <div className="space-y-2">
            {[
              { signal: 'Query taxonomy hit (owned)',       pts: '+1.5 per match',  cap: 'max 4 pts' },
              { signal: 'Entity density meets threshold',   pts: '+2',              cap: '≥0.6/100 words' },
              { signal: 'Entity count > 20 total mentions', pts: '+1',              cap: 'density bonus' },
              { signal: 'Timing data (X minutes/seconds)',  pts: '+1',              cap: 'operational evidence' },
              { signal: 'Code block present',              pts: '+0.5',            cap: 'actionability signal' },
              { signal: 'Failure archive link',            pts: '+0.5',            cap: 'commitRef or /failures/ path' },
              { signal: 'Before/after comparison',         pts: '+0.5',            cap: 'comparative evidence' },
            ].map(row => (
              <div key={row.signal} className="flex items-center gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
                <div className="flex-1">
                  <span className="text-[11px] text-surface-300">{row.signal}</span>
                  <span className="ml-2 text-[10px] text-surface-700">({row.cap})</span>
                </div>
                <span className="text-[11px] font-mono text-brand-400/80 shrink-0">{row.pts}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mb-10">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-4">
          GEO Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/publish#case-study"
            className="rounded-xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.10] transition-all p-4 group"
          >
            <p className="text-[11px] font-semibold text-surface-300 group-hover:text-surface-100 mb-1">
              Publish Case Study →
            </p>
            <p className="text-[10px] text-surface-600 leading-relaxed">
              Highest citation value content type. Covers operational + comparative query categories.
            </p>
          </Link>
          <Link
            href="/ops/signals"
            className="rounded-xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.10] transition-all p-4 group"
          >
            <p className="text-[11px] font-semibold text-surface-300 group-hover:text-surface-100 mb-1">
              View GEO Signals →
            </p>
            <p className="text-[10px] text-surface-600 leading-relaxed">
              See missing GEO coverage signals and entity inconsistency detections.
            </p>
          </Link>
          <Link
            href="/docs"
            className="rounded-xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.10] transition-all p-4 group"
          >
            <p className="text-[11px] font-semibold text-surface-300 group-hover:text-surface-100 mb-1">
              Definitional Docs →
            </p>
            <p className="text-[10px] text-surface-600 leading-relaxed">
              Entity definitions satisfy "What is X?" queries — highest-priority GEO content.
            </p>
          </Link>
        </div>
      </div>

      {/* Footer: how GEO scoring works */}
      <div className="pt-8 border-t border-white/[0.05]">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-3">
          How GEO Scoring Works
        </h2>
        <p className="text-[11px] text-surface-700 leading-relaxed mb-2">
          All scoring runs at build time via{' '}
          <code className="text-[10px] text-surface-600">lib/geo-intelligence.ts</code>.
          Entity density and answerability are computed from raw MDX content strings.
          Query taxonomy is manually maintained and maps known AI-search intents to platform content.
        </p>
        <p className="text-[11px] text-surface-700 leading-relaxed">
          Citation potential is a composite signal: query taxonomy coverage + entity density + operational specificity signals.
          Content scoring ≥7 answerability AND citation score ≥5 is considered GEO-publication ready.
        </p>
      </div>

    </div>
  )
}
