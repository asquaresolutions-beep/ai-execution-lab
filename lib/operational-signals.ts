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

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type SignalType =
  | 'unscored_failure'   // new failure not yet in failure-memory table
  | 'low_confidence_fix' // confidence < 60
  | 'pattern_gap'        // pattern with failures but no playbook
  | 'missing_playbook'   // recurring failure without a resolver playbook
  | 'stale_section'      // section inactive past threshold
  | 'single_instance'    // high-severity failure with instanceCount = 1

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

  const all = [
    ...detectUnscoredFailures(today),
    ...detectLowConfidence(today),
    ...detectPatternGaps(today),
    ...detectMissingPlaybooks(today),
    ...detectStaleSections(today),
    ...detectSingleInstanceHighSeverity(today),
  ]

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
