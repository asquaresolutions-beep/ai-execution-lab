/**
 * lib/content-intelligence.ts
 * Phase 2 — Self-Improving Content System
 *
 * Analyses the full content corpus + failure memory + GEO taxonomy to produce
 * a ranked, actionable publishing priority queue.  The platform uses this to
 * guide its own expansion: surfacing what to write next, what to improve, and
 * what is dangerously thin.
 *
 * All computation runs at build time — pure static analysis, no API calls.
 */

import { getAllMeta } from './content'
import { getFailureMemory }    from './failure-memory'
import { getQueryCoverage, GEO_QUERY_TAXONOMY, type QueryCategory } from './geo-intelligence'
import { ECOSYSTEM_PROPERTIES } from './ecosystem'
import { getOperationalSignals } from './operational-signals'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type ContentAction =
  | 'create-new'          // write a brand-new piece
  | 'add-evidence'        // attach screenshots / external refs to existing content
  | 'add-depth'           // expand a piece that is too thin
  | 'add-internal-links'  // add cross-links to/from existing content
  | 'update-stale'        // refresh outdated content
  | 'add-case-study'      // document a real outcome end-to-end
  | 'add-playbook'        // write a resolver playbook
  | 'add-geo-content'     // write GEO-optimised definitional / procedural entry
  | 'add-specificity'     // make abstract content concrete with commands / values

export type PublishWindow = 'immediate' | 'this-week' | 'this-month' | 'backlog'

export type RecommendationSource =
  | 'geo-gap'             // uncovered GEO query
  | 'failure-coverage'    // failure pattern without playbook
  | 'section-depth'       // section too thin
  | 'evidence-gap'        // existing content lacks proof
  | 'stale-content'       // outdated high-value piece
  | 'track-gap'           // execution track without a case study
  | 'ecosystem-gap'       // property with no operational docs
  | 'signal-surfaced'     // escalation from operational-signals

export interface ContentRecommendation {
  id:             string
  action:         ContentAction
  window:         PublishWindow
  title:          string
  /** Why this matters for the platform right now */
  rationale:      string
  /** Exactly what to produce */
  deliverable:    string
  source:         RecommendationSource
  effort:         'low' | 'medium' | 'high'
  impact:         'low' | 'medium' | 'high'
  /** Score 0-100: (impact × effort-inverse × urgency) — used for ranking */
  score:          number
  template?:      string
  relatedSlug?:   string
  relatedSection?: string
  tags?:          string[]
}

export interface ContentIntelligenceSummary {
  totalRecommendations: number
  immediateCount:       number
  thisWeekCount:        number
  topOpportunity:       ContentRecommendation | null
  byAction:             Partial<Record<ContentAction, number>>
  bySource:             Partial<Record<RecommendationSource, number>>
}

// ─────────────────────────────────────────────────────────────
// Scoring helpers
// ─────────────────────────────────────────────────────────────

const IMPACT_WEIGHT  = { low: 1, medium: 2, high: 3 } as const
const EFFORT_INVERSE = { low: 3, medium: 2, high: 1 } as const   // low effort = easier
const WINDOW_BONUS   = { immediate: 30, 'this-week': 20, 'this-month': 10, backlog: 0 } as const

function score(
  impact: ContentRecommendation['impact'],
  effort: ContentRecommendation['effort'],
  window: PublishWindow
): number {
  const raw = IMPACT_WEIGHT[impact] * EFFORT_INVERSE[effort] * 10 + WINDOW_BONUS[window]
  return Math.min(raw, 100)
}

// ─────────────────────────────────────────────────────────────
// Detectors
// ─────────────────────────────────────────────────────────────

