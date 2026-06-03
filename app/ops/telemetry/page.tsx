import Link from 'next/link'
import type { Metadata } from 'next'
import {
  getTelemetrySummary,
  computeDeploymentHealth,
  computeSitemapHealth,
  computePerformanceHealth,
  computeSearchHealth,
  computeUptimeHealth,
  TIER_STYLES,
  formatDuration,
  formatAge,
  type HealthTier,
  type LighthouseRun,
} from '@/lib/telemetry'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Telemetry — Operational Intelligence',
  description: 'Deployment health, sitemap status, performance scores, uptime, and search visibility across the A Square Solutions ecosystem.',
  robots: { index: false, follow: false },
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function HealthBadge({ tier }: { tier: HealthTier }) {
  const st = TIER_STYLES[tier]
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase rounded px-2 py-0.5 border',
      st.text, st.bg, st.border
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', st.dot)} />
      {st.label}
    </span>
  )
}

function StatRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <p className="text-[10px] text-surface-600">{label}</p>
      <span className={cn('text-[11px] font-mono font-semibold', color ?? 'text-surface-400')}>{value}</span>
    </div>
  )
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color =
    score >= 90 ? 'bg-green-500' :
    score >= 70 ? 'bg-yellow-500' :
    score >= 50 ? 'bg-orange-500' : 'bg-red-500'

  const textColor =
    score >= 90 ? 'text-green-400' :
    score >= 70 ? 'text-yellow-400' :
    score >= 50 ? 'text-orange-400' : 'text-red-400'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-surface-600">{label}</p>
        <span className={cn('text-[10px] font-mono font-semibold', textColor)}>{score}</span>
      </div>
      <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

function SectionHeader({ title, tier, action }: { title: string; tier: HealthTier; action?: { href: string; label: string } }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600">{title}</h2>
        <HealthBadge tier={tier} />
      </div>
      {action && (
        <Link href={action.href} className="text-[10px] font-mono text-surface-700 hover:text-brand-400 transition-colors">
          {action.label} →
        </Link>
      )}
    </div>
  )
}

