/**
 * lib/operational-signals.ts
 * Operational signal detection — surfaces gaps, risks, and blind spots
 * in the platform's operational intelligence coverage.
 *
 * This is the platform's self-awareness layer: it scans the content corpus,
 * entity graph, and failure memory to identify what needs attention.
 *
 * Signal types:
 *   unscored_failure    — failure MDX exists but no failure-memory entry
 *   low_confidence_fix  — confidence score < 60 (single instance, no playbook)
 *   pattern_gap         — named pattern with ≥2 failures but no resolver playbook
 *   missing_playbook    — recurring failure (instanceCount ≥ 2) without a playbook
 *   stale_section       — section with no activity past configured threshold
 *   single_instance     — high/critical severity failure with only 1 confirmed instance
 *
 * All computation happens at build time (server-side only).
 */

import { getAllMeta } from './content'
import { getFailureMemory }  from './failure-memory'
import { ENTITIES, RELATIONSHIPS } from './operational-memory'
import { ECOSYSTEM_PROPERTIES } from './ecosystem'
import { GEO_QUERY_TAXONOMY, type QueryCategory } from './geo-intelligence'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type SignalType =
  | 'unscored_failure'     // new failure not yet in failure-memory table
  | 'low_confidence_fix'   // confidence < 60
  | 'pattern_gap'          // pattern with failures but no playbook
  | 'missing_playbook'     // recurring failure without a resolver playbook
  | 'stale_section'        // section inactive past threshold
  | 'single_instance'      // high-severity failure with instanceCount = 1
  // Phase 5 — Autonomous Operational Signals
  | 'weak_evidence'        // content section with no evidence images or external citations
  | 'missing_case_study'   // execution track with no associated case study
  | 'entity_inconsistency' // entity names in content diverge from canonical PLATFORM_ENTITIES
  | 'unhealthy_cadence'    // publishing velocity below minimum viable threshold
  | 'missing_geo_coverage' // track or cluster missing GEO-optimised entry
  | 'no_failure_coverage'  // system/doc with no linked failure archive entry
  // Phase 1 (Autonomous Signal Engine) — deeper self-awareness
  | 'stale_assumption'     // doc with no updated: field and > 60 days old — procedure may be stale
  | 'underdeveloped_track' // execution area with < 3 total content items
  | 'publishing_imbalance' // one section has 5× more items than the lowest populated section
  | 'operational_blind_spot' // ecosystem property with zero docs and zero failure coverage
  | 'weak_geo_cluster'     // GEO query category where 0 queries have a content target
  | 'low_link_density'     // high-severity failures with no related lessons or playbooks

export type SignalPriority = 'critical' | 'high' | 'medium' | 'low'

export interface OperationalSignal {
  id:             string
  type:           SignalType
  priority:       SignalPriority
  title:          string
  description:    string
  /** What to do to resolve this signal */
  actionableHint: string
  relatedSlug?:   string
  relatedHref?:   string
  relatedSection?: string
  detectedAt:     string
  /** Suggested template to address this signal */
  template?:      'failure-report' | 'execution-log' | 'deployment-journal' | 'seo-experiment' | 'case-study' | 'ai-workflow'
}