/** GEO queries with difficulty === 'gap' and no targetSlug → high-value publish targets */
function detectGEOGaps(): ContentRecommendation[] {
  const recs: ContentRecommendation[] = []
  const { gaps } = getQueryCoverage()

  const CATEGORY_IMPACT: Record<QueryCategory, ContentRecommendation['impact']> = {
    definitional: 'high',    // AI answers these first
    procedural:   'high',    // step-by-step coverage
    diagnostic:   'medium',  // debugging queries
    operational:  'medium',  // ops-depth queries
    comparative:  'low',     // competitive queries
  }

  for (const q of gaps) {
    const impact = CATEGORY_IMPACT[q.category]
    const window: PublishWindow = impact === 'high' ? 'immediate' : 'this-week'
    recs.push({
      id:          `geo-gap:${q.query.replace(/\s+/g, '-').slice(0, 40)}`,
      action:      'add-geo-content',
      window,
      title:       `Cover GEO gap: "${q.query}"`,
      rationale:   `No content targets this query. AI systems cannot cite this platform when answering "${q.intent}". This is a ${q.category} query — ${CATEGORY_IMPACT[q.category]} impact on AI visibility.`,
      deliverable: `Write a ${q.category === 'definitional' ? 'definitional doc' : q.category === 'procedural' ? 'procedural how-to' : q.category === 'diagnostic' ? 'failure report with debug guide' : 'case study or operational doc'} that directly answers: "${q.query}"`,
      source:      'geo-gap',
      effort:      'medium',
      impact,
      score:       score(impact, 'medium', window),
      template:    q.category === 'procedural' ? 'execution-log' : q.category === 'diagnostic' ? 'failure-report' : 'case-study',
      relatedSection: q.category === 'diagnostic' ? 'failures' : q.category === 'procedural' ? 'logs' : 'docs',
      tags:        [q.category, 'geo'],
    })
  }
  return recs
}

/** Failures with ≥2 instances and no playbook */
function detectFailureCoverageGaps(): ContentRecommendation[] {
  const recs: ContentRecommendation[] = []
  const memory = getFailureMemory()

  for (const m of memory) {
    if (m.instanceCount >= 2 && !m.hasPlaybook) {
      recs.push({
        id:          `failure-playbook:${m.slug}`,
        action:      'add-playbook',
        window:      m.instanceCount >= 3 ? 'immediate' : 'this-week',
        title:       `Write resolver playbook: ${m.title}`,
        rationale:   `This failure has recurred ${m.instanceCount} times with no documented resolver. Each recurrence costs investigation time. Confidence score is ${m.confidenceScore}/100 — a playbook alone pushes it above 75.`,
        deliverable: 'Write a step-by-step resolver playbook: trigger conditions → diagnosis steps → fix procedure → prevention checklist. Link from the failure archive entry.',
        source:      'failure-coverage',
        effort:      'medium',
        impact:      m.instanceCount >= 3 ? 'high' : 'medium',
        score:       score(m.instanceCount >= 3 ? 'high' : 'medium', 'medium', m.instanceCount >= 3 ? 'immediate' : 'this-week'),
        template:    'ai-workflow',
        relatedSlug: m.slug,
        relatedSection: 'playbooks',
        tags:        m.tags,
      })
    }
  }
  return recs
}

/** Content sections that are dangerously thin (< 3 items) */
function detectThinSections(): ContentRecommendation[] {
  const recs: ContentRecommendation[] = []
  const sections = ['case-studies', 'playbooks', 'labs', 'docs'] as const

  const MIN_VIABLE: Record<string, number> = {
    'case-studies': 3,
    playbooks:      3,
    labs:           3,
    docs:           5,
  }

  for (const section of sections) {
    const items = getAllMeta(section)
    const min   = MIN_VIABLE[section]
    if (items.length < min) {
      const deficit = min - items.length
      recs.push({
        id:          `thin-section:${section}`,
        action:      'create-new',
        window:      items.length === 0 ? 'immediate' : 'this-week',
        title:       `Thin section: /${section} has only ${items.length} item${items.length !== 1 ? 's' : ''}`,
        rationale:   `/${section} needs at least ${min} entries to establish credibility and GEO coverage. Currently ${deficit} item${deficit !== 1 ? 's' : ''} below minimum.`,
        deliverable: `Publish ${deficit} new ${section} piece${deficit !== 1 ? 's' : ''} from real operational work. Do not fabricate content — extract from existing execution.`,
        source:      'section-depth',
        effort:      'high',
        impact:      'high',
        score:       score('high', 'high', items.length === 0 ? 'immediate' : 'this-week'),
        template:    section === 'case-studies' ? 'case-study' : section === 'playbooks' ? 'ai-workflow' : 'execution-log',
        relatedSection: section,
        tags:        [section],
      })
    }
  }
  return recs
}

