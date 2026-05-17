'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { Track, Module, Lesson } from '@/lib/tracks'
import { TRACK_ACCENTS } from '@/lib/tracks'
import { getOverallProgress, isLessonComplete } from '@/lib/progress'
import { ProgressRing } from './progress-ring'
import { cn } from '@/lib/utils'

const LESSON_TYPE_ICON: Record<string, string> = {
  lesson:     '◎',
  playbook:   '▶',
  lab:        '⬡',
  checkpoint: '✓',
  project:    '◆',
}

interface LessonSidebarProps {
  track:         Track
  activeModuleId: string
  activeLessonId: string
}

export function LessonSidebar({ track, activeModuleId, activeLessonId }: LessonSidebarProps) {
  const ac = TRACK_ACCENTS[track.accent]

  // All lessons flattened for progress calc
  const allLessons = track.modules.flatMap((m) =>
    m.lessons.map((l) => ({ moduleId: m.id, lessonId: l.id }))
  )

  const [progress, setProgress] = useState({ completed: 0, total: allLessons.length, pct: 0 })
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set())

  // Hydrate from localStorage on client
  useEffect(() => {
    const p = getOverallProgress(track.id, allLessons)
    setProgress(p)

    const set = new Set<string>()
    allLessons.forEach(({ moduleId, lessonId }) => {
      if (isLessonComplete(track.id, moduleId, lessonId)) {
        set.add(`${moduleId}/${lessonId}`)
      }
    })
    setCompletedSet(set)
  }, [track.id])

  // Listen for progress updates (dispatched by CompleteButton)
  useEffect(() => {
    function onUpdate() {
      const p = getOverallProgress(track.id, allLessons)
      setProgress(p)
      const set = new Set<string>()
      allLessons.forEach(({ moduleId, lessonId }) => {
        if (isLessonComplete(track.id, moduleId, lessonId)) {
          set.add(`${moduleId}/${lessonId}`)
        }
      })
      setCompletedSet(set)
    }
    window.addEventListener('track:progress', onUpdate)
    return () => window.removeEventListener('track:progress', onUpdate)
  }, [track.id])

  // Derive accent hex for ring color
  const accentHex = {
    amber:  '#fbbf24',
    brand:  '#f97316',
    cyan:   '#22d3ee',
    purple: '#c084fc',
    green:  '#4ade80',
  }[track.accent] ?? '#f97316'

  return (
    <div className="w-60 shrink-0 hidden xl:block">
      <div className="sticky top-8 space-y-4">

        {/* Track header + overall progress */}
        <div className={cn('rounded-xl border p-4', ac.border, ac.bg)}>
          <div className="flex items-center gap-3 mb-3">
            <ProgressRing
              pct={progress.pct}
              size={38}
              stroke={3}
              color={accentHex}
              showLabel
            />
            <div className="min-w-0">
              <p className={cn('text-[10px] font-mono font-bold uppercase tracking-widest', ac.text)}>
                Track
              </p>
              <p className="text-xs font-semibold text-surface-200 leading-snug line-clamp-2 mt-0.5">
                {track.title}
              </p>
            </div>
          </div>
          <div className="text-[11px] font-mono text-surface-600">
            {progress.completed} / {progress.total} lessons complete
          </div>
        </div>

        {/* Module + lesson list */}
        <nav className="space-y-2">
          {track.modules.map((mod) => (
            <div key={mod.id}>
              <p className="px-1 mb-1 text-[10px] font-semibold uppercase tracking-widest text-surface-700">
                {mod.title}
              </p>
              <div className="space-y-0.5">
                {mod.lessons.map((lesson) => {
                  const isActive    = mod.id === activeModuleId && lesson.id === activeLessonId
                  const isComplete  = completedSet.has(`${mod.id}/${lesson.id}`)
                  const isAvailable = lesson.status === 'available'
                  const href        = `/tracks/${track.id}/${mod.id}/${lesson.id}`

                  const inner = (
                    <div className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors',
                      isActive
                        ? cn('font-medium border', ac.bg, ac.border, ac.text)
                        : isAvailable
                        ? 'text-surface-500 hover:text-surface-300 hover:bg-white/[0.03]'
                        : 'text-surface-700 cursor-default'
                    )}>
                      <span className={cn('shrink-0 text-[10px]', isComplete ? 'text-green-400' : isActive ? ac.text : 'text-surface-700')}>
                        {isComplete ? '✓' : LESSON_TYPE_ICON[lesson.type]}
                      </span>
                      <span className="truncate">{lesson.title}</span>
                    </div>
                  )

                  return isAvailable
                    ? <Link key={lesson.id} href={href}>{inner}</Link>
                    : <div key={lesson.id}>{inner}</div>
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Back to track */}
        <Link
          href={`/tracks/${track.id}`}
          className="flex items-center gap-1.5 text-[11px] text-surface-700 hover:text-surface-400 transition-colors font-mono"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 6H2m0 0l3-3M2 6l3 3" />
          </svg>
          Track overview
        </Link>

      </div>
    </div>
  )
}
