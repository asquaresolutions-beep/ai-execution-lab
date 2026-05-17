import Link from 'next/link'
import type { Module, Lesson } from '@/lib/tracks'
import { cn } from '@/lib/utils'

interface LessonNavProps {
  trackId: string
  prev: { module: Module; lesson: Lesson } | null
  next: { module: Module; lesson: Lesson } | null
}

export function LessonNav({ trackId, prev, next }: LessonNavProps) {
  if (!prev && !next) return null

  return (
    <nav
      aria-label="Lesson navigation"
      className="mt-12 pt-8 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 gap-3"
    >
      {prev ? (
        <Link
          href={`/tracks/${trackId}/${prev.module.id}/${prev.lesson.id}`}
          className="group flex flex-col gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 hover:border-white/[0.12] hover:bg-white/[0.04] transition-all"
        >
          <span className="text-[10px] font-mono text-surface-600 uppercase tracking-widest">
            ← Previous
          </span>
          <span className="text-xs text-surface-500 font-mono">{prev.module.title}</span>
          <span className="text-sm font-medium text-surface-300 group-hover:text-surface-100 transition-colors line-clamp-2">
            {prev.lesson.title}
          </span>
        </Link>
      ) : (
        <div />
      )}

      {next ? (
        <Link
          href={`/tracks/${trackId}/${next.module.id}/${next.lesson.id}`}
          className={cn(
            'group flex flex-col gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3',
            'hover:border-white/[0.12] hover:bg-white/[0.04] transition-all',
            !prev ? 'sm:col-start-2' : 'sm:text-right'
          )}
        >
          <span className="text-[10px] font-mono text-surface-600 uppercase tracking-widest">
            Next →
          </span>
          <span className="text-xs text-surface-500 font-mono">{next.module.title}</span>
          <span className="text-sm font-medium text-surface-300 group-hover:text-surface-100 transition-colors line-clamp-2">
            {next.lesson.title}
          </span>
        </Link>
      ) : (
        <div />
      )}
    </nav>
  )
}
