'use client'

// ─────────────────────────────────────────────────────────────
// Client-side progress management via localStorage.
// No backend required — progress is per-browser.
// ─────────────────────────────────────────────────────────────

const PREFIX = 'ail:track:'

function storageKey(trackId: string): string {
  return `${PREFIX}${trackId}`
}

export interface TrackProgress {
  completedLessons: string[]  // lessonIds in format "moduleId/lessonId"
  startedAt?: string          // ISO date of first lesson completion
  lastActivityAt?: string
}

export function getTrackProgress(trackId: string): TrackProgress {
  if (typeof window === 'undefined') return { completedLessons: [] }
  try {
    const raw = localStorage.getItem(storageKey(trackId))
    if (!raw) return { completedLessons: [] }
    return JSON.parse(raw) as TrackProgress
  } catch {
    return { completedLessons: [] }
  }
}

export function setLessonComplete(
  trackId: string,
  moduleId: string,
  lessonId: string,
  complete: boolean
): TrackProgress {
  const key      = `${moduleId}/${lessonId}`
  const progress = getTrackProgress(trackId)
  const set      = new Set(progress.completedLessons)

  if (complete) {
    set.add(key)
    if (!progress.startedAt) progress.startedAt = new Date().toISOString()
    progress.lastActivityAt = new Date().toISOString()
  } else {
    set.delete(key)
  }

  progress.completedLessons = Array.from(set)

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(storageKey(trackId), JSON.stringify(progress))
    } catch {
      // storage full or private mode
    }
  }

  return progress
}

export function isLessonComplete(
  trackId: string,
  moduleId: string,
  lessonId: string
): boolean {
  const progress = getTrackProgress(trackId)
  return progress.completedLessons.includes(`${moduleId}/${lessonId}`)
}

export function getModuleProgress(
  trackId: string,
  moduleId: string,
  lessonIds: string[]
): { completed: number; total: number; pct: number } {
  const progress  = getTrackProgress(trackId)
  const completed = lessonIds.filter((id) =>
    progress.completedLessons.includes(`${moduleId}/${id}`)
  ).length
  return { completed, total: lessonIds.length, pct: Math.round((completed / lessonIds.length) * 100) }
}

export function getOverallProgress(
  trackId: string,
  allLessons: { moduleId: string; lessonId: string }[]
): { completed: number; total: number; pct: number } {
  const progress  = getTrackProgress(trackId)
  const completed = allLessons.filter(({ moduleId, lessonId }) =>
    progress.completedLessons.includes(`${moduleId}/${lessonId}`)
  ).length
  const total = allLessons.length
  return { completed, total, pct: total > 0 ? Math.round((completed / total) * 100) : 0 }
}
