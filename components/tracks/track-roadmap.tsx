'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import type { Track, Module, Lesson } from '@/lib/tracks'
import { TRACK_ACCENTS } from '@/lib/tracks'
import { getTrackProgress } from '@/lib/progress'
import { cn } from '@/lib/utils'

const LESSON_TYPE_ICON: Record<string, string> = {
  lesson:     '◎',
  playbook:   '▶',
  lab:        '⬡',
  checkpoint: '✓',
  project:    '◆',
}

const LESSON_TYPE_LABEL: Record<string, string> = {
  lesson:     'Lesson',
  playbook:   'Playbook',
  lab:        'Lab',
  checkpoint: 'Checkpoint',
  project:    'Project',
}

// ─────────────────────────────────────────────────────────────
// Lesson row
// ─────────────────────────────────────────────────────────────

interface LessonRowProps {
  lesson:    Lesson
  module:    Module
  track:     Track
  isActive:  boolean
  isDone:    boolean
  accent:    typeof TRACK_ACCENTS[string]
}

function LessonRow({ lesson, module, track, isActive, isDone, accent }: LessonRowProps) {
  const available = lesson.status === 'available'
  const href      = `/tracks/${track.id}/${module.id}/${lesson.id}`

  const inner = (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-lg transition-all duration-150 group',
        available && isActive
          ? cn(accent.bg, accent.border, 'border')
          : available
          ? 'hover:bg-white/[0.04] border border-transparent'
          : 'opacity-40 cursor-default'
      )}
    >
      {/* Type icon or completion check */}
      <span className={cn(
        'text-[11px] font-mono shrink-0 mt-0.5 w-5 text-center',
        isDone ? 'text-green-400' : available ? accent.text : 'text-surface-700'
      )}>
        {isDone ? '✓' : LESSON_TYPE_ICON[lesson.type]}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'text-sm leading-snug',
            isDone       ? 'text-surface-400 line-through decoration-surface-600'
            : available  ? 'text-surface-200'
            : 'text-surface-600'
          )}>
            {lesson.title}
          </span>
          {!available && (
            <span className="text-[10px] font-mono text-surface-700 shrink-0">Soon</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] font-mono text-surface-700">
          <span>{LESSON_TYPE_LABEL[lesson.type]}</span>
          <span>·</span>
          <span>{lesson.duration}</span>
        </div>
      </div>

      {/* State icon */}
      <span className={cn('shrink-0 mt-1', isDone ? 'text-green-500' : 'text-surface-700')}>
        {isDone ? (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 12 12">
            <path fillRule="evenodd" d="M10.03 3.47a.75.75 0 0 1 0 1.06L5.06 9.5 2 6.44a.75.75 0 1 1 1.06-1.06l2 2 3.97-3.97a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
        ) : available ? (
          <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 12 12" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 3L7.5 6l-3 3" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.5 5V4a2.5 2.5 0 015 0v1M2.5 5h7a1 1 0 011 1v4a1 1 0 01-1 1h-7a1 1 0 01-1-1V6a1 1 0 011-1z" />
          </svg>
        )}
      </span>
    </div>
  )

  return available ? <Link href={href}>{inner}</Link> : inner
}

// ─────────────────────────────────────────────────────────────
// Module completion badge
// ─────────────────────────────────────────────────────────────

function ModuleCompletionBadge({
  completed,
  available,
  accent,
}: {
  completed: number
  available: number
  accent: typeof TRACK_ACCENTS[string]
}) {
  if (available === 0) return null

  const allDone = completed === available && available > 0
  const someDone = completed > 0

  if (allDone) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-mono text-green-400 bg-green-500/10 border border-green-500/20 rounded px-1.5 py-0.5">
        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 12 12">
          <path fillRule="evenodd" d="M10.03 3.47a.75.75 0 0 1 0 1.06L5.06 9.5 2 6.44a.75.75 0 1 1 1.06-1.06l2 2 3.97-3.97a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
        </svg>
        Done
      </span>
    )
  }

  if (someDone) {
    return (
      <span className={cn(
        'text-[10px] font-mono rounded px-1.5 py-0.5',
        accent.text, accent.bg, accent.border, 'border'
      )}>
        {completed}/{available}
      </span>
    )
  }

  return null
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

