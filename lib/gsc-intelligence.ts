/**
 * lib/gsc-intelligence.ts
 *
 * Google Search Console intelligence layer.
 *
 * Computes operational opportunities from the GSC telemetry snapshot:
 * - Low CTR pages (high impressions, low click-through)
 * - Position 2 candidates (ranking 11-20 — one push from page 1)
 * - Featured snippet candidates (ranking 3-10)
 * - Stale indexed pages (no impressions after 60+ days)
 * - Index coverage analysis against sitemap
 *
 * All functions read from loadGSCSnapshot() which loads data/telemetry/gsc.json.
 * Zero external API calls — pure snapshot analysis.
 */

import { loadGSCSnapshot, loadSitemapSnapshot, type GSCQuery, type GSCPage } from './telemetry'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type GSCOpportunityType =
  | 'low_ctr'              // impressions > threshold, CTR < 2%
  | 'position_2_candidate' // position 11-20 — one push from page 1
  | 'snippet_candidate'    // position 3-10, high impression
  | 'quick_win'            // position 4-10, CTR > avg, not yet #1
  | 'impression_spike'     // sudden impression growth — trending
  | 'click_floor'          // has clicks but very low impressions (niche authority)

export interface PageOpportunity {
  page:        string
  opportunityType: GSCOpportunityType
  impressions: number
  clicks:      number
  ctr:         number          // percentage
  position:    number
  priority:    'high' | 'medium' | 'low'
  action:      string          // specific recommended action
  potentialClicks: number      // estimated clicks if CTR improves to benchmark
}

export interface QueryOpportunity {
  query:       string
  opportunityType: GSCOpportunityType
  impressions: number
  clicks:      number
  ctr:         number
  position:    number
  priority:    'high' | 'medium' | 'low'
  action:      string
  targetPage?: string          // which page should target this query
}

export interface GSCCoverageGap {
  /** Lab page path not appearing in GSC at all */
  labPath:    string
  /** Reason why it might be missing */
  reason:     'not-indexed' | 'too-new' | 'low-crawl-priority' | 'noindex'
  /** Expected impression potential based on content type */
  potential:  'high' | 'medium' | 'low'
}

