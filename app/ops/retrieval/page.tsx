import Link from 'next/link'
import type { Metadata } from 'next'
import {
  getRetrievalReport,
  type PageRetrievalProfile,
  type RetrievalDimension,
  type RetrievalGrade,
} from '@/lib/retrieval-intelligence'
import type { ContentSection } from '@/lib/content'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Retrieval Intelligence — AI Citation Quality · Answer Structure · Entity Density',
  description: 'Build-time AI retrieval quality audit: composite scores across answer structure, entity density, operational specificity, and chunking for every published page.',
  robots: { index: false, follow: false },
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function SectionBadge({ section }: { section: ContentSection }) {
  const styles: Record<ContentSection, string> = {
    'docs':         'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'failures':     'bg-red-500/10 text-red-400 border-red-500/20',
    'logs':         'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    'case-studies': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    'playbooks':    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'labs':         'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    'systems':      'bg-orange-500/10 text-orange-400 border-orange-500/20',
  }
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium border', styles[section] ?? 'bg-zinc-800 text-zinc-400')}>
      {section}
    </span>
  )
}

function GradeBadge({ grade }: { grade: RetrievalGrade }) {
  const styles: Record<RetrievalGrade, string> = {
    A: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    B: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    C: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    D: 'bg-red-500/15 text-red-400 border-red-500/30',
  }
  return (
    <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold border', styles[grade])}>
      {grade}
    </span>
  )
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.round((score / max) * 100)
  const color =
    pct >= 70 ? 'bg-emerald-500' :
    pct >= 40 ? 'bg-amber-500'   :
                'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-zinc-400">{score}</span>
    </div>
  )
}

function DimBar({ score }: { score: number }) {
  // each dimension is 0-25
  const pct = Math.round((score / 25) * 100)
  const color =
    pct >= 72 ? 'bg-emerald-500' :
    pct >= 40 ? 'bg-amber-500'   :
                'bg-red-500'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-zinc-500">{score}/25</span>
    </div>
  )
}

const DIM_SHORT: Record<string, string> = {
  'Answer Structure':        'Ans',
  'Entity Density':          'Ent',
  'Operational Specificity': 'Ops',
  'Retrieval Chunking':      'Chk',
}

