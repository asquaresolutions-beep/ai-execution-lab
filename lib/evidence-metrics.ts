/**
 * lib/evidence-metrics.ts
 *
 * Real operational metrics computed at build time from the actual content corpus.
 * Powers homepage stats, ops dashboard, and start-here summaries.
 *
 * Metrics produced:
 *   - evidenceCount        — total evidence_images across all content
 *   - screenshotCount      — alias (screenshots = evidence_images)
 *   - operationalHours     — parsed from log `duration` frontmatter fields
 *   - deploymentCount      — logs with log_type: deployment
 *   - failureCount         — total failure reports
 *   - resolvedCount        — failures with failure_status: resolved
 *   - avgResolutionMinutes — average resolution time across resolved failures
 *   - logsPerWeek          — trailing 4-week average
 *   - publishingStreak     — consecutive active publishing days (any content)
 *   - totalContentItems    — sum of all published items across all sections
 */

import { getAllMeta, type ContentSection } from './content'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EvidenceMetrics {
  evidenceCount:        number
  screenshotCount:      number   // same as evidenceCount — alias for clarity
  operationalHours:     number   // total hours documented in execution logs
  deploymentCount:      number   // logs with log_type = deployment
  debuggingCount:       number   // logs with log_type = debugging
  failureCount:         number   // total failure documents
  resolvedCount:        number   // failures with failure_status = resolved
  avgResolutionMinutes: number   // mean resolution time across resolved failures with timing data
  logsPerWeek:          number   // trailing 4-week average log publication rate
  publishingStreak:     number   // consecutive days with ≥1 published item (any section)
  totalContentItems:    number   // total published items across all content sections
  totalEvidencePages:   number   // pages that have at least one evidence_image
  contentBySection:     Record<ContentSection, number>
}

// ─────────────────────────────────────────────────────────────────────────────
// Duration parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a freeform duration string into total minutes.
 * Handles formats like: "75 min", "2 hours", "1.5 hours", "90 minutes",
 * "2h 30m", "~120 min", "45-60 min" (takes lower bound).
 * Returns 0 for unparseable strings.
 */
function parseDurationMinutes(raw: string): number {
  if (!raw || typeof raw !== 'string') return 0

  const s = raw.toLowerCase().trim()

  // Handle "~120 min" — strip approximation prefix
  const cleaned = s.replace(/^[~≈about ]+/, '').trim()

  // Range like "45-60 min" — take lower bound
  const rangeMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*[-–to]+\s*\d+(?:\.\d+)?/)
  const valueStr   = rangeMatch ? rangeMatch[1] : cleaned

  // "2h 30m" or "2hr 30min" compound format
  const compoundMatch = valueStr.match(/(\d+(?:\.\d+)?)\s*h(?:rs?|ours?)?\s*(\d+(?:\.\d+)?)\s*m(?:ins?|inutes?)?/)
  if (compoundMatch) {
    return Math.round(parseFloat(compoundMatch[1]) * 60 + parseFloat(compoundMatch[2]))
  }

  // Hours: "2 hours", "1.5h", "2hr"
  const hourMatch = valueStr.match(/^(\d+(?:\.\d+)?)\s*h(?:rs?|ours?)?$/)
  if (hourMatch) {
    return Math.round(parseFloat(hourMatch[1]) * 60)
  }

  // Minutes: "75 min", "90 minutes", "45m"
  const minMatch = valueStr.match(/^(\d+(?:\.\d+)?)\s*m(?:ins?|inutes?)?$/)
  if (minMatch) {
    return Math.round(parseFloat(minMatch[1]))
  }

  // Bare number — assume minutes
  const bareMatch = valueStr.match(/^(\d+(?:\.\d+)?)$/)
  if (bareMatch) {
    return Math.round(parseFloat(bareMatch[1]))
  }

  return 0
}

/**
 * Parse resolution_time strings like "15 minutes", "2 hours", "45 min".
 */
