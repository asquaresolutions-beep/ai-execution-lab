/**
 * lib/telemetry.ts
 *
 * Operational Telemetry Layer — Phase 1 of the Autonomous Intelligence System.
 *
 * Loads JSON snapshots from data/telemetry/ at build time.
 * Snapshots are written by ingestion scripts in scripts/ingest-*.mjs.
 *
 * Data flow:
 *   scripts/ingest-*.mjs  →  data/telemetry/*.json  →  lib/telemetry.ts  →  pages
 *
 * All functions are server-side only (file system access).
 * Zero external API calls at render time — pure snapshot reads.
 */

import fs   from 'fs'
import path from 'path'

// ─────────────────────────────────────────────────────────────────────────────
// Types — Deployment Health
// ─────────────────────────────────────────────────────────────────────────────

export type DeploymentState =
  | 'READY'
  | 'ERROR'
  | 'BUILDING'
  | 'QUEUED'
  | 'CANCELED'
  | 'unknown'

export interface DeploymentRecord {
  uid:           string
  url:           string
  state:         DeploymentState
  createdAt:     string   // ISO
  buildDuration: number | null   // seconds
  branch:        string
  commitMessage: string
  commitSha:     string
  meta: {
    buildStarted:   string | null
    buildCompleted: string | null
  }
}