function PageRow({ p, rank }: { p: PageRetrievalProfile; rank?: number }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2.5">
      <div className="flex items-start gap-3">
        {rank != null && (
          <span className="text-xs text-zinc-600 tabular-nums w-5 flex-shrink-0 pt-0.5">
            {rank}.
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <GradeBadge grade={p.grade} />
            <SectionBadge section={p.section} />
            <Link href={p.href} className="text-sm text-zinc-200 hover:text-white truncate font-medium">
              {p.title}
            </Link>
          </div>
          {/* Dimension bars */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
            {p.dimensions.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-600 w-7">{DIM_SHORT[d.name] ?? d.name}</span>
                <DimBar score={d.score} />
              </div>
            ))}
            <div className="flex items-center gap-1.5 ml-1">
              <span className="text-[10px] text-zinc-600 w-12">Total</span>
              <ScoreBar score={p.retrievalScore} />
            </div>
          </div>
          {/* Entity tags */}
          {p.topEntities.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {p.topEntities.slice(0, 4).map(e => (
                <span key={e} className="text-[10px] px-1 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                  {e}
                </span>
              ))}
              <span className="text-[10px] text-zinc-600">{p.wordCount}w</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function WeakPageRow({ p }: { p: PageRetrievalProfile }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2.5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <GradeBadge grade={p.grade} />
            <SectionBadge section={p.section} />
            <Link href={p.href} className="text-sm text-zinc-200 hover:text-white truncate font-medium">
              {p.title}
            </Link>
            <ScoreBar score={p.retrievalScore} />
          </div>
          {/* Priority fixes */}
          {p.priorityFixes.length > 0 && (
            <div className="space-y-1 mt-1">
              {p.priorityFixes.map((fix, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-amber-500 text-xs flex-shrink-0 mt-0.5">→</span>
                  <span className="text-xs text-zinc-400">{fix}</span>
                </div>
              ))}
            </div>
          )}
          {/* Dimension weakness summary */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
            {p.dimensions.map(d => (
              <div key={d.name} className="flex items-center gap-1">
                <span className={cn(
                  'text-[10px]',
                  d.label === 'strong'   ? 'text-emerald-500' :
                  d.label === 'adequate' ? 'text-amber-500'   :
                                          'text-red-500'
                )}>
                  {d.label === 'strong' ? '✓' : d.label === 'adequate' ? '~' : '✗'}
                </span>
                <span className="text-[10px] text-zinc-600">{DIM_SHORT[d.name]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function RetrievalOpsPage() {
  const report  = getRetrievalReport()
  const summary = report.summary

  const gradeCounts = {
    A: report.profiles.filter(p => p.grade === 'A').length,
    B: report.profiles.filter(p => p.grade === 'B').length,
    C: report.profiles.filter(p => p.grade === 'C').length,
    D: report.profiles.filter(p => p.grade === 'D').length,
  }

  // Dimension averages
  const dimAvgs = [0, 1, 2, 3].map(i => {
    const total = report.profiles.reduce((s, p) => s + (p.dimensions[i]?.score ?? 0), 0)
    return report.profiles.length > 0 ? Math.round(total / report.profiles.length) : 0
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Link href="/ops" className="text-zinc-500 hover:text-zinc-300 text-sm">← Ops</Link>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-400 text-sm">Retrieval Intelligence</span>
        </div>
        <h1 className="text-2xl font-bold text-white mt-2">AI Retrieval Intelligence</h1>
        <p className="text-zinc-400 mt-1 text-sm">
          Build-time citation quality scores across {summary.totalPages} published pages — answer structure · entity density · operational specificity · chunking
        </p>
      </div>

      {/* ── Summary strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Avg Retrieval Score',
            value: String(summary.avgScore),
            sub:   `${summary.strongCount} strong (≥70)`,
            color: summary.avgScore >= 60 ? 'text-emerald-400' : summary.avgScore >= 40 ? 'text-amber-400' : 'text-red-400',
          },
          {
            label: 'Gate Pass Rate',
            value: `${summary.gatePassRate}%`,
            sub:   'answerability ≥ 7.0',
            color: summary.gatePassRate >= 60 ? 'text-emerald-400' : summary.gatePassRate >= 30 ? 'text-amber-400' : 'text-red-400',
          },
          {
            label: 'Avg Entity Density',
            value: String(summary.avgEntityDensity),
            sub:   'entities per 100 words',
            color: summary.avgEntityDensity >= 1.5 ? 'text-emerald-400' : summary.avgEntityDensity >= 0.8 ? 'text-amber-400' : 'text-red-400',
          },
          {
            label: 'Weak Pages',
            value: String(summary.weakCount),
            sub:   `score < 40 · needs work`,
            color: summary.weakCount === 0 ? 'text-emerald-400' : summary.weakCount <= 10 ? 'text-amber-400' : 'text-red-400',
          },
        ].map(card => (
          <div key={card.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-xs text-zinc-500 mb-1">{card.label}</div>
            <div className={cn('text-2xl font-bold tabular-nums', card.color)}>{card.value}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Grade distribution ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Grade Distribution</h2>

        {/* Grade bar */}
        {summary.totalPages > 0 && (
          <div className="flex h-3 rounded-full overflow-hidden mb-3 bg-zinc-800">
            {(['A', 'B', 'C', 'D'] as const).map(g => {
              const count = gradeCounts[g]
              const pct   = (count / summary.totalPages) * 100
              const color =
                g === 'A' ? 'bg-emerald-500' :
                g === 'B' ? 'bg-blue-500'    :
                g === 'C' ? 'bg-amber-500'   :
                            'bg-red-500'
              if (pct === 0) return null
              return <div key={g} className={color} style={{ width: `${pct}%` }} />
            })}
          </div>
        )}
        <div className="flex gap-6 text-sm mb-4">
          {(['A', 'B', 'C', 'D'] as const).map(g => (
            <div key={g} className="flex items-center gap-1.5">
              <GradeBadge grade={g} />
              <span className="text-zinc-400 tabular-nums">{gradeCounts[g]}</span>
            </div>
          ))}
        </div>

        {/* Dimension averages */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {['Answer Structure', 'Entity Density', 'Operational Specificity', 'Retrieval Chunking'].map((name, i) => (
            <div key={name} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-2">{name}</div>
              <div className="flex items-baseline gap-1">
                <span className={cn(
                  'text-xl font-bold tabular-nums',
                  dimAvgs[i] >= 18 ? 'text-emerald-400' :
                  dimAvgs[i] >= 10 ? 'text-amber-400'   :
                                     'text-red-400'
                )}>
                  {dimAvgs[i]}
                </span>
                <span className="text-xs text-zinc-600">/25 avg</span>
              </div>
              <div className="mt-1.5">
                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      dimAvgs[i] >= 18 ? 'bg-emerald-500' :
                      dimAvgs[i] >= 10 ? 'bg-amber-500'   :
                                         'bg-red-500'
                    )}
                    style={{ width: `${Math.round((dimAvgs[i] / 25) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Top Retrieval Pages ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-1">
          Strongest Retrieval Pages
          <span className="ml-2 text-sm font-normal text-zinc-500">
            top {Math.min(10, report.topRetrieval.length)} by composite score
          </span>
        </h2>
        <p className="text-xs text-zinc-500 mb-4">
          These pages are the highest-priority citation targets for AI search systems — optimise outbound links to point here.
        </p>

        {report.topRetrieval.length === 0 ? (
          <div className="text-sm text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            No pages scored yet.
          </div>
        ) : (
          <div className="space-y-2">
            {report.topRetrieval.map((p, i) => (
              <PageRow key={p.href} p={p} rank={i + 1} />
            ))}
          </div>
        )}
      </section>

      {/* ── Weak Retrieval Candidates ───────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-1">
          Weak Retrieval Candidates
          <span className="ml-2 text-sm font-normal text-zinc-500">
            worst-first action list · {report.worstFirst.length} pages
          </span>
        </h2>
        <p className="text-xs text-zinc-500 mb-4">
          Pages scoring below 40. Each row shows the two highest-leverage fixes. Address these first to improve AI citation coverage.
        </p>

        {report.worstFirst.length === 0 ? (
          <div className="text-sm text-emerald-400 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
            No weak pages — all content scores ≥ 40.
          </div>
        ) : (
          <div className="space-y-2">
            {report.worstFirst.map(p => (
              <WeakPageRow key={p.href} p={p} />
            ))}
          </div>
        )}
      </section>

      {/* ── Missing Answer Structure ────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-1">
          Missing Answer Structure
          <span className="ml-2 text-sm font-normal text-zinc-500">
            {report.missingAnswerStructure.length} pages where the opening doesn't lead with the answer
          </span>
        </h2>
        <p className="text-xs text-zinc-500 mb-4">
          Answer Structure score = weak (0–9/25). These pages likely open with context or background rather than a direct assertion — the format least likely to be cited by AI systems.
        </p>

        {report.missingAnswerStructure.length === 0 ? (
          <div className="text-sm text-emerald-400 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
            All pages have adequate answer structure.
          </div>
        ) : (
          <div className="space-y-2">
            {report.missingAnswerStructure.slice(0, 20).map(p => {
              const d = p.dimensions[0]
              return (
                <div key={p.href} className="flex items-start gap-3 bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <SectionBadge section={p.section} />
                      <Link href={p.href} className="text-sm text-zinc-200 hover:text-white font-medium truncate">
                        {p.title}
                      </Link>
                      <span className="text-xs text-red-400 font-mono">{d.score}/25</span>
                    </div>
                    {d.suggestion && (
                      <div className="flex items-start gap-1.5">
                        <span className="text-amber-500 text-xs flex-shrink-0 mt-0.5">→</span>
                        <span className="text-xs text-zinc-400">{d.suggestion}</span>
                      </div>
                    )}
                  </div>
                  <GradeBadge grade={p.grade} />
                </div>
              )
            })}
            {report.missingAnswerStructure.length > 20 && (
              <div className="text-xs text-zinc-600 px-3">
                + {report.missingAnswerStructure.length - 20} more
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Low Entity Density ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-1">
          Low Entity Density
          <span className="ml-2 text-sm font-normal text-zinc-500">
            {report.lowEntityDensity.length} pages below density threshold
          </span>
        </h2>
        <p className="text-xs text-zinc-500 mb-4">
          These pages have fewer named technical entities per 100 words than the 0.6 threshold. AI systems depend on entity signals to classify content and route citations — low density reduces citation likelihood.
        </p>

        {report.lowEntityDensity.length === 0 ? (
          <div className="text-sm text-emerald-400 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
            All pages meet entity density threshold.
          </div>
        ) : (
          <div className="space-y-2">
            {report.lowEntityDensity.slice(0, 20).map(p => (
              <div key={p.href} className="flex items-start gap-3 bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <SectionBadge section={p.section} />
                    <Link href={p.href} className="text-sm text-zinc-200 hover:text-white font-medium truncate">
                      {p.title}
                    </Link>
                    <span className="text-xs text-amber-400 tabular-nums font-mono">
                      {p.entityDensity.densityPerHundred.toFixed(2)}/100w
                    </span>
                    <span className="text-xs text-zinc-600">
                      {p.entityDensity.entityCount} entities · {p.wordCount}w
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-amber-500 text-xs flex-shrink-0 mt-0.5">→</span>
                    <span className="text-xs text-zinc-400">
                      Name specific tools, products, version numbers, and platform concepts explicitly
                    </span>
                  </div>
                </div>
                <GradeBadge grade={p.grade} />
              </div>
            ))}
            {report.lowEntityDensity.length > 20 && (
              <div className="text-xs text-zinc-600 px-3">
                + {report.lowEntityDensity.length - 20} more
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Adequate pages ──────────────────────────────────────────────────── */}
      {report.adequate.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-1">
            Adequate Pages
            <span className="ml-2 text-sm font-normal text-zinc-500">
              {report.adequate.length} pages scoring 40–69 — improvable
            </span>
          </h2>
          <p className="text-xs text-zinc-500 mb-4">
            These pages will appear in AI search results but may not be the preferred citation. Each is one targeted improvement away from moving into the strong tier.
          </p>
          <div className="space-y-2">
            {report.adequate.slice(0, 15).map(p => (
              <WeakPageRow key={p.href} p={p} />
            ))}
            {report.adequate.length > 15 && (
              <div className="text-xs text-zinc-600 px-3">
                + {report.adequate.length - 15} more adequate pages
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Corpus summary ──────────────────────────────────────────────────── */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-white mb-3">Corpus Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-sm">
          {[
            { label: 'Total pages', value: summary.totalPages },
            { label: 'Avg word count', value: summary.avgWordCount },
            { label: 'Total evidence pieces', value: summary.totalEvidencePieces },
            { label: 'Strong pages (≥70)', value: summary.strongCount },
            { label: 'Adequate pages (40–69)', value: summary.adequateCount },
            { label: 'Weak pages (<40)', value: summary.weakCount },
            { label: 'Gate pass rate', value: `${summary.gatePassRate}%` },
            { label: 'Avg entity density', value: `${summary.avgEntityDensity}/100w` },
          ].map(row => (
            <div key={row.label}>
              <div className="text-xs text-zinc-500 mb-0.5">{row.label}</div>
              <div className="text-white font-semibold tabular-nums">{row.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <section className="border-t border-zinc-800 pt-6">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/ops" className="text-zinc-400 hover:text-white transition-colors">← Ops Overview</Link>
          <Link href="/ops/seo" className="text-zinc-400 hover:text-white transition-colors">SEO Operations →</Link>
          <Link href="/ops/geo" className="text-zinc-400 hover:text-white transition-colors">GEO Intelligence →</Link>
          <Link href="/docs/geo-intelligence-architecture" className="text-zinc-400 hover:text-white transition-colors">GEO Architecture →</Link>
        </div>
      </section>

    </div>
  )
}
