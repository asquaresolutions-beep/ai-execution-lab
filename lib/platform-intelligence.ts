/**
 * lib/platform-intelligence.ts
 * Phase 5 + 6 — Autonomous Retrieval, Guidance, and Long-Term Platform Direction
 *
 * Composite platform maturity scoring across 6 dimensions.
 * Produces a single operational readiness score, tiered maturity label,
 * next-milestone description, and ranked recovery/action guidance.
 *
 * All computation is build-time static — no API calls.
 */

import { getAllMeta }                       from './content'
import { getFailureMemorySummary, getPatternCoverage } from './failure-memory'
import { getQueryCoverage }                 from './geo-intelligence'
import { getOperationalSignals, getSignalSummary } from './operational-signals'
import { getContentIntelligenceSummary }    from './content-intelligence'
import { getTelemetrySummary }              from './telemetry'
import { ECOSYSTEM_PROPERTIES }            from './ecosystem'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type MaturityTier =
  | 'nascent'      // 0-25:  Platform exists; sparse content, low intelligence density
  | 'developing'   // 26-45: Growing corpus; some intelligence wired up
  | 'operational'  // 46-65: Self-aware; telemetry and signals functioning
  | 'mature'       // 66-80: Cross-system intelligence; GEO-ready
  | 'advanced'     // 81-100: Institutional memory; autonomous guidance operating

export interface DimensionScore {
  name:        string
  score:       number   // 0-100
  weight:      number   // relative weight in overall score (sums to 1.0)
  status:      'strong' | 'adequate' | 'weak'
  insight:     string   // one-line assessment
  topGap:      string   // most critical improvement for this dimension
}

export interface PlatformMaturityScore {
  overall:     number          // 0-100 weighted composite
  tier:        MaturityTier
  tierLabel:   string
  tierColor:   string          // tailwind text color
  nextMilestone: string
  dimensions:  DimensionScore[]
  signals:     { total: number; critical: number; high: number }
  topActions:  OperationalGuidance[]
}

export interface OperationalGuidance {
  id:          string
  category:    GuidanceCategory
  title:       string
  why:         string
  action:      string
  urgency:     'now' | 'this-week' | 'this-month'
  effort:      'low' | 'medium' | 'high'
  dimension:   string   // which maturity dimension this improves
}

export type GuidanceCategory =
  | 'deploy'         // deployment / infrastructure
  | 'debug'          // debugging / failure resolution
  | 'content'        // publishing / content work
  | 'geo'            // GEO / search visibility
  | 'telemetry'      // observability / data collection
  | 'knowledge'      // knowledge graph / entity work

// ─────────────────────────────────────────────────────────────
// Scoring logic
// ─────────────────────────────────────────────────────────────

function scoreContent(): DimensionScore {
  const sections  = ['docs', 'failures', 'logs', 'case-studies', 'playbooks', 'labs', 'systems'] as const
  const counts    = sections.map(s => ({ s, n: getAllMeta(s).length }))
  const total     = counts.reduce((n, c) => n + c.n, 0)

  // Breadth: how many sections have ≥ 3 items
  const populated = counts.filter(c => c.n >= 3).length
  const breadthPct = Math.round((populated / sections.length) * 100)

  // Depth: total item count (target: 50 for max)
  const depthPct   = Math.min(Math.round((total / 50) * 100), 100)

  const score = Math.round((breadthPct * 0.5) + (depthPct * 0.5))
  const thin  = counts.filter(c => c.n < 3).map(c => `/${c.s}`)

  return {
    name:    'Content',
    score,
    weight:  0.20,
    status:  score >= 70 ? 'strong' : score >= 40 ? 'adequate' : 'weak',
    insight: `${total} items across ${populated}/${sections.length} populated sections`,
    topGap:  thin.length > 0
      ? `Thin sections: ${thin.slice(0, 3).join(', ')}`
      : 'All sections meet minimum depth',
  }
}

function scoreEvidence(): DimensionScore {
  const evidenceSections = ['case-studies', 'failures', 'labs'] as const
  let withEvidence = 0
  let total        = 0

  for (const section of evidenceSections) {
    const items = getAllMeta(section)
    total += items.length
    withEvidence += items.filter(i =>
      (i.frontmatter.evidence_images?.length ?? 0) > 0 ||
      (i.frontmatter.external_refs?.length   ?? 0) > 0
    ).length
  }

  const pct   = total > 0 ? Math.round((withEvidence / total) * 100) : 0
  const score = pct  // directly maps to score

  return {
    name:    'Evidence',
    score,
    weight:  0.15,
    status:  score >= 70 ? 'strong' : score >= 40 ? 'adequate' : 'weak',
    insight: `${withEvidence}/${total} high-value items carry evidence`,
    topGap:  score < 70
      ? 'Add evidence_images or external_refs to case-studies and failures'
      : 'Evidence coverage is healthy',
  }
}