export interface SignalSummary {
  total:    number
  critical: number
  high:     number
  medium:   number
  low:      number
  byType:   Record<SignalType, number>
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

/** Days without new content before a section is flagged as stale */
const STALE_THRESHOLDS: Record<string, number> = {
  failures:       14,
  logs:           7,
  'case-studies': 30,
  labs:           30,
  playbooks:      45,
}

const PRIORITY_ORDER: Record<SignalPriority, number> = {
  critical: 0,
  high:     1,
  medium:   2,
  low:      3,
}

// ─────────────────────────────────────────────────────────────
// Detection functions
// ─────────────────────────────────────────────────────────────

function detectUnscoredFailures(today: string): OperationalSignal[] {
  const allFailures  = getAllMeta('failures')
  const memoryEntries = getFailureMemory()
  const memorySlugs  = new Set(memoryEntries.map(m => m.slug))
  const signals: OperationalSignal[] = []

  for (const f of allFailures) {
    if (!memorySlugs.has(f.slug)) {
      signals.push({
        id:             `unscored:${f.slug}`,
        type:           'unscored_failure',
        priority:       'high',
        title:          `Unscored failure: ${f.frontmatter.title}`,
        description:    'This failure report is published but has no entry in lib/failure-memory.ts. Confidence scoring, pattern coverage, and the DebugContextPanel all depend on this table.',
        actionableHint: 'Add an entry to RAW_FAILURES in lib/failure-memory.ts with instanceCount, hasPreventionSteps, hasPlaybook, recoveryComplexity.',
        relatedSlug:    f.slug,
        relatedHref:    `/failures/${f.slug}`,
        relatedSection: 'failures',
        detectedAt:     today,
        template:       'failure-report',
      })
    }
  }
  return signals
}

function detectLowConfidence(today: string): OperationalSignal[] {
  const memoryEntries = getFailureMemory()
  const signals: OperationalSignal[] = []

  for (const m of memoryEntries) {
    if (m.confidenceScore < 60) {
      const why = m.instanceCount < 2
        ? 'single confirmed instance — fix reliability unverified'
        : !m.hasPlaybook
          ? 'no resolver playbook — recovery procedure undocumented'
          : 'insufficient prevention documentation'

      signals.push({
        id:             `low-confidence:${m.slug}`,
        type:           'low_confidence_fix',
        priority:       m.confidenceScore < 50 ? 'high' : 'medium',
        title:          `Low confidence: ${m.title} (${m.confidenceScore}/100)`,
        description:    `Fix confidence is ${m.confidenceScore}/100. Root cause: ${why}. Low-confidence fixes are flagged in the Failure Archive to guide debugging decisions.`,
        actionableHint: m.instanceCount < 2
          ? 'Document a second encounter to confirm fix reliability, or add a resolver playbook.'
          : 'Write a resolver playbook referencing this failure to push confidence above 75.',
        relatedSlug:    m.slug,
        relatedHref:    m.href,
        relatedSection: 'failures',
        detectedAt:     today,
        template:       'failure-report',
      })
    }
  }
  return signals
}

function detectPatternGaps(today: string): OperationalSignal[] {
  const signals: OperationalSignal[] = []
  const patternEntities = ENTITIES.filter(e => e.type === 'pattern')

  // Build a set of failure IDs that have resolver playbooks
  const failuresWithPlaybooks = new Set(
    RELATIONSHIPS
      .filter(r => r.type === 'resolved-by')
      .map(r => r.from)
  )

  for (const pattern of patternEntities) {
    // Find failures that exemplify this pattern
    const failureIds = RELATIONSHIPS
      .filter(r => r.to === pattern.id && r.type === 'exemplifies')
      .map(r => r.from)

    if (failureIds.length < 2) continue  // single instance patterns don't need playbooks yet

    const anyHasPlaybook = failureIds.some(id => failuresWithPlaybooks.has(id))
    if (!anyHasPlaybook) {
      signals.push({
        id:             `pattern-gap:${pattern.id}`,
        type:           'pattern_gap',
        priority:       failureIds.length >= 3 ? 'high' : 'medium',
        title:          `Pattern without resolver: ${pattern.title}`,
        description:    `${failureIds.length} documented failures exemplify this pattern, but no resolver playbook exists. A playbook would provide a reusable resolution procedure for future occurrences.`,
        actionableHint: `Write a playbook documenting the canonical fix for "${pattern.title}" failures. Link it from each member failure.`,
        relatedHref:    pattern.href,
        relatedSection: 'playbooks',
        detectedAt:     today,
        template:       'ai-workflow',
      })
    }
  }
  return signals
}

function detectMissingPlaybooks(today: string): OperationalSignal[] {
  const signals: OperationalSignal[] = []
  const memoryEntries = getFailureMemory()

  // Failures with ≥2 instances but no playbook that weren't already caught by pattern gap
  const failuresWithPlaybooks = new Set(
    RELATIONSHIPS.filter(r => r.type === 'resolved-by').map(r => r.from)
  )

  for (const m of memoryEntries) {
    if (m.instanceCount >= 2 && !m.hasPlaybook) {
      const hasPatternPlaybookSignal = m.patterns.some(patternId => {
        const siblings = RELATIONSHIPS
          .filter(r => r.to === patternId && r.type === 'exemplifies')
          .map(r => r.from)
        return siblings.length >= 2
      })
      // Skip if already covered by a pattern_gap signal
      if (hasPatternPlaybookSignal) continue

      const failureEntityId = `failure:${m.slug}`
      if (!failuresWithPlaybooks.has(failureEntityId)) {
        signals.push({
          id:             `missing-playbook:${m.slug}`,
          type:           'missing_playbook',
          priority:       'medium',
          title:          `Recurring failure without playbook: ${m.title}`,
          description:    `This failure has ${m.instanceCount} confirmed instances but no resolver playbook. Recurring failures without documented resolution procedures create repeated investigation overhead.`,
          actionableHint: 'Write a resolver playbook and link it using resolved-by in lib/operational-memory.ts.',
          relatedSlug:    m.slug,
          relatedHref:    m.href,
          relatedSection: 'playbooks',
          detectedAt:     today,
          template:       'ai-workflow',
        })
      }
    }
  }
  return signals
}

function detectStaleSections(today: string): OperationalSignal[] {
  const signals: OperationalSignal[] = []
  const now = new Date()

  for (const [section, threshold] of Object.entries(STALE_THRESHOLDS)) {
    const items = getAllMeta(section as Parameters<typeof getAllMeta>[0])

    if (items.length === 0) {
      signals.push({
        id:             `stale:${section}`,
        type:           'stale_section',
        priority:       'low',
        title:          `No content in /${section}`,
        description:    `The ${section} section has no published content. An empty section signals no operational activity of the relevant type.`,
        actionableHint: `Publish at least one ${section} entry from real operational work.`,
        relatedSection: section,
        detectedAt:     today,
      })
      continue
    }

    const sorted = [...items].sort(
      (a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime()
    )
    const lastDate    = sorted[0].frontmatter.date
    const daysSince   = Math.floor((now.getTime() - new Date(lastDate).getTime()) / 86_400_000)

    if (daysSince > threshold) {
      signals.push({
        id:             `stale:${section}`,
        type:           'stale_section',
        priority:       daysSince > threshold * 2 ? 'medium' : 'low',
        title:          `${section} inactive for ${daysSince} days`,
        description:    `Last ${section} entry was ${daysSince} days ago (${lastDate}). Target cadence: at least one entry every ${threshold} days.`,
        actionableHint: `Publish a new ${section} entry from recent operational work.`,
        relatedSection: section,
        detectedAt:     today,
      })
    }
  }
  return signals
}

// ─────────────────────────────────────────────────────────────
// Phase 5 Detection — Autonomous Operational Signals
// ─────────────────────────────────────────────────────────────

function detectWeakEvidence(today: string): OperationalSignal[] {
  const signals: OperationalSignal[] = []
  const sections = ['case-studies', 'labs', 'logs'] as const

  for (const section of sections) {
    const items = getAllMeta(section)
    const withoutEvidence = items.filter(item => {
      const fm = item.frontmatter
      // Evidence is weak if: no evidence_images field AND no external links mentioned
      const hasEvidence = fm.evidence_images && (fm.evidence_images as unknown[]).length > 0
      const hasExternalRefs = fm.external_refs && (fm.external_refs as unknown[]).length > 0
      return !hasEvidence && !hasExternalRefs
    })

    if (withoutEvidence.length > 3) {
      signals.push({
        id:             `weak-evidence:${section}`,
        type:           'weak_evidence',
        priority:       withoutEvidence.length > 8 ? 'medium' : 'low',
        title:          `${withoutEvidence.length} ${section} entries lack evidence`,
        description:    `${withoutEvidence.length} of ${items.length} ${section} entries have no evidence_images or external_refs in frontmatter. Evidence-backed content has higher GEO citation potential and trust signals.`,
        actionableHint: `Add evidence_images: [] or external_refs: [] to frontmatter for recent ${section} entries. Even one screenshot or source link counts.`,
        relatedSection: section,
        detectedAt:     today,
      })
    }
  }
  return signals
}

function detectMissingCaseStudies(today: string): OperationalSignal[] {
  const signals: OperationalSignal[] = []
  const caseStudies = getAllMeta('case-studies')
  const csTags = new Set(
    caseStudies.flatMap(c => (c.frontmatter.tags as string[] | undefined) ?? [])
  )

  // Check each track — does it have a case study with a matching tag?
  // Use track IDs as the canonical reference
  const TRACK_IDS_NEEDING_CASE_STUDIES = [
    'claude-code-operator',
    'vercel-next-deployment',
    'firebase-production',
    'seo-content-operations',
  ]

  for (const trackId of TRACK_IDS_NEEDING_CASE_STUDIES) {
    const trackSlug = trackId.replace(/-/g, ' ').toLowerCase()
    const covered = [...csTags].some(tag =>
      tag.toLowerCase().includes(trackId.split('-')[0]) ||
      tag.toLowerCase().includes(trackSlug.split(' ')[0])
    ) || caseStudies.some(c =>
      (c.frontmatter.title as string ?? '').toLowerCase().includes(trackId.split('-')[0])
    )

    if (!covered) {
      signals.push({
        id:             `missing-case-study:${trackId}`,
        type:           'missing_case_study',
        priority:       'low',
        title:          `No case study for track: ${trackId}`,
        description:    `The "${trackId}" execution track has no associated case study. Case studies are the highest-value GEO content type — they demonstrate real outcomes against named entities and tools.`,
        actionableHint: `Write a case study documenting one complete deployment or project from the ${trackId} track. Include outcomes, metrics, and a before/after comparison.`,
        relatedSection: 'case-studies',
        detectedAt:     today,
        template:       'case-study',
      })
    }
  }
  return signals
}

function detectUnhealthyCadence(today: string, signals: OperationalSignal[]): OperationalSignal[] {
  // Uses existing stale_section data — if ≥3 sections are stale simultaneously,
  // it's a systemic cadence problem, not just one section lagging.
  const staleSectionSignals = signals.filter(s => s.type === 'stale_section')
  if (staleSectionSignals.length >= 3) {
    return [{
      id:             'unhealthy-cadence:systemic',
      type:           'unhealthy_cadence',
      priority:       staleSectionSignals.length >= 5 ? 'high' : 'medium',
      title:          `Publishing cadence collapse — ${staleSectionSignals.length} sections stale`,
      description:    `${staleSectionSignals.length} content sections have exceeded their inactivity threshold simultaneously. This indicates a systemic publishing velocity problem, not isolated section neglect.`,
      actionableHint: 'Schedule a content sprint. Publish at least one item in each stale section within 7 days. Use the /publish page quick-capture templates.',
      relatedSection: 'logs',
      detectedAt:     today,
    }]
  }
  return []
}

function detectMissingGEOCoverage(today: string): OperationalSignal[] {
  const signals: OperationalSignal[] = []
  const docs  = getAllMeta('docs')
  const labs  = getAllMeta('labs')
  const allContent = [...docs, ...labs]

  // GEO coverage: each core platform entity should have at least one definitional doc
  const GEO_REQUIRED_COVERAGE = [
    { entity: 'Claude Code',   check: (title: string) => title.toLowerCase().includes('claude') },
    { entity: 'Vercel',        check: (title: string) => title.toLowerCase().includes('vercel') },
    { entity: 'Firebase',      check: (title: string) => title.toLowerCase().includes('firebase') },
    { entity: 'GEO',           check: (title: string) => title.toLowerCase().includes('geo') || title.toLowerCase().includes('generative engine') },
    { entity: 'Next.js',       check: (title: string) => title.toLowerCase().includes('next') },
  ]

  for (const item of GEO_REQUIRED_COVERAGE) {
    const covered = allContent.some(c =>
      item.check(c.frontmatter.title as string ?? '')
    )
    if (!covered) {
      signals.push({
        id:             `missing-geo:${item.entity.toLowerCase().replace(/\s+/g, '-')}`,
        type:           'missing_geo_coverage',
        priority:       'low',
        title:          `No GEO-optimised entry for: ${item.entity}`,
        description:    `No doc or lab entry exists with "${item.entity}" in its title. Entity coverage gaps reduce AI search citation probability for this topic cluster.`,
        actionableHint: `Write a definitional doc or lab entry covering "${item.entity}" with answer-first paragraphs, named entities, and structured FAQs.`,
        relatedSection: 'docs',
        detectedAt:     today,
      })
    }
  }
  return signals
}

function detectSingleInstanceHighSeverity(today: string): OperationalSignal[] {
  const signals: OperationalSignal[] = []
  const memoryEntries = getFailureMemory()

  for (const m of memoryEntries) {
    if (
      m.instanceCount === 1 &&
      (m.severity === 'high' || m.severity === 'critical') &&
      m.confidenceScore < 70
    ) {
      signals.push({
        id:             `single-instance:${m.slug}`,
        type:           'single_instance',
        priority:       'low',
        title:          `Single-instance high-severity: ${m.title}`,
        description:    `This ${m.severity}-severity failure has only 1 documented instance. High-severity single-instance failures have lower fix confidence until a second occurrence confirms the root cause.`,
        actionableHint: 'Watch for recurrence. When it hits a second time, update instanceCount in lib/failure-memory.ts to boost confidence.',
        relatedSlug:    m.slug,
        relatedHref:    m.href,
        relatedSection: 'failures',
        detectedAt:     today,
      })
    }
  }
  return signals
}

// ─────────────────────────────────────────────────────────────
// Phase 1 — Autonomous Signal Engine (deeper self-awareness)
// ─────────────────────────────────────────────────────────────

/**
 * Docs with no `updated:` field and age > 60 days.
 * Operational procedures become stale — readers need a freshness signal.
 */
function detectStaleAssumptions(today: string): OperationalSignal[] {
  const signals: OperationalSignal[] = []
  const now      = Date.now()
  const STALE_MS = 60 * 24 * 60 * 60 * 1000
  const docs     = getAllMeta('docs')

  const stale = docs.filter(d => {
    if (d.frontmatter.updated) return false
    return now - new Date(d.frontmatter.date).getTime() > STALE_MS
  })

  if (stale.length > 0) {
    const oldest = stale[stale.length - 1]
    signals.push({
      id:             `stale-assumption:docs`,
      type:           'stale_assumption',
      priority:       stale.length >= 5 ? 'medium' : 'low',
      title:          `${stale.length} doc${stale.length > 1 ? 's' : ''} may contain stale operational assumptions`,
      description:    `${stale.length} docs have no updated: frontmatter field and are 60+ days old. Without freshness metadata, readers cannot gauge whether procedures still reflect current platform state.`,
      actionableHint: `Review "${oldest.frontmatter.title}" first (oldest). If still accurate, add updated: ${today}. If outdated, revise the procedure section before adding the timestamp.`,
      relatedSlug:    oldest.slug,
      relatedHref:    `/docs/${oldest.slug}`,
      relatedSection: 'docs',
      detectedAt:     today,
    })
  }
  return signals
}

/**
 * Content areas (mapped loosely to tech clusters) with < 3 items total across docs + labs + failures.
 * Thin coverage of a topic area = operational blind spot in that domain.
 */
function detectUnderdevelopedTracks(today: string): OperationalSignal[] {
  const signals: OperationalSignal[] = []
  const docs     = getAllMeta('docs')
  const labs     = getAllMeta('labs')
  const failures = getAllMeta('failures')

  // Define topic clusters that should have minimum coverage
  const TOPIC_CLUSTERS: Array<{ name: string; keywords: string[] }> = [
    { name: 'Vercel / Deployment',  keywords: ['vercel', 'deploy', 'build'] },
    { name: 'Firebase / Backend',   keywords: ['firebase', 'firestore', 'auth'] },
    { name: 'Next.js / Framework',  keywords: ['next.js', 'nextjs', 'app router', 'server component'] },
    { name: 'SEO / GEO',            keywords: ['seo', 'geo', 'search', 'rank'] },
    { name: 'Claude / AI Tooling',  keywords: ['claude', 'ai', 'llm', 'agent'] },
  ]

  const allContent = [...docs, ...labs, ...failures]

  for (const cluster of TOPIC_CLUSTERS) {
    const matching = allContent.filter(c => {
      const text = (
        (c.frontmatter.title ?? '') + ' ' +
        ((c.frontmatter.tags ?? []) as string[]).join(' ')
      ).toLowerCase()
      return cluster.keywords.some(kw => text.includes(kw))
    })

    if (matching.length < 3) {
      signals.push({
        id:             `underdeveloped:${cluster.name.toLowerCase().replace(/\W+/g, '-')}`,
        type:           'underdeveloped_track',
        priority:       matching.length === 0 ? 'medium' : 'low',
        title:          `Underdeveloped area: ${cluster.name} (${matching.length} item${matching.length !== 1 ? 's' : ''})`,
        description:    `Only ${matching.length} content item${matching.length !== 1 ? 's' : ''} cover the "${cluster.name}" topic cluster. Thin clusters reduce query coverage and GEO citation potential for this domain.`,
        actionableHint: `Publish docs, labs, or failure reports tagged with: ${cluster.keywords.slice(0, 3).join(', ')}. Minimum 3 items for baseline coverage.`,
        relatedSection: 'docs',
        detectedAt:     today,
        template:       'execution-log',
      })
    }
  }
  return signals
}

/**
 * Platform-level publishing imbalance: largest section has 5× count of smallest.
 * Signals over-investment in one area at the expense of others.
 */
function detectPublishingImbalance(today: string): OperationalSignal[] {
  const sections = ['docs', 'failures', 'logs', 'case-studies', 'playbooks', 'labs'] as const
  const counts   = sections.map(s => ({ s, n: getAllMeta(s).length }))
  const populated = counts.filter(c => c.n > 0)
  if (populated.length < 2) return []

  const maxC = populated.reduce((m, c) => c.n > m.n ? c : m)
  const minC = populated.reduce((m, c) => c.n < m.n ? c : m)

  if (maxC.n <= minC.n * 4) return []

  return [{
    id:             `publishing-imbalance:${minC.s}`,
    type:           'publishing_imbalance',
    priority:       'low',
    title:          `Publishing imbalance: /${maxC.s} (${maxC.n}) vs /${minC.s} (${minC.n})`,
    description:    `The platform is over-indexed on /${maxC.s} and under-indexed on /${minC.s} by a ratio of ${Math.round(maxC.n / Math.max(minC.n, 1))}×. Portfolio imbalance limits cross-query coverage and reduces platform breadth signals.`,
    actionableHint: `Shift next 3–5 publishing cycles toward /${minC.s}. Extract from operational work that has already been done — don't fabricate content.`,
    relatedSection: minC.s,
    detectedAt:     today,
  }]
}

/**
 * Ecosystem properties with no linked failure reports AND no docs mentioning them.
 * Active systems with zero documentation = operational blind spots.
 */
function detectOperationalBlindSpots(today: string): OperationalSignal[] {
  const signals: OperationalSignal[] = []
  const docs     = getAllMeta('docs')
  const failures = getAllMeta('failures')
  const all      = [...docs, ...failures]

  for (const prop of ECOSYSTEM_PROPERTIES) {
    const keywords = [
      prop.name.toLowerCase(),
      prop.domain.toLowerCase().split('.')[0],
    ]
    const covered = all.some(c => {
      const text = ((c.frontmatter.title ?? '') + ' ' + ((c.frontmatter.tags ?? []) as string[]).join(' ')).toLowerCase()
      return keywords.some(kw => text.includes(kw))
    })

    if (!covered) {
      signals.push({
        id:             `blind-spot:${prop.domain}`,
        type:           'operational_blind_spot',
        priority:       prop.status === 'live' ? 'medium' : 'low',
        title:          `Blind spot: ${prop.name} has no docs or failure coverage`,
        description:    `${prop.name} (${prop.domain}) is ${prop.status} on ${prop.platform} but has zero associated documentation or failure reports. Undocumented live systems are the highest operational risk category.`,
        actionableHint: `Publish a system doc for ${prop.name}: stack (${prop.stack.slice(0, 3).join(', ')}), deploy procedure, and at least one known failure mode.`,
        relatedSection: 'docs',
        detectedAt:     today,
        template:       'deployment-journal',
      })
    }
  }
  return signals
}

/**
 * GEO query categories where zero queries have a mapped content slug.
 * A whole category with no coverage = zero AI retrieval from that query type.
 */
function detectWeakGEOClusters(today: string): OperationalSignal[] {
  const signals: OperationalSignal[] = []
  const CATEGORIES: QueryCategory[] = ['definitional', 'procedural', 'diagnostic', 'operational', 'comparative']

  for (const cat of CATEGORIES) {
    const inCat      = GEO_QUERY_TAXONOMY.filter(q => q.category === cat)
    const hasCovered = inCat.some(q => q.targetSlug)

    if (!hasCovered && inCat.length > 0) {
      signals.push({
        id:             `weak-geo-cluster:${cat}`,
        type:           'weak_geo_cluster',
        priority:       cat === 'definitional' || cat === 'procedural' ? 'medium' : 'low',
        title:          `Zero ${cat} queries have content coverage`,
        description:    `None of the ${inCat.length} "${cat}" queries in the GEO taxonomy have a mapped content target. AI systems answering ${cat} queries cannot cite this platform for any of these intents.`,
        actionableHint: `Write one piece that directly answers a ${cat} query: "${inCat[0]?.query ?? ''}". Map it as targetSlug in GEO_QUERY_TAXONOMY in lib/geo-intelligence.ts.`,
        relatedSection: cat === 'diagnostic' ? 'failures' : 'docs',
        detectedAt:     today,
        template:       cat === 'procedural' ? 'execution-log' : cat === 'diagnostic' ? 'failure-report' : 'case-study',
      })
    }
  }
  return signals
}

/**
 * High/critical failures with no hasRelatedLessons and no hasPlaybook.
 * Isolated failures have low knowledge-graph value and poor discoverability.
 */
function detectLowLinkDensity(today: string): OperationalSignal[] {
  const memory   = getFailureMemory()
  const isolated = memory.filter(m =>
    (m.severity === 'high' || m.severity === 'critical') &&
    !m.hasRelatedLessons &&
    !m.hasPlaybook
  )

  if (isolated.length === 0) return []

  return [{
    id:             `low-link-density:failures`,
    type:           'low_link_density',
    priority:       isolated.length >= 3 ? 'medium' : 'low',
    title:          `${isolated.length} high-severity failure${isolated.length > 1 ? 's' : ''} have no internal links`,
    description:    `${isolated.length} high/critical failures have neither related lessons nor a resolver playbook linked. Isolated failures are harder to surface through operational search and provide no navigation path for debugging.`,
    actionableHint: `For each isolated failure, add at least one: related lesson reference, resolver playbook entry, or pattern connection in lib/operational-memory.ts RELATIONSHIPS.`,
    relatedSection: 'failures',
    detectedAt:     today,
  }]
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

let _cachedSignals: OperationalSignal[] | null = null

/**
 * Get all active operational signals, sorted by priority.
 * Results are memoized for the lifetime of the build/request.
 */
export function getOperationalSignals(): OperationalSignal[] {
  if (_cachedSignals) return _cachedSignals

  const today = new Date().toISOString().slice(0, 10)

  const baseSignals = [
    ...detectUnscoredFailures(today),
    ...detectLowConfidence(today),
    ...detectPatternGaps(today),
    ...detectMissingPlaybooks(today),
    ...detectStaleSections(today),
    ...detectSingleInstanceHighSeverity(today),
  ]

  // Phase 5 — autonomous signals (some depend on base signals)
  const phase5 = [
    ...detectWeakEvidence(today),
    ...detectMissingCaseStudies(today),
    ...detectUnhealthyCadence(today, baseSignals),
    ...detectMissingGEOCoverage(today),
  ]

  // Phase 1 — deeper autonomous self-awareness
  const phase1 = [
    ...detectStaleAssumptions(today),
    ...detectUnderdevelopedTracks(today),
    ...detectPublishingImbalance(today),
    ...detectOperationalBlindSpots(today),
    ...detectWeakGEOClusters(today),
    ...detectLowLinkDensity(today),
  ]

  const all = [...baseSignals, ...phase5, ...phase1]

  // Dedupe by id (keep first occurrence — highest priority detector runs first)
  const seen = new Set<string>()
  const deduped = all.filter(s => {
    if (seen.has(s.id)) return false
    seen.add(s.id)
    return true
  })

  _cachedSignals = deduped.sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  )
  return _cachedSignals
}

/**
 * Get a summary of current signal counts by priority and type.
 */
export function getSignalSummary(): SignalSummary {
  const signals = getOperationalSignals()

  const byType = {} as Record<SignalType, number>
  for (const s of signals) {
    byType[s.type] = (byType[s.type] ?? 0) + 1
  }

  return {
    total:    signals.length,
    critical: signals.filter(s => s.priority === 'critical').length,
    high:     signals.filter(s => s.priority === 'high').length,
    medium:   signals.filter(s => s.priority === 'medium').length,
    low:      signals.filter(s => s.priority === 'low').length,
    byType,
  }
}

/**
 * Get signals of a specific type.
 */
export function getSignalsByType(type: SignalType): OperationalSignal[] {
  return getOperationalSignals().filter(s => s.type === type)
}

/**
 * Get signals above a given priority threshold.
 */
export function getHighPrioritySignals(maxPriority: SignalPriority = 'medium'): OperationalSignal[] {
  const threshold = PRIORITY_ORDER[maxPriority]
  return getOperationalSignals().filter(s => PRIORITY_ORDER[s.priority] <= threshold)
}