/** Existing content with no evidence_images AND no external_refs */
function detectEvidenceGaps(): ContentRecommendation[] {
  const recs: ContentRecommendation[] = []
  const HIGH_VALUE_SECTIONS = ['case-studies', 'failures', 'labs'] as const

  for (const section of HIGH_VALUE_SECTIONS) {
    const items = getAllMeta(section)
    const noEvidence = items.filter(item => {
      const fm = item.frontmatter
      return (
        (!fm.evidence_images || fm.evidence_images.length === 0) &&
        (!fm.external_refs   || fm.external_refs.length   === 0)
      )
    })

    if (noEvidence.length > 0) {
      // Most recent item without evidence is the highest priority to fix
      const target = noEvidence[0]
      recs.push({
        id:          `evidence-gap:${section}`,
        action:      'add-evidence',
        window:      'this-week',
        title:       `${noEvidence.length} ${section} items lack evidence`,
        rationale:   `Evidence-free content has lower GEO citation potential and trust signals. ${section} should lead with proof — screenshots, actual error outputs, or cited sources.`,
        deliverable: `Add evidence_images: [] or external_refs: [] to frontmatter for ${section} entries, starting with: "${target.frontmatter.title}". Even one screenshot or source link counts.`,
        source:      'evidence-gap',
        effort:      'low',
        impact:      'medium',
        score:       score('medium', 'low', 'this-week'),
        relatedSlug: target.slug,
        relatedSection: section,
        tags:        ['evidence', 'geo'],
      })
    }
  }
  return recs
}

/** Docs/labs that are > 60 days old with no `updated:` field — may have stale procedures */
function detectStaleContent(): ContentRecommendation[] {
  const recs: ContentRecommendation[] = []
  const now      = Date.now()
  const STALE_MS = 60 * 24 * 60 * 60 * 1000  // 60 days
  const docs     = getAllMeta('docs')

  const stale = docs.filter(d => {
    const updated = d.frontmatter.updated
    if (updated) return false                  // explicitly updated — skip
    const age = now - new Date(d.frontmatter.date).getTime()
    return age > STALE_MS
  })

  if (stale.length > 0) {
    const oldest = stale[stale.length - 1]
    recs.push({
      id:          `stale-content:docs`,
      action:      'update-stale',
      window:      'this-month',
      title:       `${stale.length} docs are 60+ days old with no update timestamp`,
      rationale:   `Deployment procedures and architecture docs go stale. Without an updated: field, readers cannot gauge freshness — and AI systems may deprioritise undated content.`,
      deliverable: `Review the oldest doc ("${oldest.frontmatter.title}") first. If still accurate, add updated: ${new Date().toISOString().slice(0, 10)}. If outdated, revise the procedure section.`,
      source:      'stale-content',
      effort:      'low',
      impact:      'medium',
      score:       score('medium', 'low', 'this-month'),
      relatedSlug: oldest.slug,
      relatedSection: 'docs',
      tags:        ['maintenance', 'freshness'],
    })
  }
  return recs
}

/** Ecosystem properties that have no linked failure entry or doc */
function detectEcosystemGaps(): ContentRecommendation[] {
  const recs: ContentRecommendation[] = []
  const docs     = getAllMeta('docs')
  const failures = getAllMeta('failures')
  const allContent = [...docs, ...failures]

  for (const prop of ECOSYSTEM_PROPERTIES) {
    const propKeywords = [
      prop.name.toLowerCase(),
      prop.domain.toLowerCase().split('.')[0],
    ]
    const hasCoverage = allContent.some(c => {
      const text = (c.frontmatter.title + ' ' + (c.frontmatter.tags ?? []).join(' ')).toLowerCase()
      return propKeywords.some(kw => text.includes(kw))
    })

    if (!hasCoverage) {
      recs.push({
        id:          `ecosystem-gap:${prop.domain}`,
        action:      'create-new',
        window:      'this-month',
        title:       `No operational docs for ${prop.name} (${prop.domain})`,
        rationale:   `${prop.name} is an active ecosystem property but has no linked failure reports or architecture docs. Undocumented systems are operational blind spots.`,
        deliverable: `Publish a systems doc for ${prop.name}: stack overview (${prop.stack.join(', ')}), deployment procedure, and known failure modes.`,
        source:      'ecosystem-gap',
        effort:      'medium',
        impact:      'medium',
        score:       score('medium', 'medium', 'this-month'),
        relatedSection: 'docs',
        tags:        [prop.domain.split('.')[0], 'ecosystem'],
      })
    }
  }
  return recs
}