function scoreFailureIntelligence(): DimensionScore {
  const summary  = getFailureMemorySummary()
  const patterns = getPatternCoverage()

  // Confidence score mapped to 0-100
  const confScore = summary.avgConfidence

  // Coverage: % of patterns with a resolver playbook
  const coveredPatterns = patterns.filter(p => p.coveragePct >= 75).length
  const patternCoverage = patterns.length > 0
    ? Math.round((coveredPatterns / patterns.length) * 100)
    : 50  // no patterns yet — neutral

  // High confidence paths
  const highConfPct = summary.totalFailures > 0
    ? Math.round((summary.highConfidence / summary.totalFailures) * 100)
    : 0

  const score = Math.round((confScore * 0.4) + (patternCoverage * 0.3) + (highConfPct * 0.3))

  return {
    name:    'Failure Intelligence',
    score,
    weight:  0.20,
    status:  score >= 70 ? 'strong' : score >= 40 ? 'adequate' : 'weak',
    insight: `Avg confidence ${summary.avgConfidence}/100 · ${summary.highConfidence}/${summary.totalFailures} high-confidence paths`,
    topGap:  summary.avgConfidence < 70
      ? 'Write resolver playbooks for recurring failures to push confidence above 75'
      : 'Add more failure instances to verify fix reliability',
  }
}

function scoreGEO(): DimensionScore {
  const coverage = getQueryCoverage()
  const { coveragePct, owned, gaps } = coverage

  // Owned coverage is worth more (directly attributed to this platform)
  const ownedWithTarget = owned.filter(q => q.targetSlug).length
  const ownedCoverage   = owned.length > 0
    ? Math.round((ownedWithTarget / owned.length) * 100)
    : 0

  const score = Math.round((coveragePct * 0.5) + (ownedCoverage * 0.5))

  return {
    name:    'GEO Coverage',
    score,
    weight:  0.20,
    status:  score >= 70 ? 'strong' : score >= 40 ? 'adequate' : 'weak',
    insight: `${coveragePct}% query coverage · ${gaps.length} gap queries uncovered`,
    topGap:  gaps.length > 0
      ? `Cover top gap query: "${gaps[0]?.query ?? 'unknown'}"`
      : 'All tracked queries have content coverage',
  }
}

function scoreTelemetry(): DimensionScore {
  try {
    const telem = getTelemetrySummary()
    const tiers = [
      telem.deployment.tier,
      telem.sitemap.tier,
      telem.performance.tier,
      telem.uptime.tier,
      telem.search.tier,
    ]

    const tierScore = (t: string): number =>
      t === 'healthy' ? 100 : t === 'warning' ? 60 : t === 'critical' ? 20 : 10  // unknown = 10

    const avgScore   = Math.round(tiers.reduce((s, t) => s + tierScore(t), 0) / tiers.length)
    const unknownCnt = tiers.filter(t => t === 'unknown').length
    const hasData    = telem.deployment.hasData || telem.uptime.hasData || telem.sitemap.hasData

    // Penalise for missing data (scripts not yet run)
    const score = hasData ? avgScore : Math.round(avgScore * 0.3)

    return {
      name:    'Telemetry',
      score,
      weight:  0.125,
      status:  score >= 70 ? 'strong' : score >= 40 ? 'adequate' : 'weak',
      insight: hasData
        ? `${5 - unknownCnt}/5 telemetry subsystems have data`
        : 'No telemetry snapshots — run ingestion scripts',
      topGap:  unknownCnt > 0
        ? `Run ingestion scripts to populate ${unknownCnt} missing data source${unknownCnt > 1 ? 's' : ''}`
        : 'All telemetry sources active',
    }
  } catch {
    return {
      name:    'Telemetry',
      score:   10,
      weight:  0.125,
      status:  'weak',
      insight: 'Telemetry subsystem error',
      topGap:  'Run ingestion scripts to bootstrap telemetry data',
    }
  }
}

