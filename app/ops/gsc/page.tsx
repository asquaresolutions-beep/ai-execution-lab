import Link from 'next/link'
import type { Metadata } from 'next'
import {
  getGSCIntelligenceReport,
  getPageOpportunities,
  getQueryOpportunities,
  getPosition2Candidates,
  getCoverageGaps,
  OPPORTUNITY_LABELS,
  type PageOpportunity,
  type QueryOpportunity,
  type GSCCoverageGap,
} from '@/lib/gsc-intelligence'
import { loadGSCSnapshot } from '@/lib/telemetry'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'GSC Operations — Search Console Intelligence',
  description: 'Operational Google Search Console dashboard: low CTR pages, position 2 candidates, coverage gaps, and query opportunities.',
  robots: { index: false, follow: false },
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  return (
    <span className={cn(
      'text-[10px] px-1.5 py-0.5 rounded font-medium border',
      priority === 'high'   ? 'bg-red-500/10 text-red-400 border-red-500/20'    :
      priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              'bg-zinc-800 text-zinc-500 border-zinc-700'
    )}>
      {priority}
    </span>
  )
}

function MetricCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="text-xl font-bold text-white tabular-nums">{value}</div>
      {sub && <div className="text-xs text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  )
}

function PositionBar({ position }: { position: number }) {
  const pct   = Math.max(0, Math.min(100, ((21 - position) / 20) * 100))
  const color =
    position <= 3  ? 'bg-emerald-500' :
    position <= 10 ? 'bg-amber-500'   :
                     'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-zinc-400">#{position.toFixed(1)}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Pending state (no GSC data yet)
// ─────────────────────────────────────────────────────────────────────────────

function PendingState() {
  return (
    <div className="space-y-8">
      <div className="bg-zinc-900 border border-amber-500/20 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <span className="text-amber-400 text-xl">⚠</span>
          <div>
            <div className="text-sm font-semibold text-amber-400 mb-1">GSC data not yet ingested</div>
            <p className="text-sm text-zinc-400 mb-4">
              This dashboard requires a Google Search Console CSV export. Once ingested, it surfaces low-CTR pages, page-2 ranking opportunities, coverage gaps, and top query intelligence.
            </p>
            <div className="space-y-2">
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-wide mb-2">Setup steps</p>
              <div className="space-y-1.5 text-sm text-zinc-300">
                <div className="flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5 flex-shrink-0">1.</span>
                  <span>Google Search Console → Performance → Search Results</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5 flex-shrink-0">2.</span>
                  <span>Set date range: last 28 days → Export → Download CSV</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5 flex-shrink-0">3.</span>
                  <span className="font-mono text-xs bg-zinc-800 px-2 py-0.5 rounded">node scripts/ingest-gsc.mjs path/to/queries.csv --type queries</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5 flex-shrink-0">4.</span>
                  <span className="font-mono text-xs bg-zinc-800 px-2 py-0.5 rounded">node scripts/ingest-gsc.mjs path/to/pages.csv --type pages</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5 flex-shrink-0">5.</span>
                  <span>Rebuild to see dashboard populate</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Architecture preview */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">What This Dashboard Will Show</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              title: 'Low CTR Pages',
              color: 'border-amber-500/20',
              desc: 'Pages with 50+ impressions but CTR below 50% of position benchmark. Each entry includes exact CTR gap, potential click increase, and title/description recommendation.',
            },
            {
              title: 'Page 2 → Page 1 Candidates',
              color: 'border-blue-500/20',
              desc: 'Pages ranking position 11-20. These are one targeted content improvement away from page 1. Sorted by impression volume — highest-traffic opportunities first.',
            },
            {
              title: 'Featured Snippet Targets',
              color: 'border-purple-500/20',
              desc: 'Pages at position 3-10 with significant impressions. Adding a direct answer block (definition, numbered list, or table) can capture the featured snippet.',
            },
            {
              title: 'Coverage Gaps',
              color: 'border-red-500/20',
              desc: 'High-value Lab pages that are not appearing in GSC at all — not indexed, too new, or blocked. Surfaced against sitemap data for cross-reference.',
            },
            {
              title: 'Top Query Opportunities',
              color: 'border-emerald-500/20',
              desc: 'Queries where the platform is already ranking but CTR is below benchmark. The query text reveals intent — use it to rewrite the meta description.',
            },
            {
              title: 'Quick Wins',
              color: 'border-cyan-500/20',
              desc: 'Pages with near-benchmark CTR at a good position. Small changes — stronger title, updated date, added review schema — can push them to top 3.',
            },
          ].map(card => (
            <div key={card.title} className={cn('bg-zinc-900 border rounded-lg p-4', card.color)}>
              <h3 className="text-sm font-semibold text-white mb-1">{card.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function GSCOpsPage() {
  const snap   = loadGSCSnapshot()
  const report = getGSCIntelligenceReport()
  const pageOps   = getPageOpportunities(15)
  const queryOps  = getQueryOpportunities(15)
  const p2Cands   = getPosition2Candidates()
  const coverage  = getCoverageGaps()

  const highPriOps = pageOps.filter(o => o.priority === 'high')

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Link href="/ops" className="text-zinc-500 hover:text-zinc-300 text-sm">← Ops</Link>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-400 text-sm">Search Console</span>
        </div>
        <h1 className="text-2xl font-bold text-white mt-2">GSC Operations</h1>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-zinc-400 text-sm">Search Console intelligence — low CTR, page-2 candidates, coverage gaps</p>
          {report.hasData && report.dataAge !== null && (
            <span className={cn(
              'text-xs px-2 py-0.5 rounded border',
              report.dataAge <= 7
                ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10'
                : report.dataAge <= 30
                ? 'text-amber-400 border-amber-500/20 bg-amber-500/10'
                : 'text-red-400 border-red-500/20 bg-red-500/10'
            )}>
              Data {report.dataAge}d old
            </span>
          )}
        </div>
      </div>

      {!report.hasData ? <PendingState /> : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCell
              label="Total Impressions"
              value={report.summary.totalImpressions.toLocaleString()}
              sub="last 28 days"
            />
            <MetricCell
              label="Total Clicks"
              value={report.summary.totalClicks.toLocaleString()}
              sub={`${report.summary.avgCtr.toFixed(1)}% avg CTR`}
            />
            <MetricCell
              label="Avg Position"
              value={report.summary.avgPosition.toFixed(1)}
              sub="lower = better"
            />
            <MetricCell
              label="Opportunities"
              value={String(report.pageOpportunities.length + report.queryOpportunities.length)}
              sub={`${highPriOps.length} high priority`}
            />
          </div>

          {/* ── Page Opportunities ─────────────────────────────────────────── */}
          {pageOps.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-4">Page Opportunities</h2>
              <div className="space-y-2">
                {pageOps.map((opp, i) => {
                  const meta = OPPORTUNITY_LABELS[opp.opportunityType]
                  return (
                    <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <PriorityBadge priority={opp.priority} />
                            <span className={cn('text-xs font-medium', meta.color)}>{meta.label}</span>
                          </div>
                          <div className="text-sm text-zinc-300 font-mono truncate mb-1">{opp.page}</div>
                          <div className="text-xs text-zinc-500">{opp.action}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0 text-xs text-zinc-500">
                          <PositionBar position={opp.position} />
                          <span>{opp.impressions.toLocaleString()} imp</span>
                          <span className={opp.ctr < 2 ? 'text-red-400' : 'text-zinc-400'}>
                            {opp.ctr.toFixed(1)}% CTR
                          </span>
                        </div>
                      </div>
                      {opp.potentialClicks > opp.clicks && (
                        <div className="mt-2 pt-2 border-t border-zinc-800/60 flex items-center gap-1 text-xs text-emerald-400/70">
                          <span>↑ potential: +{(opp.potentialClicks - opp.clicks).toLocaleString()} clicks/month if CTR reaches benchmark</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Position 2 Candidates ──────────────────────────────────────── */}
          {p2Cands.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-1">
                Page 2 → Page 1 Candidates
              </h2>
              <p className="text-xs text-zinc-500 mb-4">
                Currently ranking 11-20. A targeted content improvement pushes these to page 1.
              </p>
              <div className="space-y-2">
                {p2Cands.map((opp, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 bg-zinc-900 border border-blue-500/10 rounded-lg px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-zinc-300 font-mono truncate mb-0.5">{opp.page}</div>
                      <div className="text-xs text-zinc-500">{opp.action}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <PositionBar position={opp.position} />
                      <span className="text-xs text-zinc-500">{opp.impressions} imp</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Query Opportunities ────────────────────────────────────────── */}
          {queryOps.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-4">Query Opportunities</h2>
              <div className="space-y-2">
                {queryOps.map((opp, i) => (
                  <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <PriorityBadge priority={opp.priority} />
                          <span className={cn('text-xs', OPPORTUNITY_LABELS[opp.opportunityType].color)}>
                            {OPPORTUNITY_LABELS[opp.opportunityType].label}
                          </span>
                        </div>
                        <div className="text-sm text-zinc-200 font-mono mb-0.5">"{opp.query}"</div>
                        <div className="text-xs text-zinc-500">{opp.action}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0 text-xs text-zinc-500">
                        <PositionBar position={opp.position} />
                        <span>{opp.impressions} imp</span>
                        <span>{opp.ctr.toFixed(1)}% CTR</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Coverage Gaps ──────────────────────────────────────────────── */}
          {coverage.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-4">
                Coverage Gaps
                <span className="ml-2 text-sm font-normal text-zinc-500">
                  {coverage.length} high-value pages not appearing in GSC
                </span>
              </h2>
              <div className="space-y-1.5">
                {coverage.map((gap, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 bg-zinc-900/60 border border-zinc-800 rounded px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-red-500 flex-shrink-0">✗</span>
                      <span className="text-sm font-mono text-zinc-400 truncate">{gap.labPath}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded border',
                        gap.potential === 'high'
                          ? 'text-amber-400 border-amber-500/20 bg-amber-500/10'
                          : 'text-zinc-500 border-zinc-700 bg-zinc-800'
                      )}>
                        {gap.potential} potential
                      </span>
                      <span className="text-zinc-600">{gap.reason.replace(/-/g, ' ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <section className="border-t border-zinc-800 pt-6">
        <div className="flex gap-4 text-sm">
          <Link href="/ops" className="text-zinc-400 hover:text-white transition-colors">← Ops Overview</Link>
          <Link href="/ops/seo" className="text-zinc-400 hover:text-white transition-colors">SEO Operations →</Link>
          <Link href="/ops/telemetry" className="text-zinc-400 hover:text-white transition-colors">Telemetry →</Link>
        </div>
      </section>

    </div>
  )
}