/** High-severity failures that lack internal links to related content */
function detectLinkDensityGaps(): ContentRecommendation[] {
  const recs: ContentRecommendation[] = []
  const memory = getFailureMemory()

  const isolated = memory.filter(m =>
    !m.hasRelatedLessons &&
    !m.hasPlaybook &&
    (m.severity === 'high' || m.severity === 'critical')
  )

  if (isolated.length > 0) {
    recs.push({
      id:          `link-density:failures`,
      action:      'add-internal-links',
      window:      'this-week',
      title:       `${isolated.length} high-severity failures have no internal links`,
      rationale:   `Isolated failure reports are harder to surface through operational search and provide no navigation path for debugging. Internal links to related lessons, playbooks, or patterns dramatically increase utility.`,
      deliverable: `For each isolated failure, add at least: one related lesson link, or one resolver playbook link, or one pattern connection in lib/operational-memory.ts.`,
      source:      'failure-coverage',
      effort:      'low',
      impact:      'medium',
      score:       score('medium', 'low', 'this-week'),
      relatedSection: 'failures',
      tags:        ['internal-links', 'knowledge-graph'],
    })
  }
  return recs
}

/** Sections with extreme count imbalance — over-indexed vs under-indexed */
function detectPublishingImbalance(): ContentRecommendation[] {
  const recs: ContentRecommendation[] = []
  const sections = ['docs', 'failures', 'logs', 'case-studies', 'playbooks', 'labs'] as const
  const counts   = sections.map(s => ({ section: s, count: getAllMeta(s).length }))

  const populated = counts.filter(c => c.count > 0)
  if (populated.length < 2) return recs

  const maxCount = Math.max(...populated.map(c => c.count))
  const minCount = Math.min(...populated.map(c => c.count))

  if (maxCount > minCount * 5) {
    const heaviest = populated.find(c => c.count === maxCount)!
    const lightest = populated.find(c => c.count === minCount)!
    recs.push({
      id:          `imbalance:${lightest.section}`,
      action:      'create-new',
      window:      'this-month',
      title:       `Publishing imbalance: /${heaviest.section} (${heaviest.count}) vs /${lightest.section} (${lightest.count})`,
      rationale:   `The platform is over-indexed on ${heaviest.section} and severely under-indexed on ${lightest.section}. Imbalanced content portfolios reduce the platform's ability to serve diverse operational queries.`,
      deliverable: `Publish 3–5 new ${lightest.section} entries to rebalance. Extract from operational work that has already been done — don't fabricate.`,
      source:      'section-depth',
      effort:      'high',
      impact:      'medium',
      score:       score('medium', 'high', 'this-month'),
      relatedSection: lightest.section,
      tags:        ['balance', 'portfolio'],
    })
  }
  return recs
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

let _cachedRecs: ContentRecommendation[] | null = null

/**
 * Get all ranked content recommendations.
 * Sorted by score desc (highest-impact, lowest-effort, most urgent first).
 */
export function getContentRecommendations(): ContentRecommendation[] {
  if (_cachedRecs) return _cachedRecs

  const all = [
    ...detectGEOGaps(),
    ...detectFailureCoverageGaps(),
    ...detectThinSections(),
    ...detectEvidenceGaps(),
    ...detectStaleContent(),
    ...detectEcosystemGaps(),
    ...detectLinkDensityGaps(),
    ...detectPublishingImbalance(),
  ]

  // Dedupe by id
  const seen = new Set<string>()
  const deduped = all.filter(r => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })

  _cachedRecs = deduped.sort((a, b) => b.score - a.score)
  return _cachedRecs
}

/**
 * Get recommendations filtered by publish window.
 */
export function getRecommendationsByWindow(window: PublishWindow): ContentRecommendation[] {
  return getContentRecommendations().filter(r => r.window === window)
}

/**
 * Get the top N recommendations.
 */
export function getTopRecommendations(n = 5): ContentRecommendation[] {
  return getContentRecommendations().slice(0, n)
}

/**
 * Get a summary of the content intelligence state.
 */
export function getContentIntelligenceSummary(): ContentIntelligenceSummary {
  const all = getContentRecommendations()

  const byAction: Partial<Record<ContentAction, number>> = {}
  const bySource: Partial<Record<RecommendationSource, number>> = {}
  for (const r of all) {
    byAction[r.action] = (byAction[r.action] ?? 0) + 1
    bySource[r.source] = (bySource[r.source] ?? 0) + 1
  }

  return {
    totalRecommendations: all.length,
    immediateCount:       all.filter(r => r.window === 'immediate').length,
    thisWeekCount:        all.filter(r => r.window === 'this-week').length,
    topOpportunity:       all[0] ?? null,
    byAction,
    bySource,
  }
}