function scoreOperationalMemory(): DimensionScore {
  // Score based on signal health — fewer unresolved critical signals = more mature memory
  const summary  = getSignalSummary()
  const signals  = getOperationalSignals()

  // Penalise for open critical/high signals
  const penaltyPer = { critical: 15, high: 8, medium: 3, low: 1 } as const
  const penalty = Math.min(
    summary.critical * penaltyPer.critical +
    summary.high     * penaltyPer.high     +
    summary.medium   * penaltyPer.medium   +
    summary.low      * penaltyPer.low,
    70
  )

  const base  = 85   // start high — signals are the gaps, not the current state
  const score = Math.max(base - penalty, 15)

  // Count resolved signals (those where the signalled content exists and is well-covered)
  const unscoredCount = summary.byType?.unscored_failure ?? 0
  const patternGaps   = summary.byType?.pattern_gap ?? 0

  return {
    name:    'Operational Memory',
    score,
    weight:  0.125,
    status:  score >= 70 ? 'strong' : score >= 40 ? 'adequate' : 'weak',
    insight: `${summary.total} open signals · ${summary.critical} critical · ${summary.high} high`,
    topGap:  unscoredCount > 0
      ? `${unscoredCount} unscored failure${unscoredCount > 1 ? 's' : ''} missing from failure-memory.ts`
      : patternGaps > 0
      ? `${patternGaps} failure pattern${patternGaps > 1 ? 's' : ''} without resolver playbooks`
      : 'Close remaining operational signals',
  }
}

// ─────────────────────────────────────────────────────────────
// Guidance generation
// ─────────────────────────────────────────────────────────────

function buildGuidance(dimensions: DimensionScore[]): OperationalGuidance[] {
  const guidance: OperationalGuidance[] = []
  const summary        = getSignalSummary()
  const contentSummary = getContentIntelligenceSummary()
  const { gaps }       = getQueryCoverage()
  const failureSummary = getFailureMemorySummary()
  const telem          = getTelemetrySummary()

  // 1. Unscored failures (critical — blocks debug intelligence)
  if ((summary.byType?.unscored_failure ?? 0) > 0) {
    guidance.push({
      id:        'guidance:score-failures',
      category:  'debug',
      title:     `Score ${summary.byType?.unscored_failure} unscored failure${(summary.byType?.unscored_failure ?? 0) > 1 ? 's' : ''}`,
      why:       'Unscored failures block the DebugContextPanel and failure confidence system. Every unscored failure is dead intelligence.',
      action:    'Add each failure to RAW_FAILURES in lib/failure-memory.ts with instanceCount, hasPreventionSteps, hasPlaybook, and recoveryComplexity.',
      urgency:   'now',
      effort:    'low',
      dimension: 'Operational Memory',
    })
  }

  // 2. Telemetry data gap
  if (!telem.deployment.hasData && !telem.uptime.hasData) {
    guidance.push({
      id:        'guidance:run-telemetry',
      category:  'telemetry',
      title:     'Bootstrap telemetry — no snapshots exist',
      why:       'All 5 telemetry subsystems show "unknown". The telemetry dashboard is dark. This is the fastest single action that improves platform observability.',
      action:    'Run: node scripts/ingest-uptime.mjs && node scripts/ingest-sitemap.mjs — then commit data/telemetry/ snapshots.',
      urgency:   'now',
      effort:    'low',
      dimension: 'Telemetry',
    })
  }

  // 3. GEO gaps with immediate window
  if (contentSummary.immediateCount > 0 && gaps.length > 0) {
    guidance.push({
      id:        `guidance:geo-gap:${gaps[0].query.slice(0, 30)}`,
      category:  'geo',
      title:     `Cover top GEO gap: "${gaps[0].query}"`,
      why:       `This ${gaps[0].category} query has no content target. AI systems cannot cite this platform for this intent. ${contentSummary.immediateCount} gap queries are at "immediate" priority.`,
      action:    `Write a ${gaps[0].category === 'definitional' ? 'definitional doc' : 'procedural guide'} that directly answers: "${gaps[0].query}". Answer-first paragraph, then depth.`,
      urgency:   'this-week',
      effort:    'medium',
      dimension: 'GEO Coverage',
    })
  }

  // 4. Resolver playbooks for recurring failures
  const recurringNoPlaybook = failureSummary.totalFailures > 0
    ? getContentIntelligenceSummary().bySource?.['failure-coverage'] ?? 0
    : 0
  if (recurringNoPlaybook > 0) {
    guidance.push({
      id:        'guidance:playbooks',
      category:  'debug',
      title:     `Write resolver playbooks for ${recurringNoPlaybook} recurring failure${recurringNoPlaybook > 1 ? 's' : ''}`,
      why:       'Recurring failures without playbooks regenerate investigation debt on each occurrence. A single playbook converts a recurring cost into a one-time investment.',
      action:    'Use /publish#ai-workflow template. Document: trigger → diagnosis → fix → prevention. Link to the failure archive entry.',
      urgency:   'this-week',
      effort:    'medium',
      dimension: 'Failure Intelligence',
    })
  }

  // 5. Thin sections
  const thinCount = contentSummary.bySource?.['section-depth'] ?? 0
  if (thinCount > 0) {
    guidance.push({
      id:        'guidance:thin-sections',
      category:  'content',
      title:     `Populate ${thinCount} thin section${thinCount > 1 ? 's' : ''} to minimum depth`,
      why:       'Sections with < 3 items lack credibility and query coverage. Thin sections also suppressed by GEO systems that favour corpus depth.',
      action:    'Extract content from recent operational work. Do not fabricate — document what was actually executed.',
      urgency:   'this-week',
      effort:    'high',
      dimension: 'Content',
    })
  }

  // 6. Evidence gaps
  const evidenceGaps = contentSummary.bySource?.['evidence-gap'] ?? 0
  if (evidenceGaps > 0) {
    guidance.push({
      id:        'guidance:evidence',
      category:  'content',
      title:     'Add evidence to high-value content items',
      why:       'Evidence-free content has lower GEO citation probability and reduced trust signals. This is the highest-ROI frontmatter work — takes 5 minutes per item.',
      action:    'Add evidence_images: or external_refs: to case-studies, failures, and labs frontmatter. Start with the most recently published item.',
      urgency:   'this-month',
      effort:    'low',
      dimension: 'Evidence',
    })
  }

  // Sort: now → this-week → this-month, then by effort (low first)
  const urgencyOrder = { now: 0, 'this-week': 1, 'this-month': 2 } as const
  const effortOrder  = { low: 0, medium: 1, high: 2 } as const
  return guidance.sort((a, b) =>
    urgencyOrder[a.urgency] - urgencyOrder[b.urgency] ||
    effortOrder[a.effort]   - effortOrder[b.effort]
  )
}

