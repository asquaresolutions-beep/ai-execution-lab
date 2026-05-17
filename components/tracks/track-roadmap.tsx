'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Track, Module, Lesson } from '@/lib/tracks'
import { TRACK_ACCENTS } from '@/lib/tracks'
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

interface LessonRowProps {
  lesson:   Lesson
  module:   Module
  track:    Track
  isActive: boolean
  accent:   typeof TRACK_ACCENTS[string]
}

function LessonRow({ lesson, module, track, isActive, accent }: LessonRowProps) {
  const available = lesson.status === 'available'
  const href      = `/tracks/${track.id}/${module.id}/${lesson.id}`

  const inner = (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-lg transition-all duration-150',
        available && isActive
          ? cn(accent.bg, accent.border, 'border')
          : available
          ? 'hover:bg-white/[0.03] border border-transparent'
          : 'opacity-50 cursor-default'
      )}
    >
      {/* Type icon */}
      <span className={cn(
        'text-[11px] font-mono shrink-0 mt-0.5 w-5 text-center',
        available ? accent.text : 'text-surface-700'
      )}>
        {LESSON_TYPE_ICON[lesson.type]}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'text-sm leading-snug',
            available ? 'text-surface-200' : 'text-surface-600'
          )}>
            {lesson.title}
          </span>
          {!available && (
            <span className="text-[10px] font-mono text-surface-700 shrink-0">
              Soon
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] font-mono text-surface-700">
          <span>{LESSON_TYPE_LABEL[lesson.type]}</span>
          <span>·</span>
          <span>{lesson.duration}</span>
        </div>
      </div>

      {/* Lock / arrow */}
      <span className="shrink-0 mt-1 text-surface-700">
        {available ? (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 6l2 2 1-3" />
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

interface TrackRoadmapProps {
  track:           Track
  activeModuleId?: string
  activeLessonId?: string
}

export function TrackRoadmap({ track, activeModuleId, activeLessonId }: TrackRoadmapProps) {
  const ac = TRACK_ACCENTS[track.accent]
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    () => new Set(track.modules.map((m) => m.id))  // all open by default
  )

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
        const isOpen          = expandedModules.has(mod.id)
        const hasAvailable    = mod.lessons.some((l) => l.status === 'available')
        const availableCount  = mod.lessons.filter((l) => l.status === 'available').length

        return (
          <div key={mod.id} className="rounded-xl border border-white/[0.06] overflow-hidden">
            {/* Module header */}
            <button
              onClick={() => toggleModule(mod.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left"
            >
              {/* Number */}
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold font-mono shrink-0 border',
                hasAvailable ? cn(ac.bg, ac.border, ac.text) : 'bg-surface-900/60 border-surface-800/60 text-surface-600'
              )}>
                {modIdx + 1}
              </div>

              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-surface-200">{mod.title}</p>
                <p className="text-[11px] text-surface-600 font-mono mt-0.5">
                  {availableCount}/{mod.lessons.length} available
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

            {/* Lessons */}
            {isOpen && (
              <div className="px-2 py-2 space-y-0.5 border-t border-white/[0.04]">
                {mod.lessons.map((lesson) => (
                  <LessonRow
                    key={lesson.id}
                    lesson={lesson}
                    module={mod}
                    track={track}
                    isActive={activeModuleId === mod.id && activeLessonId === lesson.id}
                    accent={ac}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
