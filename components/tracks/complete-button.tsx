'use client'

import { useEffect, useState } from 'react'
import { setLessonComplete, isLessonComplete } from '@/lib/progress'
import { cn } from '@/lib/utils'

interface CompleteButtonProps {
  trackId:  string
  moduleId: string
  lessonId: string
  accentClass: string  // e.g. 'bg-brand-500'
}

export function CompleteButton({ trackId, moduleId, lessonId, accentClass }: CompleteButtonProps) {
  const [complete, setComplete] = useState(false)
  const [justDone, setJustDone] = useState(false)

  // Hydrate from localStorage
  useEffect(() => {
    setComplete(isLessonComplete(trackId, moduleId, lessonId))
  }, [trackId, moduleId, lessonId])

  function toggle() {
    const next = !complete
    setLessonComplete(trackId, moduleId, lessonId, next)
    setComplete(next)

    if (next) {
      setJustDone(true)
      setTimeout(() => setJustDone(false), 2000)
    }

    // Notify lesson sidebar to refresh its progress state
    window.dispatchEvent(new Event('track:progress'))
  }

  return (
    <button
      onClick={toggle}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200',
        complete
          ? 'bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/10'
          : `${accentClass} text-white hover:opacity-90 shadow-sm`
      )}
    >
      {justDone ? (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l4 4 6-7" />
          </svg>
          Marked complete!
        </>
      ) : complete ? (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l4 4 6-7" />
          </svg>
          Completed — undo
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 3v5l3 2" />
          </svg>
          Mark as Complete
        </>
      )}
    </button>
  )
}