// ─────────────────────────────────────────────────────────────
// Maturity tier
// ─────────────────────────────────────────────────────────────

function classifyTier(score: number): {
  tier: MaturityTier; label: string; color: string; nextMilestone: string
} {
  if (score >= 81) return {
    tier:           'advanced',
    label:          'Advanced',
    color:          'text-brand-400',
    nextMilestone:  'Maintain institutional memory velocity. Expand cross-ecosystem intelligence.',
  }
  if (score >= 66) return {
    tier:           'mature',
    label:          'Mature',
    color:          'text-green-400',
    nextMilestone:  'Close remaining GEO coverage gaps. Establish 100% failure scoring.',
  }
  if (score >= 46) return {
    tier:           'operational',
    label:          'Operational',
    color:          'text-yellow-400',
    nextMilestone:  'Bootstrap telemetry data. Fill thin sections. Reach 60% GEO query coverage.',
  }
  if (score >= 26) return {
    tier:           'developing',
    label:          'Developing',
    color:          'text-orange-400',
    nextMilestone:  'Score all failures. Publish playbooks for recurring patterns. Activate telemetry.',
  }
  return {
    tier:           'nascent',
    label:          'Nascent',
    color:          'text-red-400',
    nextMilestone:  'Establish minimum content depth (3+ items per section). Score at least 5 failures.',
  }
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

let _cachedScore: PlatformMaturityScore | null = null

/**
 * Compute and return the full platform maturity score.
 * Memoized for the build/request lifetime.
 */
export function getPlatformMaturityScore(): PlatformMaturityScore {
  if (_cachedScore) return _cachedScore

  const dimensions: DimensionScore[] = [
    scoreContent(),
    scoreEvidence(),
    scoreFailureIntelligence(),
    scoreGEO(),
    scoreTelemetry(),
    scoreOperationalMemory(),
  ]

  // Weighted composite
  const overall = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * d.weight, 0)
  )

  const { tier, label: tierLabel, color: tierColor, nextMilestone } = classifyTier(overall)
  const signalSummary = getSignalSummary()
  const guidance      = buildGuidance(dimensions)

  _cachedScore = {
    overall,
    tier,
    tierLabel,
    tierColor,
    nextMilestone,
    dimensions,
    signals: {
      total:    signalSummary.total,
      critical: signalSummary.critical,
      high:     signalSummary.high,
    },
    topActions: guidance,
  }
  return _cachedScore
}

/**
 * Get just the overall score and tier — for embedding in other pages.
 */
export function getPlatformTier(): { score: number; tier: MaturityTier; tierLabel: string; tierColor: string } {
  const m = getPlatformMaturityScore()
  return { score: m.overall, tier: m.tier, tierLabel: m.tierLabel, tierColor: m.tierColor }
}