interface TrackRoadmapProps {
  track:           Track
  activeModuleId?: string
  activeLessonId?: string
}

export function TrackRoadmap({ track, activeModuleId, activeLessonId }: TrackRoadmapProps) {
  const ac = TRACK_ACCENTS[track.accent]

  // All modules open by default; active module always open
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    () => new Set(track.modules.map((m) => m.id))
  )

  // Per-module completion counters, hydrated from localStorage
  const [moduleProgress, setModuleProgress] = useState<Record<string, { completed: number; available: number }>>({})

  useEffect(() => {
    function loadProgress() {
      const progress = getTrackProgress(track.id)
      const map: Record<string, { completed: number; available: number }> = {}
      for (const mod of track.modules) {
        const availableLessons = mod.lessons.filter(l => l.status === 'available')
        const completedCount   = availableLessons.filter(
          l => progress.completedLessons.includes(`${mod.id}/${l.id}`)
        ).length
        map[mod.id] = { completed: completedCount, available: availableLessons.length }
      }
      setModuleProgress(map)
    }

    loadProgress()
    window.addEventListener('track:progress', loadProgress)
    return () => window.removeEventListener('track:progress', loadProgress)
  }, [track])

  // Ensure active module stays open
  useEffect(() => {
    if (activeModuleId) {
      setExpandedModules(prev => {
        if (prev.has(activeModuleId)) return prev
        const next = new Set(prev)
        next.add(activeModuleId)
        return next
      })
    }
  }, [activeModuleId])

  function toggleModule(id: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-2">
      {track.modules.map((mod, modIdx) => {
        const isOpen         = expandedModules.has(mod.id)
        const isActive       = mod.id === activeModuleId
        const hasAvailable   = mod.lessons.some(l => l.status === 'available')
        const modProg        = moduleProgress[mod.id] ?? { completed: 0, available: 0 }
        const allDone        = modProg.completed === modProg.available && modProg.available > 0

        // Get lesson completion map for this module
        const progress = typeof window !== 'undefined'
          ? getTrackProgress(track.id)
          : { completedLessons: [] as string[] }

        return (
          <div
            key={mod.id}
            className={cn(
              'rounded-xl border overflow-hidden transition-all',
              isActive
                ? cn('border-white/[0.10]', 'shadow-sm')
                : allDone
                ? 'border-green-500/15'
                : 'border-white/[0.06]'
            )}
          >
            {/* Module header */}
            <button
              onClick={() => toggleModule(mod.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left',
                isActive
                  ? 'bg-white/[0.04] hover:bg-white/[0.05]'
                  : allDone
                  ? 'bg-green-500/[0.03] hover:bg-green-500/[0.05]'
                  : 'bg-white/[0.02] hover:bg-white/[0.035]'
              )}
            >
              {/* Module number badge */}
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold font-mono shrink-0 border',
                allDone
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : hasAvailable
                  ? cn(ac.bg, ac.border, ac.text)
                  : 'bg-surface-900/60 border-surface-800/60 text-surface-600'
              )}>
                {allDone ? '✓' : modIdx + 1}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={cn(
                    'text-sm font-semibold',
                    isActive ? 'text-surface-100' : 'text-surface-200'
                  )}>
                    {mod.title}
                  </p>
                  <ModuleCompletionBadge
                    completed={modProg.completed}
                    available={modProg.available}
                    accent={ac}
                  />
                </div>
                <p className="text-[11px] text-surface-600 font-mono mt-0.5">
                  {mod.lessons.filter(l => l.status === 'available').length}/{mod.lessons.length} available
                </p>
              </div>

              {/* Chevron */}
              <svg
                className={cn('w-4 h-4 text-surface-600 transition-transform shrink-0', isOpen && 'rotate-180')}
                fill="none" viewBox="0 0 16 16" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6l4 4 4-4" />
              </svg>
            </button>

            {/* Lesson list */}
            {isOpen && (
              <div className="px-2 py-2 space-y-0.5 border-t border-white/[0.04]">
                {mod.lessons.map((lesson) => {
                  const isDone = progress.completedLessons.includes(`${mod.id}/${lesson.id}`)
                  return (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      module={mod}
                      track={track}
                      isActive={activeModuleId === mod.id && activeLessonId === lesson.id}
                      isDone={isDone}
                      accent={ac}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
