/**
 * lib/publishing-pulse.ts
 * Content velocity analytics — measures publishing cadence across all sections.
 *
 * Used by the /ops and /publish pages to surface cadence health,
 * stale sections, and velocity trends without manual tracking.
 *
 * All data is computed at build time from the content/ directory.
 */

import { getAllMeta, type ContentSection } from './content'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type SectionHealth = 'active' | 'slowing' | 'stale' | 'empty'

export interface SectionPulse {
  section:         ContentSection
  label:           string
  /** Total published items (status != draft/archived) */
  totalItems:      number
  last7Days:       number
  last30Days:      number
  last90Days:      number
  /** ISO date of the most recent item, or null if empty */
  lastPublished:   string | null
  /** Days since last published, or null if empty */
  daysSinceLast:   number | null
  health:          SectionHealth
  healthLabel:     string
  /** Tailwind color class for health indicator */
  healthColor:     string
}

export interface PublishingPulse {
  sections:             SectionPulse[]
  totalPublished:       number
  publishedLast7Days:   number
  publishedLast30Days:  number
  activeSections:       number
  staleSections:        number
  /** Section with the most recent publish */
  mostActiveSection:    string | null
  /** Section with the oldest publish (with >0 items) */
  mostNeglectedSection: string | null
  overallHealth:        'healthy' | 'slowing' | 'stale'
  overallHealthLabel:   string
  /** ISO timestamp of when this was computed */
  generatedAt:          string
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

// How many days of inactivity before a section is considered stale
const STALE_THRESHOLD: Record<string, number> = {
  failures:      14,
  logs:          7,
  'case-studies': 30,
  labs:          30,
  playbooks:     45,
  docs:          60,
  systems:       60,
}

const SECTION_LABELS: Record<string, string> = {
  failures:      'Failure Reports',
  logs:          'Execution Logs',
  'case-studies': 'Case Studies',
  labs:          'Labs',
  playbooks:     'Playbooks',
  docs:          'Docs',
  systems:       'Systems',
}

const TRACKED_SECTIONS: ContentSection[] = [
  'failures', 'logs', 'case-studies', 'labs', 'playbooks',
]

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function daysBetween(isoDate: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(isoDate).getTime()) / 86_400_000)
}

function sectionHealth(daysSince: number | null, total: number): SectionHealth {
  if (total === 0 || daysSince === null) return 'empty'
  if (daysSince <= 7) return 'active'
  if (daysSince <= 21) return 'slowing'
  return 'stale'
}

const HEALTH_LABELS: Record<SectionHealth, string> = {
  active:  'Active',
  slowing: 'Slowing',
  stale:   'Stale',
  empty:   'Empty',
}

const HEALTH_COLORS: Record<SectionHealth, string> = {
  active:  'text-green-400',
  slowing: 'text-yellow-400',
  stale:   'text-orange-400',
  empty:   'text-surface-700',
}

// ─────────────────────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────────────────────

/**
 * Compute publishing cadence metrics across all tracked sections.
 * Called at build time / render time (server component only).
 */
export function getPublishingPulse(): PublishingPulse {
  const now = new Date()
  const sections: SectionPulse[] = []

  let totalPublished      = 0
  let publishedLast7Days  = 0
  let publishedLast30Days = 0

  for (const section of TRACKED_SECTIONS) {
    const allItems = getAllMeta(section)
    // Exclude drafts and archived
    const published = allItems.filter(
      i => i.frontmatter.status !== 'draft' && i.frontmatter.status !== 'archived'
    )

    const l7  = published.filter(i => daysBetween(i.frontmatter.date, now) <= 7).length
    const l30 = published.filter(i => daysBetween(i.frontmatter.date, now) <= 30).length
    const l90 = published.filter(i => daysBetween(i.frontmatter.date, now) <= 90).length

    const sorted = [...published].sort(
      (a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime()
    )
    const lastPublished = sorted[0]?.frontmatter.date ?? null
    const daysSinceLast = lastPublished ? daysBetween(lastPublished, now) : null
    const health        = sectionHealth(daysSinceLast, published.length)
    // Override with configured threshold
    const threshold     = STALE_THRESHOLD[section] ?? 30
    const adjustedHealth: SectionHealth =
      published.length === 0 || daysSinceLast === null ? 'empty'
      : daysSinceLast <= 7                             ? 'active'
      : daysSinceLast <= threshold / 2                 ? 'slowing'
      : daysSinceLast > threshold                      ? 'stale'
      : health

    totalPublished      += published.length
    publishedLast7Days  += l7
    publishedLast30Days += l30

    sections.push({
      section,
      label:         SECTION_LABELS[section] ?? section,
      totalItems:    published.length,
      last7Days:     l7,
      last30Days:    l30,
      last90Days:    l90,
      lastPublished,
      daysSinceLast,
      health:        adjustedHealth,
      healthLabel:   HEALTH_LABELS[adjustedHealth],
      healthColor:   HEALTH_COLORS[adjustedHealth],
    })
  }

  const sorted             = [...sections].sort((a, b) => (a.daysSinceLast ?? 9999) - (b.daysSinceLast ?? 9999))
  const mostActiveSection  = sorted.find(s => s.totalItems > 0)?.section ?? null
  const mostNeglectedSection = [...sorted].reverse().find(s => s.totalItems > 0)?.section ?? null

  const activeSections = sections.filter(s => s.health === 'active').length
  const staleSections  = sections.filter(s => s.health === 'stale').length

  const overallHealth: PublishingPulse['overallHealth'] =
    activeSections >= 3 ? 'healthy'
    : activeSections >= 1 ? 'slowing'
    : 'stale'

  const overallHealthLabel =
    overallHealth === 'healthy' ? 'Healthy'
    : overallHealth === 'slowing' ? 'Slowing'
    : 'Stale'

  return {
    sections,
    totalPublished,
    publishedLast7Days,
    publishedLast30Days,
    activeSections,
    staleSections,
    mostActiveSection,
    mostNeglectedSection,
    overallHealth,
    overallHealthLabel,
    generatedAt: now.toISOString(),
  }
}

/**
 * Get a single section's pulse data.
 */
export function getSectionPulse(section: ContentSection): SectionPulse | null {
  return getPublishingPulse().sections.find(s => s.section === section) ?? null
}