export interface GSCIntelligenceReport {
  hasData:            boolean
  dataAge:            number | null   // days since last GSC export
  pageOpportunities:  PageOpportunity[]
  queryOpportunities: QueryOpportunity[]
  coverageGaps:       GSCCoverageGap[]
  summary: {
    totalImpressions:     number
    totalClicks:          number
    avgCtr:               number
    avgPosition:          number
    lowCtrPageCount:      number
    position2CandidateCount: number
    quickWinCount:        number
    coverageGapCount:     number
    topOpportunityPage:   GSCPage | null
    topOpportunityQuery:  GSCQuery | null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Build-time cache
// ─────────────────────────────────────────────────────────────────────────────

let _cached: GSCIntelligenceReport | null = null

// ─────────────────────────────────────────────────────────────────────────────
// Benchmarks
// ─────────────────────────────────────────────────────────────────────────────

// Industry benchmark CTRs by position (Google organic)
const POSITION_CTR_BENCHMARK: Record<number, number> = {
  1: 27.6,
  2: 15.8,
  3: 11.0,
  4:  8.1,
  5:  6.1,
  6:  4.5,
  7:  3.4,
  8:  2.6,
  9:  2.0,
  10: 1.5,
}

function benchmarkCtr(position: number): number {
  const floor = Math.floor(position)
  return POSITION_CTR_BENCHMARK[Math.min(floor, 10)] ?? 1.0
}

// ─────────────────────────────────────────────────────────────────────────────
// Page opportunity analysis
// ─────────────────────────────────────────────────────────────────────────────

function analyzePageOpportunities(pages: GSCPage[], avgCtr: number): PageOpportunity[] {
  const opportunities: PageOpportunity[] = []

  for (const page of pages) {
    const benchCtr = benchmarkCtr(page.position)

    // Low CTR — significant impressions but CTR well below position benchmark
    if (page.impressions >= 50 && page.ctr < benchCtr * 0.5) {
      const potentialClicks = Math.round(page.impressions * benchCtr / 100)
      opportunities.push({
        page:            page.page,
        opportunityType: 'low_ctr',
        impressions:     page.impressions,
        clicks:          page.clicks,
        ctr:             page.ctr,
        position:        page.position,
        priority:        page.impressions > 500 ? 'high' : page.impressions > 100 ? 'medium' : 'low',
        action:          `Rewrite title/description to improve CTR — current ${page.ctr.toFixed(1)}% vs ${benchCtr.toFixed(1)}% benchmark for position ${Math.round(page.position)}`,
        potentialClicks,
      })
    }

    // Position 2 candidate — ranking 11-20 on a real search query
    if (page.position >= 11 && page.position <= 20 && page.impressions >= 20) {
      opportunities.push({
        page:            page.page,
        opportunityType: 'position_2_candidate',
        impressions:     page.impressions,
        clicks:          page.clicks,
        ctr:             page.ctr,
        position:        page.position,
        priority:        page.impressions > 100 ? 'high' : 'medium',
        action:          `Strengthen content depth — currently position ${page.position.toFixed(1)}, page 2. Add more specific operational detail and internal links.`,
        potentialClicks: Math.round(page.impressions * benchmarkCtr(5) / 100),
      })
    }

    // Featured snippet candidate — position 3-10, enough impressions
    if (page.position >= 3 && page.position <= 10 && page.impressions >= 100) {
      opportunities.push({
        page:            page.page,
        opportunityType: 'snippet_candidate',
        impressions:     page.impressions,
        clicks:          page.clicks,
        ctr:             page.ctr,
        position:        page.position,
        priority:        'medium',
        action:          `Add a direct answer block at the top — structured definition or numbered list. Position ${page.position.toFixed(1)} is eligible for featured snippet.`,
        potentialClicks: Math.round(page.impressions * benchmarkCtr(1) / 100),
      })
    }

    // Quick win — good position, CTR is already near benchmark
    if (
      page.position >= 4 && page.position <= 10 &&
      page.ctr >= benchCtr * 0.7 &&
      page.impressions >= 50
    ) {
      opportunities.push({
        page:            page.page,
        opportunityType: 'quick_win',
        impressions:     page.impressions,
        clicks:          page.clicks,
        ctr:             page.ctr,
        position:        page.position,
        priority:        'medium',
        action:          `Content quality is working — strengthen with internal links and evidence. Position ${page.position.toFixed(1)} with ${page.ctr.toFixed(1)}% CTR is near benchmark.`,
        potentialClicks: Math.round(page.impressions * benchmarkCtr(Math.max(1, page.position - 2)) / 100),
      })
    }
  }

  // Deduplicate: one entry per page (highest priority)
  const seen = new Map<string, PageOpportunity>()
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  for (const opp of opportunities) {
    const existing = seen.get(opp.page)
    if (!existing || priorityOrder[opp.priority] < priorityOrder[existing.priority]) {
      seen.set(opp.page, opp)
    }
  }

  return [...seen.values()]
    .sort((a, b) => {
      const pd = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
      return pd !== 0 ? pd : b.impressions - a.impressions
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Query opportunity analysis
// ─────────────────────────────────────────────────────────────────────────────

function analyzeQueryOpportunities(queries: GSCQuery[], avgCtr: number): QueryOpportunity[] {
  const opportunities: QueryOpportunity[] = []

  for (const q of queries) {
    const benchCtr = benchmarkCtr(q.position)

    if (q.impressions >= 20 && q.ctr < benchCtr * 0.5) {
      opportunities.push({
        query:           q.query,
        opportunityType: 'low_ctr',
        impressions:     q.impressions,
        clicks:          q.clicks,
        ctr:             q.ctr,
        position:        q.position,
        priority:        q.impressions > 200 ? 'high' : q.impressions > 50 ? 'medium' : 'low',
        action:          `Query "${q.query}" at position ${q.position.toFixed(1)} needs title/description that directly answers the query. CTR ${q.ctr.toFixed(1)}% vs ${benchCtr.toFixed(1)}% benchmark.`,
      })
    }

    if (q.position >= 11 && q.position <= 20 && q.impressions >= 10) {
      opportunities.push({
        query:           q.query,
        opportunityType: 'position_2_candidate',
        impressions:     q.impressions,
        clicks:          q.clicks,
        ctr:             q.ctr,
        position:        q.position,
        priority:        q.impressions > 50 ? 'high' : 'medium',
        action:          `"${q.query}" at position ${q.position.toFixed(1)} — create or expand content directly answering this query.`,
      })
    }
  }

  return opportunities
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 30)
}

// ─────────────────────────────────────────────────────────────────────────────
// Coverage gap analysis (sitemap vs GSC)
// ─────────────────────────────────────────────────────────────────────────────

function analyzeCoverageGaps(
  topPages: GSCPage[],
  sitemapUrls: string[],
  indexingIssues: string[]
): GSCCoverageGap[] {
  const indexedPages = new Set(topPages.map(p => p.page.replace(/\/$/, '')))
  const gaps: GSCCoverageGap[] = []

  // High-value Lab paths that should be indexed
  const HIGH_VALUE_PATHS = [
    '/failures', '/playbooks', '/tracks', '/case-studies', '/start-here',
    '/docs/what-is-operational-evidence', '/docs/geo-intelligence-architecture',
    '/docs/platform-vision-architecture',
  ]

  for (const path of HIGH_VALUE_PATHS) {
    const fullUrl = `https://lab.asquaresolution.com${path}`
    if (!indexedPages.has(fullUrl)) {
      gaps.push({
        labPath:   path,
        reason:    'not-indexed',
        potential: path.includes('tracks') || path.includes('failures') || path.includes('start-here')
          ? 'high' : 'medium',
      })
    }
  }

  // Add known indexing issues from GSC snapshot
  for (const issue of indexingIssues) {
    gaps.push({
      labPath:   issue,
      reason:    'not-indexed',
      potential: 'medium',
    })
  }

  return gaps
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function getGSCIntelligenceReport(): GSCIntelligenceReport {
  if (_cached) return _cached

  const snap    = loadGSCSnapshot()
  const sitemap = loadSitemapSnapshot()

  const hasData = snap.totalImpressions > 0 || snap.topPages.length > 0

  let dataAge: number | null = null
  if (snap._meta.lastUpdated) {
    const updatedMs = new Date(snap._meta.lastUpdated).getTime()
    dataAge = Math.floor((Date.now() - updatedMs) / 86400000)
  }

  const sitemapUrls = (sitemap.results ?? []).map((r) => r.url)

  const pageOpportunities  = analyzePageOpportunities(snap.topPages ?? [], snap.avgCtr)
  const queryOpportunities = analyzeQueryOpportunities(snap.topQueries ?? [], snap.avgCtr)
  const coverageGaps       = analyzeCoverageGaps(
    snap.topPages ?? [],
    sitemapUrls,
    snap.indexingIssues ?? []
  )

  const sortedByImpressions = [...(snap.topPages ?? [])].sort((a, b) => b.impressions - a.impressions)
  const sortedQueryByImp    = [...(snap.topQueries ?? [])].sort((a, b) => b.impressions - a.impressions)

  const report: GSCIntelligenceReport = {
    hasData,
    dataAge,
    pageOpportunities,
    queryOpportunities,
    coverageGaps,
    summary: {
      totalImpressions:        snap.totalImpressions,
      totalClicks:             snap.totalClicks,
      avgCtr:                  snap.avgCtr,
      avgPosition:             snap.avgPosition,
      lowCtrPageCount:         pageOpportunities.filter(p => p.opportunityType === 'low_ctr').length,
      position2CandidateCount: pageOpportunities.filter(p => p.opportunityType === 'position_2_candidate').length,
      quickWinCount:           pageOpportunities.filter(p => p.opportunityType === 'quick_win').length,
      coverageGapCount:        coverageGaps.length,
      topOpportunityPage:      sortedByImpressions[0] ?? null,
      topOpportunityQuery:     sortedQueryByImp[0] ?? null,
    },
  }

  _cached = report
  return report
}

/** Top N page opportunities, optionally filtered by type */
export function getPageOpportunities(
  n = 10,
  type?: GSCOpportunityType
): PageOpportunity[] {
  const report = getGSCIntelligenceReport()
  const items = type
    ? report.pageOpportunities.filter(p => p.opportunityType === type)
    : report.pageOpportunities
  return items.slice(0, n)
}

/** Top N query opportunities */
export function getQueryOpportunities(n = 10): QueryOpportunity[] {
  return getGSCIntelligenceReport().queryOpportunities.slice(0, n)
}

/** Pages with position 11-20 — one optimization push from page 1 */
export function getPosition2Candidates(): PageOpportunity[] {
  return getPageOpportunities(20, 'position_2_candidate')
}

/** Coverage gap summary */
export function getCoverageGaps(): GSCCoverageGap[] {
  return getGSCIntelligenceReport().coverageGaps
}

/** Opportunity type display metadata */
export const OPPORTUNITY_LABELS: Record<GSCOpportunityType, { label: string; color: string; desc: string }> = {
  low_ctr:            { label: 'Low CTR',          color: 'text-amber-400',  desc: 'High impressions, low click-through — title/description problem' },
  position_2_candidate: { label: 'Page 2 →1',      color: 'text-blue-400',   desc: 'Ranking 11-20 — targeted improvement can reach page 1' },
  snippet_candidate:  { label: 'Snippet Target',    color: 'text-purple-400', desc: 'Position 3-10 with high impressions — add direct answer block' },
  quick_win:          { label: 'Quick Win',         color: 'text-emerald-400',desc: 'Near-benchmark CTR at good position — small push to top 3' },
  impression_spike:   { label: 'Trending',          color: 'text-cyan-400',   desc: 'Rapid impression growth — capitalize now' },
  click_floor:        { label: 'Click Floor',       color: 'text-zinc-400',   desc: 'Low impressions but consistent clicks — niche authority' },
}
