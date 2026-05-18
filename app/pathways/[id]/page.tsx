import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import {
  EXECUTION_PATHWAYS,
  getPathwayById,
  type PathwayStepType,
  type PathwayDifficulty,
  type PathwayCategory,
} from '@/lib/execution-pathways'
import { cn } from '@/lib/utils'

interface Props { params: Promise<{ id: string }> }

export async function generateStaticParams() {
  return EXECUTION_PATHWAYS.map(p => ({ id: p.id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const pathway = getPathwayById(id)
  if (!pathway) return {}
  return {
    title: `${pathway.title} — Execution Pathway`,
    description: pathway.description,
    openGraph: { title: pathway.title, description: pathway.description },
  }
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const DIFFICULTY_CONFIG: Record<PathwayDifficulty, { label: string; classes: string }> = {
  beginner:     { label: 'Beginner',     classes: 'text-green-400 bg-green-500/10 border-green-500/25' },
  intermediate: { label: 'Intermediate', classes: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25' },
  advanced:     { label: 'Advanced',     classes: 'text-red-400 bg-red-500/10 border-red-500/25' },
}

const CATEGORY_LABEL: Record<PathwayCategory, string> = {
  deployment:    'Deployment',
  debugging:     'Debugging',
  'ai-business': 'AI Business',
  geo:           'GEO',
  'platform-ops':'Platform Ops',
}

const STEP_TYPE_CONFIG: Record<PathwayStepType, { label: string; color: string; border: string; dot: string }> = {
  failure:      { label: 'Failure Report', color: 'text-red-400',    border: 'border-red-500/20',    dot: 'bg-red-500' },
  lesson:       { label: 'Lesson',         color: 'text-brand-400',  border: 'border-brand-500/20',  dot: 'bg-brand-500' },
  playbook:     { label: 'Playbook',       color: 'text-blue-400',   border: 'border-blue-500/20',   dot: 'bg-blue-500' },
  'case-study': { label: 'Case Study',     color: 'text-green-400',  border: 'border-green-500/20',  dot: 'bg-green-500' },
  doc:          { label: 'Doc',            color: 'text-purple-400', border: 'border-purple-500/20', dot: 'bg-purple-500' },
  action:       { label: 'Action',         color: 'text-orange-400', border: 'border-orange-500/20', dot: 'bg-orange-500' },
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default async function PathwayPage({ params }: Props) {
  const { id } = await params
  const pathway = getPathwayById(id)
  if (!pathway) notFound()

  const diff = DIFFICULTY_CONFIG[pathway.difficulty]

  return (
    <div className="px-5 sm:px-6 lg:px-8 py-8">
      <div className="max-w-3xl">

        {/* Breadcrumb */}
        <nav className="mb-7 flex items-center gap-1.5 text-xs text-surface-600">
          <Link href="/" className="hover:text-surface-400 transition-colors">Home</Link>
          <span>/</span>
          <Link href="/pathways" className="hover:text-surface-400 transition-colors">Pathways</Link>
          <span>/</span>
          <span className="text-surface-500 truncate">{pathway.title}</span>
        </nav>

        {/* Header */}
        <header className="mb-10 pb-8 border-b border-white/[0.06]">
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <Link
              href="/pathways"
              className="inline-flex items-center text-[10px] font-mono font-bold uppercase tracking-widest rounded px-2 py-1 border text-brand-400 bg-brand-500/10 border-brand-500/25 transition-opacity hover:opacity-70"
            >
              EXECUTION PATHWAY
            </Link>
            <span className={cn('text-[10px] font-mono rounded px-1.5 py-0.5 border', diff.classes)}>
              {diff.label}
            </span>
            <span className="text-[10px] font-mono text-surface-700 bg-surface-800/50 border border-white/[0.05] rounded px-1.5 py-0.5">
              {pathway.estimatedTime}
            </span>
            <span className="text-[10px] font-mono text-surface-700 bg-surface-800/50 border border-white/[0.05] rounded px-1.5 py-0.5">
              {CATEGORY_LABEL[pathway.category]}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-surface-50 text-balance leading-[1.2]">
            {pathway.title}
          </h1>
          <p className="mt-3 text-base text-surface-400 leading-relaxed max-w-2xl">
            {pathway.description}
          </p>

          {/* Target outcome */}
          <div className="mt-6 rounded-lg border border-brand-500/20 bg-brand-500/[0.04] px-4 py-3.5">
            <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest mb-1.5">
              Target Outcome
            </p>
            <p className="text-sm text-surface-300 leading-relaxed">{pathway.targetOutcome}</p>
          </div>

          {/* Prerequisites */}
          {pathway.prerequisites.length > 0 && (
            <div className="mt-4 rounded-lg border border-surface-700/40 bg-surface-900/30 px-4 py-3">
              <p className="text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-2">Prerequisites</p>
              <ul className="space-y-1">
                {pathway.prerequisites.map((p, i) => (
                  <li key={i} className="text-sm text-surface-400 flex items-start gap-2">
                    <span className="text-surface-600 shrink-0">—</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </header>

        {/* Steps */}
        <section>
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-surface-600 mb-6">
            {pathway.steps.length} Steps
          </h2>

          <div className="relative">
            {/* Vertical connector line */}
            <div className="absolute left-[7px] top-4 bottom-4 w-px bg-white/[0.05]" aria-hidden />

            <ol className="space-y-4">
              {pathway.steps.map((step, idx) => {
                const tc = STEP_TYPE_CONFIG[step.type]
                return (
                  <li key={step.id} className="flex gap-4 relative">
                    {/* Step number dot */}
                    <div className="relative flex flex-col items-center shrink-0 pt-1">
                      <div className={cn(
                        'w-3.5 h-3.5 rounded-full border-2 border-surface-900 shrink-0 z-10',
                        tc.dot
                      )} />
                    </div>

                    {/* Step card */}
                    <div className={cn(
                      'flex-1 rounded-xl border bg-white/[0.015] p-4',
                      step.isOptional ? 'border-white/[0.04] opacity-80' : 'border-white/[0.06]'
                    )}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono text-surface-700">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className={cn('text-[10px] font-mono', tc.color)}>
                            {tc.label}
                          </span>
                          {step.isOptional && (
                            <span className="text-[10px] font-mono text-surface-700 bg-surface-800/50 border border-white/[0.05] rounded px-1.5 py-0.5">
                              Optional
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-surface-700 shrink-0">{step.duration}</span>
                      </div>

                      {step.href ? (
                        <Link
                          href={step.href}
                          className="group inline-block mb-2"
                        >
                          <h3 className="text-sm font-semibold text-surface-200 group-hover:text-surface-50 transition-colors">
                            {step.title} →
                          </h3>
                        </Link>
                      ) : (
                        <h3 className="text-sm font-semibold text-surface-200 mb-2">{step.title}</h3>
                      )}

                      <p className="text-sm text-surface-500 leading-relaxed">{step.description}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>

        {/* Outcomes */}
        <section className="mt-12 pt-8 border-t border-white/[0.06]">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-surface-600 mb-4">
            Expected Outcomes
          </h2>
          <ul className="space-y-2">
            {pathway.outcomes.map((outcome, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-surface-400">
                <span className="text-green-400 shrink-0 mt-0.5">✓</span>
                {outcome}
              </li>
            ))}
          </ul>
        </section>

        {/* Case study reference */}
        {pathway.caseStudyRef && (
          <div className="mt-8 rounded-xl border border-green-500/15 bg-green-500/[0.03] p-4">
            <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-2">
              See This Pathway in Practice
            </p>
            <p className="text-sm text-surface-400 mb-3">
              A real case study demonstrates this pathway executed in full production context.
            </p>
            <Link
              href={`/case-studies/${pathway.caseStudyRef}`}
              className="inline-flex items-center gap-2 text-sm text-green-400 hover:text-green-300 transition-colors"
            >
              View case study →
            </Link>
          </div>
        )}

        {/* Back link */}
        <div className="mt-10">
          <Link
            href="/pathways"
            className="inline-flex items-center gap-2 text-sm text-surface-600 hover:text-surface-300 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Pathways
          </Link>
        </div>

      </div>
    </div>
  )
}
