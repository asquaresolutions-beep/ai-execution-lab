'use client'
// components/tracks/mobile-progress.tsx
// Mobile/tablet-only progress visibility for track lessons (the desktop sidebar is
// hidden below xl). Reuses the EXISTING progress system (lib/progress + the
// 'track:progress' event dispatched by CompleteButton) — no duplicate state, no
// backend. Two render modes:
//   variant="bar"  → compact progress block, shown ABOVE lesson content (mobile/tablet only)
//   variant="next" → Continue-Learning card / track-complete card, shown after the
//                    complete button on ALL viewports (continuity; never a dead-end)
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getTrackProgress } from '@/lib/progress'
import { NotifyForm } from './notify-form'

type AvailLesson = { moduleId: string; lessonId: string; title: string }

interface Props {
  variant: 'bar' | 'next'
  trackId: string
  currentModuleId: string
  currentModuleTitle: string
  currentLessonId: string
  /** Ordered, available-only lessons (status !== 'coming-soon'). */
  availableLessons: AvailLesson[]
}

export function MobileProgress({
  variant, trackId, currentModuleId, currentModuleTitle, currentLessonId, availableLessons,
}: Props) {
  // Completion set is read client-side; start empty so SSR + first client render
  // match (no hydration mismatch), then hydrate from localStorage.
  const [mounted, setMounted] = useState(false)
  const [completed, setCompleted] = useState<Set<string>>(new Set())

  useEffect(() => {
    const read = () => setCompleted(new Set(getTrackProgress(trackId).completedLessons))
    read(); setMounted(true)
    window.addEventListener('track:progress', read)
    return () => window.removeEventListener('track:progress', read)
  }, [trackId])

  const total = availableLessons.length
  const doneCount = availableLessons.filter((l) => completed.has(`${l.moduleId}/${l.lessonId}`)).length
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0
  const idx = availableLessons.findIndex((l) => l.moduleId === currentModuleId && l.lessonId === currentLessonId)
  const currentComplete = idx >= 0 && completed.has(`${currentModuleId}/${currentLessonId}`)
  const next = idx >= 0 && idx + 1 < total ? availableLessons[idx + 1] : null
  const allDone = mounted && total > 0 && doneCount === total

  // ── BAR: compact progress block (above content) ──────────────────
  if (variant === 'bar') {
    return (
      <div className="xl:hidden mb-8 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
        <p className="text-[11px] font-mono uppercase tracking-wide text-surface-500">
          Module · {currentModuleTitle}
        </p>
        <p className="mt-1 text-sm font-medium text-surface-200">
          {idx >= 0 ? `Lesson ${idx + 1} of ${total} available lessons` : `${total} available lessons in this track`}
        </p>
        <div className="mt-2.5 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-surface-300">{pct}%</span>
        </div>
      </div>
    )
  }

  // ── NEXT: continuity card (after the complete button) ────────────
  if (allDone) {
    return (
      <div className="mt-8 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-5 py-5">
        <p className="text-sm font-semibold text-emerald-300">You&apos;ve completed all currently available lessons. 🎉</p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-surface-500">Available now</p>
        <ul className="mt-2 space-y-1.5">
          {availableLessons.map((l) => (
            <li key={`${l.moduleId}/${l.lessonId}`} className="flex items-start gap-2 text-sm text-surface-300">
              <span className="text-emerald-400">✓</span>
              <span>{l.title}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-surface-400">More lessons are coming soon.</p>
        <NotifyForm lessonId={`${trackId}:track`} heading="Notify me when new lessons are released" />
      </div>
    )
  }

  if (currentComplete && next) {
    return (
      <Link
        href={`/tracks/${trackId}/${next.moduleId}/${next.lessonId}`}
        className="mt-8 block rounded-xl border border-purple-500/30 bg-purple-500/[0.07] px-5 py-4 transition hover:border-purple-500/50"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-300">Continue learning →</p>
        <p className="mt-1 text-sm font-medium text-surface-100">{next.title}</p>
      </Link>
    )
  }

  return null
}
