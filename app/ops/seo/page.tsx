import Link from 'next/link'
import type { Metadata } from 'next'
import {
  getInternalLinkingReport,
  getLinkGraphSummary,
  getTopLinkSuggestions,
  type PageLinkProfile,
  type LinkSuggestion,
} from '@/lib/internal-linking'
import { getAllMeta, type ContentSection } from '@/lib/content'
import { GEO_QUERY_TAXONOMY } from '@/lib/geo-intelligence'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'SEO Operations — Internal Links · GEO Readiness · Content Freshness',
  description: 'Operational SEO view: internal link graph health, orphaned pages, GEO retrieval readiness, and content freshness scoring across the lab corpus.',
  robots: { index: false, follow: false },
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function ConnectivityBar({ score }: { score: number }) {
  const pct = Math.min(score, 100)
  const color =
    pct >= 60 ? 'bg-emerald-500' :
    pct >= 30 ? 'bg-amber-500'   :
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

function PriorityDot({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  return (
    <span className={cn(
      'inline-block w-2 h-2 rounded-full flex-shrink-0',
      priority === 'high'   ? 'bg-red-500'    :
      priority === 'medium' ? 'bg-amber-500'  :
                              'bg-zinc-500'
    )} />
  )
}

const MATCH_TYPE_LABELS: Record<LinkSuggestion['matchType'], string> = {
  'shared-tags':    'Shared tags',
  'section-bridge': 'Section bridge',
  'failure-playbook': 'Failure → Playbook',
  'log-doc':        'Log → Doc',
  'case-study-doc': 'Case study → Doc',
}

// ─────────────────────────────────────────────────────────────────────────────
// Content freshness scoring
// ─────────────────────────────────────────────────────────────────────────────

const SECTIONS: ContentSection[] = ['docs', 'failures', 'logs', 'case-studies', 'playbooks', 'labs', 'systems']

interface FreshnessItem {
  href:        string
  title:       string
  section:     ContentSection
  date:        string
  updated?:    string
  daysOld:     number
  daysStale:   number   // days since last updated (or published if no updated)
  freshness:   'fresh' | 'aging' | 'stale' | 'very-stale'
  hasEvidence: boolean
}

function computeFreshness(today: Date, items: FreshnessItem[]): FreshnessItem[] {
  return items.sort((a, b) => b.daysStale - a.daysStale)
}

function buildFreshnessReport(today: Date): { items: FreshnessItem[], staleCount: number, freshCount: number } {
  const items: FreshnessItem[] = []
  const todayMs = today.getTime()

  for (const section of SECTIONS) {
    const metas = getAllMeta(section)
    for (const meta of metas) {
      const fm = meta.frontmatter
      const publishedMs = new Date(fm.date).getTime()
      const updatedMs   = fm.updated ? new Date(fm.updated).getTime() : publishedMs
      const daysOld     = Math.floor((todayMs - publishedMs) / 86400000)
      const daysStale   = Math.floor((todayMs - updatedMs)   / 86400000)

      const freshness: FreshnessItem['freshness'] =
        daysStale <=  7 ? 'fresh'      :
        daysStale <= 30 ? 'aging'      :
        daysStale <= 90 ? 'stale'      :
                          'very-stale'

      items.push({
        href:        `/${section}/${meta.slug}`,
        title:       fm.title,
        section,
        date:        fm.date,
        updated:     fm.updated,
        daysOld,
        daysStale,
        freshness,
        hasEvidence: (fm.evidence_images?.length ?? 0) > 0 || (fm.external_refs?.length ?? 0) > 0,
      })
    }
  }

  const sorted     = computeFreshness(today, items)
  const staleCount = items.filter(i => i.freshness === 'stale' || i.freshness === 'very-stale').length
  const freshCount = items.filter(i => i.freshness === 'fresh').length

  return { items: sorted, staleCount, freshCount }
}

const FRESHNESS_STYLES: Record<FreshnessItem['freshness'], string> = {
  'fresh':      'text-emerald-400',
  'aging':      'text-amber-400',
  'stale':      'text-orange-400',
  'very-stale': 'text-red-400',
}

// ─────────────────────────────────────────────────────────────────────────────
// GEO readiness
// ─────────────────────────────────────────────────────────────────────────────

function buildGEOReadiness() {
  const owned       = GEO_QUERY_TAXONOMY.filter(q => q.difficulty === 'owned')
  const competitive = GEO_QUERY_TAXONOMY.filter(q => q.difficulty === 'competitive')
  const gap         = GEO_QUERY_TAXONOMY.filter(q => q.difficulty === 'gap')
  const covered     = GEO_QUERY_TAXONOMY.filter(q => q.difficulty !== 'gap' && q.targetSlug)
  const coveragePct = Math.round((covered.length / GEO_QUERY_TAXONOMY.length) * 100)

  return { owned, competitive, gap, covered, coveragePct, total: GEO_QUERY_TAXONOMY.length }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function SEOOpsPage() {
  const today   = new Date('2026-05-19')
  const report  = getInternalLinkingReport()
  const summary = report.summary
  const topSuggestions = getTopLinkSuggestions(20)
  const freshness = buildFreshnessReport(today)
  const geo = buildGEOReadiness()

  const highPrioritySuggestions = topSuggestions.filter(s => s.priority === 'high')
  const orphanedPages = report.orphans.orphaned
  const stalePages    = freshness.items.filter(i => i.freshness === 'stale' || i.freshness === 'very-stale').slice(0, 10)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Link href="/ops" className="text-zinc-500 hover:text-zinc-300 text-sm">← Ops</Link>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-400 text-sm">SEO Operations</span>
        </div>
        <h1 className="text-2xl font-bold text-white mt-2">SEO Operations</h1>
        <p className="text-zinc-400 mt-1 text-sm">
          Internal link graph · GEO retrieval readiness · Content freshness — build-time snapshot
        </p>
      </div>

      {/* ── Summary strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Link Graph',
            value: `${summary.totalLinks} links`,
            sub:   `across ${summary.totalPages} pages`,
            color: 'text-blue-400',
          },
          {
            label: 'Orphaned Pages',
            value: String(summary.orphanedCount),
            sub:   'zero inbound links',
            color: summary.orphanedCount > 5 ? 'text-red-400' : summary.orphanedCount > 0 ? 'text-amber-400' : 'text-emerald-400',
          },
          {
            label: 'GEO Coverage',
            value: `${geo.coveragePct}%`,
            sub:   `${geo.covered.length}/${geo.total} queries`,
            color: geo.coveragePct >= 70 ? 'text-emerald-400' : geo.coveragePct >= 40 ? 'text-amber-400' : 'text-red-400',
          },
          {
            label: 'Stale Content',
            value: String(freshness.staleCount),
            sub:   'items >30 days unchanged',
            color: freshness.staleCount > 10 ? 'text-amber-400' : 'text-emerald-400',
          },
        ].map(card => (
          <div key={card.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-xs text-zinc-500 mb-1">{card.label}</div>
            <div className={cn('text-2xl font-bold tabular-nums', card.color)}>{card.value}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Internal Link Graph ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Internal Link Graph</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 text-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="text-zinc-500 text-xs mb-1">Avg inbound</div>
            <div className="text-white font-semibold tabular-nums">{summary.avgInbound}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="text-zinc-500 text-xs mb-1">Avg outbound</div>
            <div className="text-white font-semibold tabular-nums">{summary.avgOutbound}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="text-zinc-500 text-xs mb-1">Avg connectivity</div>
            <div className="text-white font-semibold tabular-nums">{summary.avgConnectivity}/100</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="text-zinc-500 text-xs mb-1">Hub pages (5+ inbound)</div>
            <div className="text-white font-semibold tabular-nums">{summary.hubCount}</div>
          </div>
        </div>

        {/* Orphaned pages */}
        {orphanedPages.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              Orphaned Pages — {orphanedPages.length} pages with zero inbound links
            </h3>
            <div className="space-y-1.5">
              {orphanedPages.map(p => (
                <div key={p.href} className="flex items-center justify-between gap-4 bg-zinc-900/60 border border-zinc-800 rounded px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <SectionBadge section={p.section} />
                    <span className="text-sm text-zinc-300 truncate">{p.title}</span>
                    <span className="text-xs text-zinc-600 font-mono hidden sm:inline">{p.href}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-zinc-500">{p.outboundCount} out</span>
                    <ConnectivityBar score={p.connectivityScore} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Isolated pages */}
        {report.orphans.isolated.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              Isolated Pages — {report.orphans.isolated.length} pages with &lt;2 inbound and &lt;2 outbound
            </h3>
            <div className="space-y-1.5">
              {report.orphans.isolated.slice(0, 12).map(p => (
                <div key={p.href} className="flex items-center justify-between gap-4 bg-zinc-900/60 border border-zinc-800 rounded px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <SectionBadge section={p.section} />
                    <span className="text-sm text-zinc-300 truncate">{p.title}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 text-xs text-zinc-500">
                    <span>{p.inboundCount} in</span>
                    <span>{p.outboundCount} out</span>
                    <ConnectivityBar score={p.connectivityScore} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hub pages */}
        {report.orphans.hubs.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Hub Pages — {report.orphans.hubs.length} pages with 5+ inbound links
            </h3>
            <div className="space-y-1.5">
              {report.orphans.hubs.slice(0, 8).map(p => (
                <div key={p.href} className="flex items-center justify-between gap-4 bg-zinc-900/60 border border-zinc-800/50 rounded px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <SectionBadge section={p.section} />
                    <span className="text-sm text-zinc-300 truncate">{p.title}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-emerald-400 font-medium">{p.inboundCount} inbound</span>
                    <ConnectivityBar score={p.connectivityScore} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Link Suggestions ────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Link Suggestions
            <span className="ml-2 text-sm font-normal text-zinc-500">
              {report.suggestions.length} actionable pairs
            </span>
          </h2>
          {highPrioritySuggestions.length > 0 && (
            <span className="text-xs text-red-400 font-medium">
              {highPrioritySuggestions.length} high priority
            </span>
          )}
        </div>

        {topSuggestions.length === 0 ? (
          <div className="text-sm text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            No link suggestions generated — link graph is well-connected.
          </div>
        ) : (
          <div className="space-y-2">
            {topSuggestions.map((s, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
                <div className="flex items-start gap-3">
                  <PriorityDot priority={s.priority} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                        {MATCH_TYPE_LABELS[s.matchType]}
                      </span>
                      {s.sharedTags && s.sharedTags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {s.sharedTags.slice(0, 3).map(t => (
                            <span key={t} className="text-[10px] px-1 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-zinc-300 mb-0.5">
                      Add link in{' '}
                      <span className="font-mono text-xs text-zinc-400">{s.fromHref}</span>
                      {' '}→{' '}
                      <span className="font-mono text-xs text-zinc-400">{s.toHref}</span>
                    </div>
                    <div className="text-xs text-zinc-500">{s.reason}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── GEO Readiness ───────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">
          GEO Retrieval Readiness
          <span className="ml-2 text-sm font-normal text-zinc-500">
            {geo.coveragePct}% of queries have content
          </span>
        </h2>

        {/* Coverage bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5">
            <span>Coverage</span>
            <span>{geo.covered.length}/{geo.total} queries</span>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${geo.coveragePct}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-zinc-500">
            <span className="text-emerald-400">● {geo.owned.length} owned</span>
            <span className="text-amber-400">● {geo.competitive.length} competitive</span>
            <span className="text-red-400">● {geo.gap.length} gap</span>
          </div>
        </div>

        {/* Gap queries — priority targets */}
        {geo.gap.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-red-400 mb-3">
              Gap Queries — no content published for these
            </h3>
            <div className="space-y-1.5">
              {geo.gap.map((q, i) => (
                <div key={i} className="flex items-start justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded px-3 py-2.5">
                  <div>
                    <div className="text-sm text-zinc-300 font-mono mb-0.5">"{q.query}"</div>
                    <div className="text-xs text-zinc-500">{q.intent}</div>
                  </div>
                  <span className="text-xs px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded flex-shrink-0">
                    {q.category}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Owned queries */}
        {geo.owned.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-emerald-400 mb-3">
              Owned Queries — content published and targeted
            </h3>
            <div className="space-y-1.5">
              {geo.owned.map((q, i) => (
                <div key={i} className="flex items-start justify-between gap-4 bg-zinc-900/50 border border-zinc-800/50 rounded px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-emerald-500 flex-shrink-0">✓</span>
                    <span className="text-sm text-zinc-400 truncate font-mono">"{q.query}"</span>
                  </div>
                  {q.targetSlug && (
                    <span className="text-xs text-zinc-600 font-mono flex-shrink-0 hidden sm:inline">
                      {q.targetSlug}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Content Freshness ───────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Content Freshness
          </h2>
          <div className="flex gap-3 text-xs">
            <span className="text-emerald-400">{freshness.freshCount} fresh</span>
            <span className="text-amber-400">{freshness.items.filter(i => i.freshness === 'aging').length} aging</span>
            <span className="text-orange-400">{freshness.items.filter(i => i.freshness === 'stale').length} stale</span>
            <span className="text-red-400">{freshness.items.filter(i => i.freshness === 'very-stale').length} very stale</span>
          </div>
        </div>

        {/* Freshness distribution bar */}
        <div className="flex h-2 rounded-full overflow-hidden mb-5 bg-zinc-800">
          {(['fresh', 'aging', 'stale', 'very-stale'] as const).map(tier => {
            const count = freshness.items.filter(i => i.freshness === tier).length
            const pct   = freshness.items.length > 0 ? (count / freshness.items.length) * 100 : 0
            const color = tier === 'fresh' ? 'bg-emerald-500' : tier === 'aging' ? 'bg-amber-500' : tier === 'stale' ? 'bg-orange-500' : 'bg-red-500'
            if (pct === 0) return null
            return <div key={tier} className={color} style={{ width: `${pct}%` }} />
          })}
        </div>

        {/* Stalest items needing refresh */}
        {stalePages.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-orange-400 mb-3">
              Content Needing Refresh — {freshness.staleCount} items unchanged {'>'} 30 days
            </h3>
            <div className="space-y-1.5">
              {stalePages.map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-4 bg-zinc-900/60 border border-zinc-800 rounded px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <SectionBadge section={item.section} />
                    <span className="text-sm text-zinc-300 truncate">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                    <span className={FRESHNESS_STYLES[item.freshness]}>
                      {item.daysStale}d unchanged
                    </span>
                    {!item.hasEvidence && (
                      <span className="text-zinc-600">no evidence</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {freshness.staleCount === 0 && (
          <div className="text-sm text-emerald-400 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
            All content updated within 30 days.
          </div>
        )}
      </section>

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <section className="border-t border-zinc-800 pt-6">
        <div className="flex gap-4 text-sm">
          <Link href="/ops" className="text-zinc-400 hover:text-white transition-colors">← Ops Overview</Link>
          <Link href="/ops/geo" className="text-zinc-400 hover:text-white transition-colors">GEO Intelligence →</Link>
          <Link href="/ops/signals" className="text-zinc-400 hover:text-white transition-colors">Operational Signals →</Link>
        </div>
      </section>

    </div>
  )
}