function NoDataCard({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-xl border border-white/[0.05] border-dashed p-5 text-center space-y-1.5">
      <p className="text-[11px] text-surface-500 font-medium">{title}</p>
      <p className="text-[10px] text-surface-700 font-mono">{hint}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Lighthouse run card
// ─────────────────────────────────────────────────────────────

function LighthouseCard({ run }: { run: LighthouseRun }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-surface-300">{run.label}</p>
        <span className="text-[10px] font-mono text-surface-700">{formatAge(run.runAt)}</span>
      </div>
      <div className="space-y-2">
        <ScoreBar score={run.scores.performance}   label="Performance" />
        <ScoreBar score={run.scores.accessibility} label="Accessibility" />
        <ScoreBar score={run.scores.seo}           label="SEO" />
        <ScoreBar score={run.scores.bestPractices} label="Best Practices" />
      </div>
      {run.metrics && (
        <div className="mt-3 pt-3 border-t border-white/[0.05] grid grid-cols-2 gap-x-4 gap-y-1">
          {run.metrics.lcp  != null && <StatRow label="LCP"  value={`${run.metrics.lcp}ms`}  />}
          {run.metrics.fcp  != null && <StatRow label="FCP"  value={`${run.metrics.fcp}ms`}  />}
          {run.metrics.tbt  != null && <StatRow label="TBT"  value={`${run.metrics.tbt}ms`}  />}
          {run.metrics.ttfb != null && <StatRow label="TTFB" value={`${run.metrics.ttfb}ms`} />}
          {run.metrics.cls  != null && <StatRow label="CLS"  value={run.metrics.cls.toFixed(3)} />}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function TelemetryPage() {
  const summary     = getTelemetrySummary()
  const deployment  = computeDeploymentHealth()
  const sitemap     = computeSitemapHealth()
  const performance = computePerformanceHealth()
  const search      = computeSearchHealth()
  const uptime      = computeUptimeHealth()

  const overallStyles = TIER_STYLES[summary.overallTier]

  return (
    <div className="px-6 lg:px-8 py-8 max-w-5xl">

      {/* ── Header ── */}
      <div className="mb-8 pb-6 border-b border-white/[0.05]">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest rounded px-2 py-1 border text-surface-500 bg-surface-800/60 border-surface-700/40">
            TELEMETRY
          </span>
          <Link href="/ops" className="text-[10px] font-mono text-surface-700 hover:text-brand-400 transition-colors">
            ← Ops
          </Link>
          <HealthBadge tier={summary.overallTier} />
          {summary.lastRefresh && (
            <span className="text-[10px] font-mono text-surface-700">
              refreshed {formatAge(summary.lastRefresh)}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-50">
          Operational Telemetry
        </h1>
        <p className="mt-1 text-sm text-surface-500">
          Deployment health · sitemap · performance · uptime · search visibility
        </p>
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {([
          { label: 'Deployments',  tier: deployment.tier,  value: deployment.hasData  ? `${deployment.buildSuccessRate}%`  : '—', sub: 'success rate' },
          { label: 'Sitemap',      tier: sitemap.tier,     value: sitemap.hasData     ? `${sitemap.passRate}%`             : '—', sub: `${sitemap.totalUrls} URLs` },
          { label: 'Performance',  tier: performance.tier, value: performance.hasData ? `${performance.avgPerformance}`    : '—', sub: 'avg Lighthouse' },
          { label: 'Uptime',       tier: uptime.tier,      value: uptime.hasData      ? uptime.allUp ? 'All up' : `${uptime.downCount} down` : '—', sub: `${uptime.checks.length} properties` },
          { label: 'Search',       tier: search.hasData ? 'healthy' : 'unknown' as HealthTier, value: search.hasData ? search.totalClicks.toLocaleString() : '—', sub: 'total clicks' },
        ] as const).map(({ label, tier, value, sub }) => {
          const st = TIER_STYLES[tier]
          return (
            <div key={label} className={cn('rounded-xl border px-4 py-3', st.border, st.bg)}>
              <p className="text-[10px] font-mono text-surface-700 uppercase tracking-wider mb-1">{label}</p>
              <p className={cn('text-xl font-bold font-mono', st.text)}>{value}</p>
              <p className="text-[10px] text-surface-700 mt-0.5">{sub}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Deployment health */}
          <div>
            <SectionHeader title="Deployment Health" tier={deployment.tier} />
            {!deployment.hasData ? (
              <NoDataCard
                title="No deployment data"
                hint="Run: node scripts/ingest-vercel.mjs"
              />
            ) : (
              <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                {/* Metrics */}
                <div className="grid grid-cols-3 divide-x divide-white/[0.05] border-b border-white/[0.05]">
                  {[
                    { label: 'Success rate',  value: `${deployment.buildSuccessRate}%`, color: deployment.buildSuccessRate >= 90 ? 'text-green-400' : deployment.buildSuccessRate >= 70 ? 'text-yellow-400' : 'text-red-400' },
                    { label: 'Avg build',     value: deployment.avgBuildDuration ? formatDuration(deployment.avgBuildDuration) : '—', color: 'text-surface-400' },
                    { label: 'Consec. fails', value: deployment.consecutiveFailures, color: deployment.consecutiveFailures > 0 ? 'text-red-400' : 'text-green-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="px-4 py-3 text-center">
                      <p className="text-[9px] font-mono text-surface-700 uppercase tracking-wider mb-1">{label}</p>
                      <p className={cn('text-lg font-bold font-mono', color)}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Recent deployments */}
                {deployment.recentDeployments.length > 0 && (
                  <div className="divide-y divide-white/[0.04]">
                    {deployment.recentDeployments.slice(0, 8).map(d => {
                      const stateColor =
                        d.state === 'READY'    ? 'text-green-400' :
                        d.state === 'ERROR'    ? 'text-red-400'   :
                        d.state === 'BUILDING' ? 'text-yellow-400 animate-pulse' : 'text-surface-600'
                      const stateDot =
                        d.state === 'READY'    ? 'bg-green-500' :
                        d.state === 'ERROR'    ? 'bg-red-500'   :
                        d.state === 'BUILDING' ? 'bg-yellow-400 animate-pulse' : 'bg-surface-600'

                      return (
                        <div key={d.uid} className="flex items-center gap-3 px-4 py-2.5">
                          <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', stateDot)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-surface-400 truncate">
                              {d.commitMessage || '(no message)'}
                            </p>
                            <p className="text-[10px] font-mono text-surface-700 mt-0.5">
                              {d.branch} · {d.commitSha}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {d.buildDuration && (
                              <span className="text-[10px] font-mono text-surface-700 hidden sm:block">
                                {formatDuration(d.buildDuration)}
                              </span>
                            )}
                            <span className={cn('text-[10px] font-mono', stateColor)}>{d.state}</span>
                            <span className="text-[10px] font-mono text-surface-700">{formatAge(d.createdAt)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="px-4 py-2.5 border-t border-white/[0.05]">
                  <p className="text-[10px] font-mono text-surface-700">
                    refresh: node scripts/ingest-vercel.mjs
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sitemap health */}
          <div>
            <SectionHeader title="Sitemap Health" tier={sitemap.tier} />
            {!sitemap.hasData ? (
              <NoDataCard
                title="No sitemap data"
                hint="Run: node scripts/ingest-sitemap.mjs"
              />
            ) : (
              <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                <div className="grid grid-cols-3 divide-x divide-white/[0.05] border-b border-white/[0.05]">
                  {[
                    { label: 'Pass rate',  value: `${sitemap.passRate}%`,     color: sitemap.passRate >= 99 ? 'text-green-400' : sitemap.passRate >= 90 ? 'text-yellow-400' : 'text-red-400' },
                    { label: 'Total URLs', value: sitemap.totalUrls,          color: 'text-surface-400' },
                    { label: 'Failing',    value: sitemap.failingUrls.length, color: sitemap.failingUrls.length > 0 ? 'text-red-400' : 'text-green-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="px-4 py-3 text-center">
                      <p className="text-[9px] font-mono text-surface-700 uppercase tracking-wider mb-1">{label}</p>
                      <p className={cn('text-lg font-bold font-mono', color)}>{value}</p>
                    </div>
                  ))}
                </div>

                {sitemap.failingUrls.length > 0 && (
                  <div className="divide-y divide-white/[0.04]">
                    <p className="px-4 py-2 text-[10px] font-mono text-red-400 uppercase tracking-wide border-b border-white/[0.04]">
                      Failing URLs
                    </p>
                    {sitemap.failingUrls.slice(0, 10).map(r => (
                      <div key={r.url} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-[10px] font-mono text-red-400 shrink-0 w-10 text-right">
                          {r.status ?? 'ERR'}
                        </span>
                        <span className="text-[10px] font-mono text-surface-500 truncate">{r.url}</span>
                        {r.latencyMs && (
                          <span className="text-[10px] font-mono text-surface-700 shrink-0">{r.latencyMs}ms</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {sitemap.failingUrls.length === 0 && (
                  <div className="px-4 py-3">
                    <p className="text-[10px] text-green-400 font-mono">✓ All checked URLs returning 200</p>
                  </div>
                )}

                <div className="px-4 py-2.5 border-t border-white/[0.05]">
                  <p className="text-[10px] font-mono text-surface-700">
                    refresh: node scripts/ingest-sitemap.mjs [--full]
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Search Console */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600">
                Search Visibility
              </h2>
              {!search.hasData && (
                <span className="text-[10px] font-mono text-surface-700">no data</span>
              )}
            </div>
            {!search.hasData ? (
              <NoDataCard
                title="No GSC data"
                hint="Export from GSC → run: node scripts/ingest-gsc.mjs <path/to/export.csv>"
              />
            ) : (
              <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                {/* Metrics strip */}
                <div className="grid grid-cols-4 divide-x divide-white/[0.05] border-b border-white/[0.05]">
                  {[
                    { label: 'Clicks',      value: search.totalClicks.toLocaleString(),      color: 'text-green-400' },
                    { label: 'Impressions', value: search.totalImpressions.toLocaleString(), color: 'text-blue-400' },
                    { label: 'Avg Position', value: search.avgPosition?.toFixed(1) ?? '—',  color: search.avgPosition && search.avgPosition <= 10 ? 'text-green-400' : 'text-yellow-400' },
                    { label: 'Issues',       value: search.indexingIssues.length,             color: search.indexingIssues.length > 0 ? 'text-red-400' : 'text-green-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="px-3 py-3 text-center">
                      <p className="text-[9px] font-mono text-surface-700 uppercase tracking-wider mb-1">{label}</p>
                      <p className={cn('text-base font-bold font-mono', color)}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Top queries */}
                {search.topQueries.length > 0 && (
                  <div className="divide-y divide-white/[0.04]">
                    <p className="px-4 py-2 text-[10px] font-mono text-surface-700 uppercase tracking-wide">
                      Top Queries
                    </p>
                    {search.topQueries.slice(0, 8).map(q => (
                      <div key={q.query} className="flex items-center gap-2 px-4 py-2">
                        <p className="text-[11px] text-surface-400 flex-1 min-w-0 truncate">{q.query}</p>
                        <div className="flex items-center gap-3 shrink-0 text-[10px] font-mono">
                          <span className="text-green-400 w-8 text-right">{q.clicks}</span>
                          <span className="text-surface-700 w-12 text-right hidden sm:block">{q.impressions.toLocaleString()}</span>
                          <span className="text-surface-600 w-8 text-right">#{q.position.toFixed(0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="px-4 py-2.5 border-t border-white/[0.05]">
                  <p className="text-[10px] font-mono text-surface-700">
                    refresh: node scripts/ingest-gsc.mjs path/to/export.csv
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ── Right column ── */}
        <div className="space-y-6">

          {/* Uptime */}
          <div>
            <SectionHeader title="Uptime" tier={uptime.tier} />
            {!uptime.hasData ? (
              <NoDataCard
                title="No uptime data"
                hint="Run: node scripts/ingest-uptime.mjs"
              />
            ) : (
              <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
                {uptime.checks.map(c => {
                  const dot =
                    c.status === 'up'       ? 'bg-green-500' :
                    c.status === 'degraded' ? 'bg-yellow-400 animate-pulse' : 'bg-red-500 animate-pulse'
                  const text =
                    c.status === 'up'       ? 'text-green-400' :
                    c.status === 'degraded' ? 'text-yellow-400' : 'text-red-400'

                  return (
                    <div key={c.property} className="flex items-center gap-3 px-4 py-2.5">
                      <div className={cn('w-2 h-2 rounded-full shrink-0', dot)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-surface-400">{c.property}</p>
                        {c.latencyMs && (
                          <p className="text-[10px] font-mono text-surface-700">{c.latencyMs}ms</p>
                        )}
                      </div>
                      <span className={cn('text-[10px] font-mono shrink-0', text)}>
                        {c.httpCode ?? c.status}
                      </span>
                    </div>
                  )
                })}
                <div className="px-4 py-2.5">
                  <p className="text-[10px] font-mono text-surface-700">node scripts/ingest-uptime.mjs</p>
                </div>
              </div>
            )}
          </div>

          {/* Performance */}
          <div>
            <SectionHeader title="Performance" tier={performance.tier} />
            {!performance.hasData ? (
              <NoDataCard
                title="No Lighthouse data"
                hint="Run: node scripts/ingest-lighthouse.mjs"
              />
            ) : performance.latestRun ? (
              <div className="space-y-3">
                <LighthouseCard run={performance.latestRun} />
                <div className="rounded-xl border border-white/[0.06] px-4 py-3">
                  <p className="text-[10px] font-mono text-surface-700 mb-1">Avg across all runs</p>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-[9px] font-mono text-surface-700 mb-0.5">Perf</p>
                      <p className={cn('text-sm font-bold font-mono', performance.avgPerformance && performance.avgPerformance >= 90 ? 'text-green-400' : 'text-yellow-400')}>
                        {performance.avgPerformance ?? '—'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] font-mono text-surface-700 mb-0.5">SEO</p>
                      <p className={cn('text-sm font-bold font-mono', performance.avgSeo && performance.avgSeo >= 90 ? 'text-green-400' : 'text-yellow-400')}>
                        {performance.avgSeo ?? '—'}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] font-mono text-surface-700 px-1">
                  node scripts/ingest-lighthouse.mjs
                </p>
              </div>
            ) : null}
          </div>

          {/* Refresh commands */}
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-3">
              Refresh Commands
            </h2>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 space-y-2">
              {[
                { label: 'All',         cmd: 'node scripts/ingest-uptime.mjs && node scripts/ingest-sitemap.mjs' },
                { label: 'Deployments', cmd: 'node scripts/ingest-vercel.mjs' },
                { label: 'Sitemap',     cmd: 'node scripts/ingest-sitemap.mjs' },
                { label: 'Lighthouse',  cmd: 'node scripts/ingest-lighthouse.mjs' },
                { label: 'GSC',         cmd: 'node scripts/ingest-gsc.mjs <path>' },
                { label: 'Uptime',      cmd: 'node scripts/ingest-uptime.mjs' },
              ].map(({ label, cmd }) => (
                <div key={label}>
                  <p className="text-[9px] font-mono text-surface-700 uppercase tracking-wide mb-0.5">{label}</p>
                  <code className="text-[10px] font-mono text-surface-500 break-all">{cmd}</code>
                </div>
              ))}
            </div>
          </div>

          {/* Env vars required */}
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-3">
              Required Env Vars
            </h2>
            <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
              {[
                { key: 'VERCEL_TOKEN',       required: true,  for: 'ingest-vercel' },
                { key: 'VERCEL_PROJECT_ID',  required: true,  for: 'ingest-vercel' },
                { key: 'VERCEL_TEAM_ID',     required: false, for: 'ingest-vercel (team)' },
                { key: 'PAGESPEED_API_KEY',  required: false, for: 'ingest-lighthouse' },
              ].map(({ key, required, for: forScript }) => {
                const isSet = !!process.env[key]
                return (
                  <div key={key} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-[10px] font-mono text-surface-500">{key}</p>
                      <p className="text-[9px] font-mono text-surface-700">{forScript}</p>
                    </div>
                    <span className={cn(
                      'text-[10px] font-mono',
                      isSet ? 'text-green-400' : required ? 'text-red-400' : 'text-surface-700'
                    )}>
                      {isSet ? '✓ set' : required ? '✗ missing' : 'optional'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