export interface DeploymentSnapshot {
  _meta:       { lastUpdated: string; projectId: string }
  deployments: DeploymentRecord[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Types — Sitemap Health
// ─────────────────────────────────────────────────────────────────────────────

export interface SitemapUrlResult {
  url:        string
  status:     number | null
  ok:         boolean
  latencyMs:  number | null
  checkedAt:  string
}

export interface SitemapSnapshot {
  _meta:       { lastUpdated: string }
  sitemapUrl:  string
  httpStatus:  number | null
  totalUrls:   number
  checkedUrls: number
  passing:     number
  failing:     number
  errors:      string[]
  results:     SitemapUrlResult[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Types — Lighthouse
// ─────────────────────────────────────────────────────────────────────────────

export interface LighthouseRun {
  url:         string
  label:       string
  runAt:       string
  scores: {
    performance:   number   // 0-100
    accessibility: number
    bestPractices: number
    seo:           number
  }
  metrics: {
    fcp:   number | null   // ms — First Contentful Paint
    lcp:   number | null   // ms — Largest Contentful Paint
    tbt:   number | null   // ms — Total Blocking Time
    cls:   number | null   // score — Cumulative Layout Shift
    ttfb:  number | null   // ms — Time to First Byte
  }
}

export interface LighthouseSnapshot {
  _meta: { lastUpdated: string }
  runs:  LighthouseRun[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Types — Google Search Console
// ─────────────────────────────────────────────────────────────────────────────

export interface GSCQuery {
  query:       string
  clicks:      number
  impressions: number
  ctr:         number
  position:    number
}

export interface GSCPage {
  page:        string
  clicks:      number
  impressions: number
  ctr:         number
  position:    number
}

export interface GSCSnapshot {
  _meta:            { lastUpdated: string }
  property:         string
  dateRange:        { start: string; end: string } | null
  totalClicks:      number
  totalImpressions: number
  avgCtr:           number
  avgPosition:      number
  topQueries:       GSCQuery[]
  topPages:         GSCPage[]
  indexingIssues:   string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Types — Uptime
// ─────────────────────────────────────────────────────────────────────────────

export type UptimeStatus = 'up' | 'down' | 'degraded' | 'unknown'

export interface UptimeCheck {
  property:   string
  url:        string
  status:     UptimeStatus
  httpCode:   number | null
  latencyMs:  number | null
  checkedAt:  string
  error?:     string
}

export interface UptimeSnapshot {
  _meta:  { lastUpdated: string }
  checks: UptimeCheck[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Types — Computed Health
// ─────────────────────────────────────────────────────────────────────────────

export type HealthTier = 'healthy' | 'warning' | 'critical' | 'unknown'

export interface DeploymentHealth {
  lastDeploy:         DeploymentRecord | null
  recentDeployments:  DeploymentRecord[]
  buildSuccessRate:   number      // 0-100, last 10 builds
  avgBuildDuration:   number | null   // seconds
  consecutiveFailures: number
  tier:               HealthTier
  hasData:            boolean
}

export interface SitemapHealth {
  passRate:     number   // 0-100
  totalUrls:    number
  failingUrls:  SitemapUrlResult[]
  sitemapUp:    boolean
  tier:         HealthTier
  hasData:      boolean
}

export interface PerformanceHealth {
  latestRun:      LighthouseRun | null
  avgPerformance: number | null
  avgSeo:         number | null
  tier:           HealthTier
  hasData:        boolean
}

export interface SearchHealth {
  totalClicks:      number
  totalImpressions: number
  avgPosition:      number | null
  topQueries:       GSCQuery[]
  topPages:         GSCPage[]
  indexingIssues:   string[]
  tier:             HealthTier
  hasData:          boolean
}

export interface UptimeHealth {
  allUp:       boolean
  downCount:   number
  checks:      UptimeCheck[]
  tier:        HealthTier
  hasData:     boolean
}

export interface TelemetrySummary {
  deployment:  DeploymentHealth
  sitemap:     SitemapHealth
  performance: PerformanceHealth
  search:      SearchHealth
  uptime:      UptimeHealth
  overallTier: HealthTier
  lastRefresh: string | null   // most recent snapshot update across all sources
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot loaders
// ─────────────────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data', 'telemetry')

function loadSnapshot<T>(filename: string, fallback: T): T {
  try {
    const fp  = path.join(DATA_DIR, filename)
    if (!fs.existsSync(fp)) return fallback
    const raw = fs.readFileSync(fp, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function loadDeploymentSnapshot(): DeploymentSnapshot {
  return loadSnapshot<DeploymentSnapshot>('deployments.json', {
    _meta:       { lastUpdated: '', projectId: '' },
    deployments: [],
  })
}

export function loadSitemapSnapshot(): SitemapSnapshot {
  return loadSnapshot<SitemapSnapshot>('sitemap-health.json', {
    _meta:       { lastUpdated: '' },
    sitemapUrl:  '',
    httpStatus:  null,
    totalUrls:   0,
    checkedUrls: 0,
    passing:     0,
    failing:     0,
    errors:      [],
    results:     [],
  })
}

export function loadLighthouseSnapshot(): LighthouseSnapshot {
  return loadSnapshot<LighthouseSnapshot>('lighthouse.json', {
    _meta: { lastUpdated: '' },
    runs:  [],
  })
}

export function loadGSCSnapshot(): GSCSnapshot {
  return loadSnapshot<GSCSnapshot>('gsc.json', {
    _meta:            { lastUpdated: '' },
    property:         '',
    dateRange:        null,
    totalClicks:      0,
    totalImpressions: 0,
    avgCtr:           0,
    avgPosition:      0,
    topQueries:       [],
    topPages:         [],
    indexingIssues:   [],
  })
}

export function loadUptimeSnapshot(): UptimeSnapshot {
  return loadSnapshot<UptimeSnapshot>('uptime.json', {
    _meta:  { lastUpdated: '' },
    checks: [],
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Health computers
// ─────────────────────────────────────────────────────────────────────────────

function tierFromScore(score: number): HealthTier {
  if (score >= 90) return 'healthy'
  if (score >= 60) return 'warning'
  return 'critical'
}

export function computeDeploymentHealth(): DeploymentHealth {
  const snap = loadDeploymentSnapshot()
  const all  = snap.deployments ?? []

  if (all.length === 0) {
    return {
      lastDeploy:          null,
      recentDeployments:   [],
      buildSuccessRate:    0,
      avgBuildDuration:    null,
      consecutiveFailures: 0,
      tier:                'unknown',
      hasData:             false,
    }
  }

  const recent   = all.slice(0, 10)
  const success  = recent.filter(d => d.state === 'READY').length
  const rate     = Math.round((success / recent.length) * 100)

  const durations = recent
    .filter(d => d.buildDuration != null)
    .map(d => d.buildDuration as number)
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null

  let consecutive = 0
  for (const d of all) {
    if (d.state === 'ERROR') consecutive++
    else break
  }

  const tier: HealthTier =
    consecutive >= 3   ? 'critical' :
    consecutive >= 1   ? 'warning'  :
    rate < 70          ? 'warning'  :
    rate >= 90         ? 'healthy'  : 'warning'

  return {
    lastDeploy:          all[0] ?? null,
    recentDeployments:   recent,
    buildSuccessRate:    rate,
    avgBuildDuration:    avgDuration,
    consecutiveFailures: consecutive,
    tier,
    hasData:             true,
  }
}

export function computeSitemapHealth(): SitemapHealth {
  const snap = loadSitemapSnapshot()

  if (!snap.checkedUrls) {
    return {
      passRate:    0,
      totalUrls:   0,
      failingUrls: [],
      sitemapUp:   false,
      tier:        'unknown',
      hasData:     false,
    }
  }

  const passRate    = snap.checkedUrls > 0
    ? Math.round((snap.passing / snap.checkedUrls) * 100)
    : 0
  const failingUrls = (snap.results ?? []).filter(r => !r.ok)
  const sitemapUp   = snap.httpStatus === 200

  return {
    passRate,
    totalUrls:   snap.totalUrls,
    failingUrls,
    sitemapUp,
    tier:        !sitemapUp ? 'critical' : tierFromScore(passRate),
    hasData:     true,
  }
}

export function computePerformanceHealth(): PerformanceHealth {
  const snap = loadLighthouseSnapshot()
  const runs = snap.runs ?? []

  if (runs.length === 0) {
    return {
      latestRun:      null,
      avgPerformance: null,
      avgSeo:         null,
      tier:           'unknown',
      hasData:        false,
    }
  }

  const latestRun = runs[runs.length - 1]
  const avgPerf   = Math.round(runs.reduce((a, r) => a + r.scores.performance, 0) / runs.length)
  const avgSeo    = Math.round(runs.reduce((a, r) => a + r.scores.seo, 0) / runs.length)

  return {
    latestRun,
    avgPerformance: avgPerf,
    avgSeo,
    tier:           tierFromScore(Math.min(avgPerf, avgSeo)),
    hasData:        true,
  }
}

export function computeSearchHealth(): SearchHealth {
  const snap       = loadGSCSnapshot()
  const hasData    = (snap.totalImpressions ?? 0) > 0
  const issueCount = (snap.indexingIssues ?? []).length
  const tier: HealthTier = !hasData
    ? 'unknown'
    : issueCount > 5 ? 'critical'
    : issueCount > 0 ? 'warning'
    : 'healthy'

  return {
    totalClicks:      snap.totalClicks      ?? 0,
    totalImpressions: snap.totalImpressions ?? 0,
    avgPosition:      snap.avgPosition      ?? null,
    topQueries:       (snap.topQueries      ?? []).slice(0, 10),
    topPages:         (snap.topPages        ?? []).slice(0, 10),
    indexingIssues:   snap.indexingIssues   ?? [],
    tier,
    hasData,
  }
}

export function computeUptimeHealth(): UptimeHealth {
  const snap   = loadUptimeSnapshot()
  const checks = snap.checks ?? []

  if (checks.length === 0) {
    return { allUp: false, downCount: 0, checks: [], tier: 'unknown', hasData: false }
  }

  const downCount = checks.filter(c => c.status !== 'up').length
  const allUp     = downCount === 0

  return {
    allUp,
    downCount,
    checks,
    tier:    downCount > 0 ? 'critical' : 'healthy',
    hasData: true,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Master summary
// ─────────────────────────────────────────────────────────────────────────────

export function getTelemetrySummary(): TelemetrySummary {
  const deployment  = computeDeploymentHealth()
  const sitemap     = computeSitemapHealth()
  const performance = computePerformanceHealth()
  const search      = computeSearchHealth()
  const uptime      = computeUptimeHealth()

  // Collect snapshot timestamps
  const timestamps = [
    loadDeploymentSnapshot()._meta?.lastUpdated,
    loadSitemapSnapshot()._meta?.lastUpdated,
    loadLighthouseSnapshot()._meta?.lastUpdated,
    loadGSCSnapshot()._meta?.lastUpdated,
    loadUptimeSnapshot()._meta?.lastUpdated,
  ].filter(Boolean).sort().reverse()

  const lastRefresh = timestamps[0] ?? null

  // Overall tier: worst of any known tier
  const knownTiers: HealthTier[] = [
    deployment.tier, sitemap.tier, performance.tier, uptime.tier,
  ].filter(t => t !== 'unknown') as HealthTier[]

  const overallTier: HealthTier =
    knownTiers.includes('critical') ? 'critical' :
    knownTiers.includes('warning')  ? 'warning'  :
    knownTiers.every(t => t === 'healthy') ? 'healthy' : 'unknown'

  return { deployment, sitemap, performance, search, uptime, overallTier, lastRefresh }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

export function formatAge(isoDate: string): string {
  if (!isoDate) return '—'
  const ms   = Date.now() - new Date(isoDate).getTime()
  const mins  = Math.floor(ms / 60_000)
  const hours = Math.floor(ms / 3_600_000)
  const days  = Math.floor(ms / 86_400_000)
  if (days > 0)  return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0)  return `${mins}m ago`
  return 'just now'
}

export const TIER_STYLES: Record<HealthTier, {
  dot:    string
  text:   string
  bg:     string
  border: string
  label:  string
}> = {
  healthy: {
    dot:    'bg-green-500',
    text:   'text-green-400',
    bg:     'bg-green-500/10',
    border: 'border-green-500/20',
    label:  'Healthy',
  },
  warning: {
    dot:    'bg-yellow-400',
    text:   'text-yellow-400',
    bg:     'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    label:  'Warning',
  },
  critical: {
    dot:    'bg-red-500 animate-pulse',
    text:   'text-red-400',
    bg:     'bg-red-500/10',
    border: 'border-red-500/20',
    label:  'Critical',
  },
  unknown: {
    dot:    'bg-surface-600',
    text:   'text-surface-600',
    bg:     'bg-white/[0.02]',
    border: 'border-white/[0.06]',
    label:  'No data',
  },
}
