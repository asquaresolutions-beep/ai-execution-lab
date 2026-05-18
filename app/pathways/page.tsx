import Link from 'next/link'
import type { Metadata } from 'next'
import {
  EXECUTION_PATHWAYS,
  getPathwaySummaries,
  type PathwayDifficulty,
  type PathwayCategory,
} from '@/lib/execution-pathways'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Execution Pathways — AI Execution Lab',
  description: 'Goal-oriented execution sequences through the operational knowledge graph — deployment readiness, debugging mastery, AI business launch, GEO optimization, and platform ops.',
  openGraph: {
    title: 'Execution Pathways',
    description: 'Structured paths from goal to execution — deployment, debugging, AI business, GEO, and platform ops.',
  },
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const DIFFICULTY_CONFIG: Record<PathwayDifficulty, { label: string; classes: string }> = {
  beginner:     { label: 'Beginner',     classes: 'text-green-400 bg-green-500/10 border-green-500/25' },
  intermediate: { label: 'Intermediate', classes: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25' },
  advanced:     { label: 'Advanced',     classes: 'text-red-400 bg-red-500/10 border-red-500/25' },
}

const CATEGORY_CONFIG: Record<PathwayCategory, { label: string; icon: string; accent: string }> = {
  deployment:   { label: 'Deployment',    icon: '▲', accent: 'text-blue-400' },
  debugging:    { label: 'Debugging',     icon: '◈', accent: 'text-red-400' },
  'ai-business':{ label: 'AI Business',   icon: '⬡', accent: 'text-brand-400' },
  geo:          { label: 'GEO',           icon: '◎', accent: 'text-purple-400' },
  'platform-ops':{ label: 'Platform Ops', icon: '⊕', accent: 'text-green-400' },
}

// ─────────────────────────────────────────────────────────────
// Pathway card
// ─────────────────────────────────────────────────────────────

function PathwayCard({
  id, title, description, difficulty, category, estimatedTime, stepCount, targetOutcome,
}: ReturnType<typeof getPathwaySummaries>[number]) {
  const diff = DIFFICULTY_CONFIG[difficulty]
  const cat  = CATEGORY_CONFIG[category]
  const full = EXECUTION_PATHWAYS.find(p => p.id === id)!

  return (
    <Link
      href={`/pathways/${id}`}
      className="group flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-brand-500/20 hover:bg-brand-500/[0.02] transition-all"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className={cn('text-base font-mono', cat.accent)}>{cat.icon}</span>
          <span className="text-[10px] font-mono text-surface-600">{cat.label}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className={cn('text-[10px] font-mono rounded px-1.5 py-0.5 border', diff.classes)}>
            {diff.label}
          </span>
          <span className="text-[10px] font-mono text-surface-700 bg-surface-800/50 border border-white/[0.05] rounded px-1.5 py-0.5">
            {estimatedTime}
          </span>
        </div>
      </div>

      {/* Title + description */}
      <h2 className="text-base font-semibold text-surface-200 group-hover:text-surface-50 transition-colors mb-2">
        {title}
      </h2>
      <p className="text-sm text-surface-500 leading-relaxed flex-1 mb-4">
        {description}
      </p>

      {/* Target outcome */}
      <div className="rounded-lg bg-surface-900/40 border border-white/[0.04] px-3 py-2.5 mb-4">
        <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wide mb-1">Outcome</p>
        <p className="text-xs text-surface-400 leading-relaxed">{targetOutcome}</p>
      </div>

      {/* Steps preview */}
      <div className="mb-4">
        <p className="text-[10px] font-mono text-surface-700 mb-2">
          {stepCount} steps
          {full.prerequisites.length > 0 && ` · ${full.prerequisites.length} prerequisites`}
        </p>
        <div className="flex items-center gap-1.5">
          {full.steps.slice(0, 6).map((step, i) => (
            <div
              key={step.id}
              className="h-1.5 flex-1 rounded-full bg-white/[0.06]"
              title={step.title}
            >
              <div className={cn('h-full rounded-full w-full opacity-40',
                step.type === 'failure'     ? 'bg-red-500' :
                step.type === 'case-study'  ? 'bg-green-500' :
                step.type === 'playbook'    ? 'bg-blue-500' :
                step.type === 'doc'         ? 'bg-purple-500' :
                step.type === 'action'      ? 'bg-orange-500' :
                'bg-brand-500'
              )} />
            </div>
          ))}
          {full.steps.length > 6 && (
            <span className="text-[10px] text-surface-700 shrink-0">+{full.steps.length - 6}</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          {(['failure', 'case-study', 'lesson', 'doc', 'action'] as const).map(type => {
            const count = full.steps.filter(s => s.type === type).length
            if (count === 0) return null
            const color =
              type === 'failure'    ? 'text-red-400/60' :
              type === 'case-study' ? 'text-green-400/60' :
              type === 'lesson'     ? 'text-brand-400/60' :
              type === 'doc'        ? 'text-purple-400/60' :
              'text-orange-400/60'
            return (
              <span key={type} className={cn('text-[10px] font-mono', color)}>
                {count} {type === 'case-study' ? 'case stud' + (count === 1 ? 'y' : 'ies') : type + (count === 1 ? '' : 's')}
              </span>
            )
          })}
        </div>
      </div>

      {/* CTA */}
      <div className="flex items-center gap-2 text-xs text-surface-600 group-hover:text-brand-400 transition-colors">
        <span>Start pathway</span>
        <span>→</span>
      </div>
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function PathwaysPage() {
  const summaries = getPathwaySummaries()

  const totalSteps = EXECUTION_PATHWAYS.reduce((s, p) => s + p.steps.length, 0)
  const entityRefs = new Set(
    EXECUTION_PATHWAYS.flatMap(p => p.steps.map(s => s.evidenceRef)).filter(Boolean)
  )

  return (
    <div className="px-6 lg:px-8 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest rounded px-2 py-1 border text-brand-400 bg-brand-500/10 border-brand-500/25">
            EXECUTION PATHWAYS
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-50">
          Execution Pathways
        </h1>
        <p className="mt-2 text-sm text-surface-400 leading-relaxed max-w-2xl">
          Goal-oriented sequences through the operational knowledge graph. Each pathway has a verified outcome,
          real evidence references, and a step-by-step route from your current state to execution.
        </p>
        <p className="mt-2 text-xs font-mono text-surface-600">
          Not courses. Operational routes.
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: 'Pathways',        value: summaries.length },
          { label: 'Total Steps',     value: totalSteps },
          { label: 'Entity Refs',     value: entityRefs.size },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-center">
            <p className="text-2xl font-bold font-mono text-brand-400">{value}</p>
            <p className="text-[10px] font-mono text-surface-600 mt-1 uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {/* Pathway grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {summaries.map((s) => (
          <PathwayCard key={s.id} {...s} />
        ))}
      </div>

      {/* Footer note */}
      <div className="mt-10 pt-6 border-t border-white/[0.05]">
        <p className="text-xs text-surface-600 leading-relaxed max-w-2xl">
          Pathways are constructed from content already in the operational archive. Every step links to a
          real failure report, case study, playbook, or lesson. Completing a pathway means reading real
          incident reports and applying verified fixes — not completing exercises.
        </p>
      </div>
    </div>
  )
}