function parseResolutionMinutes(raw: string): number {
  return parseDurationMinutes(raw)
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache
// ─────────────────────────────────────────────────────────────────────────────

let _cachedMetrics: EvidenceMetrics | null = null

// ─────────────────────────────────────────────────────────────────────────────
// Core computation
// ─────────────────────────────────────────────────────────────────────────────

const ALL_SECTIONS: ContentSection[] = [
  'docs', 'failures', 'logs', 'case-studies', 'playbooks', 'labs', 'systems'
]

export function getEvidenceMetrics(): EvidenceMetrics {
  if (_cachedMetrics) return _cachedMetrics

  let evidenceCount      = 0
  let totalEvidencePages = 0
  let operationalMinutes = 0
  let deploymentCount    = 0
  let debuggingCount     = 0
  let failureCount       = 0
  let resolvedCount      = 0
  let resolutionMinutes  = 0
  let resolutionSamples  = 0
  let totalContentItems  = 0

  const contentBySection: Record<ContentSection, number> = {
    'docs': 0, 'failures': 0, 'logs': 0,
    'case-studies': 0, 'playbooks': 0, 'labs': 0, 'systems': 0,
  }

  // Collect all published dates for streak computation
  const publishedDates = new Set<string>()
  // Collect log dates for logs-per-week calculation
  const logDates: Date[] = []

  for (const section of ALL_SECTIONS) {
    const items = getAllMeta(section)

    for (const item of items) {
      const fm = item.frontmatter
      totalContentItems++
      contentBySection[section]++

      // Evidence images
      const imgs = (fm.evidence_images as string[] | undefined) ?? []
      evidenceCount += imgs.length
      if (imgs.length > 0) totalEvidencePages++

      // Track publish dates for streak
      if (fm.date) publishedDates.add(fm.date as string)

      // Section-specific metrics
      if (section === 'logs') {
        logDates.push(new Date(fm.date as string))

        // Parse duration
        if (fm.duration) {
          const mins = parseDurationMinutes(fm.duration as string)
          operationalMinutes += mins
        }

        // Log type
        const logType = (fm.log_type as string | undefined)?.toLowerCase() ?? ''
        if (logType === 'deployment' || logType === 'deploy') {
          deploymentCount++
        } else if (logType === 'debugging' || logType === 'debug') {
          debuggingCount++
        }
      }

      if (section === 'failures') {
        failureCount++

        if ((fm.failure_status as string) === 'resolved') {
          resolvedCount++
          if (fm.resolution_time) {
            const mins = parseResolutionMinutes(fm.resolution_time as string)
            if (mins > 0) {
              resolutionMinutes += mins
              resolutionSamples++
            }
          }
        }
      }
    }
  }

  const operationalHours = Math.round(operationalMinutes / 60 * 10) / 10
  const avgResolutionMinutes = resolutionSamples > 0
    ? Math.round(resolutionMinutes / resolutionSamples)
    : 0

  // Logs per week: trailing 4 weeks
  const fourWeeksAgo = new Date()
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
  const recentLogs = logDates.filter(d => d >= fourWeeksAgo).length
  const logsPerWeek = Math.round((recentLogs / 4) * 10) / 10

  // Publishing streak: consecutive days ending today with any published content
  const streak = computePublishingStreak(publishedDates)

  _cachedMetrics = {
    evidenceCount,
    screenshotCount:      evidenceCount,
    operationalHours,
    deploymentCount,
    debuggingCount,
    failureCount,
    resolvedCount,
    avgResolutionMinutes,
    logsPerWeek,
    publishingStreak:     streak,
    totalContentItems,
    totalEvidencePages,
    contentBySection,
  }

  return _cachedMetrics
}

// ─────────────────────────────────────────────────────────────────────────────
// Publishing streak helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Count consecutive active publishing days ending on (or including) today.
 * A day is "active" if any content item has a date on that day.
 */
function computePublishingStreak(publishedDates: Set<string>): number {
  if (publishedDates.size === 0) return 0

  const today = new Date()
  let streak  = 0

  for (let i = 0; i < 365; i++) {
    const d    = new Date(today)
    d.setDate(today.getDate() - i)
    const key  = d.toISOString().slice(0, 10)  // YYYY-MM-DD

    if (publishedDates.has(key)) {
      streak++
    } else if (i > 0) {
      // Gap — streak ends (don't count gaps after today)
      break
    }
  }

  return streak
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived / formatted helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns formatted operational hours string, e.g. "47.5h" or "120h".
 */
export function formatOperationalHours(metrics: EvidenceMetrics): string {
  const h = metrics.operationalHours
  return h % 1 === 0 ? `${h}h` : `${h}h`
}

/**
 * Returns formatted average resolution time, e.g. "22 min" or "1h 15m".
 */
export function formatAvgResolution(metrics: EvidenceMetrics): string {
  const mins = metrics.avgResolutionMinutes
  if (mins === 0) return 'N/A'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

/**
 * Convenience: get summary of metrics for quick surface-level display.
 * Used by homepage stats and ops overview.
 */
export interface EvidenceMetricsSummary {
  totalItems:           number
  evidenceCount:        number
  operationalHoursStr:  string
  deploymentCount:      number
  resolvedFailures:     number
  avgResolutionStr:     string
  publishingStreakDays: number
  logsPerWeek:          number
}

export function getEvidenceMetricsSummary(): EvidenceMetricsSummary {
  const m = getEvidenceMetrics()
  return {
    totalItems:           m.totalContentItems,
    evidenceCount:        m.evidenceCount,
    operationalHoursStr:  formatOperationalHours(m),
    deploymentCount:      m.deploymentCount,
    resolvedFailures:     m.resolvedCount,
    avgResolutionStr:     formatAvgResolution(m),
    publishingStreakDays: m.publishingStreak,
    logsPerWeek:          m.logsPerWeek,
  }
}
