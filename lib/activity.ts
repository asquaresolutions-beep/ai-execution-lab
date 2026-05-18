/**
 * lib/activity.ts
 * Platform activity aggregation — scans all content sections and lesson files
 * to produce a live activity summary. Used by homepage and ops dashboard.
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { getAllMeta, type ContentMeta } from './content'
import { TRACKS } from './tracks'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface LessonActivity {
  id:          string
  title:       string
  trackId:     string
  trackTitle:  string
  moduleId:    string
  moduleTitle: string
  href:        string
  date:        string
}

export interface ActivitySignal {
  type:        'lesson' | 'failure' | 'log' | 'playbook' | 'doc' | 'case-study' | 'lab' | 'system'
  title:       string
  href:        string
  date:        string
  meta?:       string   // secondary label: failure status, outcome, track name, etc.
}

export interface PlatformStatus {
  latestLesson:  LessonActivity | null
  latestFailure: ContentMeta    | null
  latestLog:     ContentMeta    | null
  latestPlaybook: ContentMeta   | null
  recentSignals: ActivitySignal[]        // last 10 signals across all sources
  itemsThisMonth: number
  itemsThisWeek:  number
  totalLessons:   number
  availableLessons: number
}

// ─────────────────────────────────────────────────────────────
// Lesson scanner (reads MDX files in content/lessons/...)
// ─────────────────────────────────────────────────────────────

export function scanLessonFiles(): LessonActivity[] {
  const results: LessonActivity[] = []
  const root = path.join(process.cwd(), 'content', 'lessons')
  if (!fs.existsSync(root)) return results

  for (const track of TRACKS) {
    for (const mod of track.modules) {
      for (const lesson of mod.lessons) {
        if (lesson.status !== 'available') continue
        const filePath = path.join(root, track.id, mod.id, `${lesson.id}.mdx`)
        if (!fs.existsSync(filePath)) continue

        try {
          const raw = fs.readFileSync(filePath, 'utf-8')
          const { data } = matter(raw)
          if (data.date) {
            results.push({
              id:          lesson.id,
              title:       lesson.title,
              trackId:     track.id,
              trackTitle:  track.title,
              moduleId:    mod.id,
              moduleTitle: mod.title,
              href:        `/tracks/${track.id}/${mod.id}/${lesson.id}`,
              date:        data.date as string,
            })
          }
        } catch {
          // skip malformed files silently
        }
      }
    }
  }

  return results.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
}

// ─────────────────────────────────────────────────────────────
// Platform status (main export)
// ─────────────────────────────────────────────────────────────

export function getPlatformStatus(): PlatformStatus {
  const failures  = getAllMeta('failures')
  const logs      = getAllMeta('logs')
  const playbooks = getAllMeta('playbooks')
  const docs      = getAllMeta('docs')
  const systems   = getAllMeta('systems')
  const labs      = getAllMeta('labs')
  const cs        = getAllMeta('case-studies')
  const lessons   = scanLessonFiles()

  const now          = new Date()
  const msDay        = 86_400_000
  const thirtyAgo    = new Date(now.getTime() - 30 * msDay)
  const sevenAgo     = new Date(now.getTime() -  7 * msDay)

  // Build unified signal stream from content sections
  const sectionSignals: ActivitySignal[] = [
    ...failures.map(f => ({
      type: 'failure'   as const,
      title: f.frontmatter.title,
      href: `/failures/${f.slug}`,
      date: f.frontmatter.date,
      meta: f.frontmatter.failure_status,
    })),
    ...logs.map(l => ({
      type: 'log'       as const,
      title: l.frontmatter.title,
      href: `/logs/${l.slug}`,
      date: l.frontmatter.date,
      meta: l.frontmatter.outcome,
    })),
    ...playbooks.map(p => ({
      type: 'playbook'  as const,
      title: p.frontmatter.title,
      href: `/playbooks/${p.slug}`,
      date: p.frontmatter.date,
    })),
    ...docs.map(d => ({
      type: 'doc'       as const,
      title: d.frontmatter.title,
      href: `/docs/${d.slug}`,
      date: d.frontmatter.date,
    })),
    ...cs.map(c => ({
      type: 'case-study' as const,
      title: c.frontmatter.title,
      href: `/case-studies/${c.slug}`,
      date: c.frontmatter.date,
    })),
    ...labs.map(l => ({
      type: 'lab'       as const,
      title: l.frontmatter.title,
      href: `/labs/${l.slug}`,
      date: l.frontmatter.date,
    })),
    ...systems.map(s => ({
      type: 'system'    as const,
      title: s.frontmatter.title,
      href: `/systems/${s.slug}`,
      date: s.frontmatter.date,
    })),
    ...lessons.map(l => ({
      type: 'lesson'    as const,
      title: l.title,
      href:  l.href,
      date:  l.date,
      meta:  l.trackTitle,
    })),
  ]

  const allSignals = sectionSignals
    .filter(s => s.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const itemsThisMonth = allSignals.filter(
    s => new Date(s.date) >= thirtyAgo
  ).length

  const itemsThisWeek = allSignals.filter(
    s => new Date(s.date) >= sevenAgo
  ).length

  // Track lesson counts (cross-track totals)
  const totalAvailable = TRACKS.reduce(
    (n, t) => n + t.modules.reduce(
      (m, mod) => m + mod.lessons.filter(l => l.status === 'available').length, 0
    ), 0
  )
  const totalAll = TRACKS.reduce(
    (n, t) => n + t.modules.reduce(
      (m, mod) => m + mod.lessons.length, 0
    ), 0
  )

  return {
    latestLesson:    lessons[0]   ?? null,
    latestFailure:   failures[0]  ?? null,
    latestLog:       logs[0]      ?? null,
    latestPlaybook:  playbooks[0] ?? null,
    recentSignals:   allSignals.slice(0, 10),
    itemsThisMonth,
    itemsThisWeek,
    totalLessons:    totalAll,
    availableLessons: totalAvailable,
  }
}

// ─────────────────────────────────────────────────────────────
// Publishing streak calculator
// ─────────────────────────────────────────────────────────────

export function getPublishingStreak(signals: ActivitySignal[]): number {
  if (signals.length === 0) return 0

  const today   = new Date()
  today.setHours(0, 0, 0, 0)

  // Build set of days (as YYYY-MM-DD strings) with at least one publish
  const publishDays = new Set<string>()
  for (const s of signals) {
    if (!s.date) continue
    publishDays.add(s.date.slice(0, 10))
  }

  // Walk backwards from today, counting consecutive active days
  let streak = 0
  const cursor = new Date(today)
  while (true) {
    const key = cursor.toISOString().slice(0, 10)
    if (!publishDays.has(key)) break
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

// ─────────────────────────────────────────────────────────────
// Monthly velocity (last N months)
// ─────────────────────────────────────────────────────────────

export interface MonthlyVelocity {
  label: string   // "May 2026"
  key:   string   // "2026-05"
  count: number
}

export function getMonthlyVelocity(
  signals: ActivitySignal[],
  months = 4
): MonthlyVelocity[] {
  const result: MonthlyVelocity[] = []
  const now = new Date()

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
    const count = signals.filter(s => s.date?.startsWith(key)).length
    result.push({ label, key, count })
  }

  return result
}

// ─────────────────────────────────────────────────────────────
// Track completion summary
// ─────────────────────────────────────────────────────────────

export interface TrackCompletion {
  id:        string
  title:     string
  accent:    string
  available: number
  total:     number
  pct:       number
}

export function getTrackCompletion(): TrackCompletion[] {
  return TRACKS.map(t => {
    const total     = t.modules.reduce((n, m) => n + m.lessons.length, 0)
    const available = t.modules.reduce(
      (n, m) => n + m.lessons.filter(l => l.status === 'available').length, 0
    )
    return {
      id:     t.id,
      title:  t.title,
      accent: t.accent,
      available,
      total,
      pct: total > 0 ? Math.round((available / total) * 100) : 0,
    }
  }).sort((a, b) => b.pct - a.pct)
}
