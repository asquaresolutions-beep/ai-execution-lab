/**
 * LessonMeta — implementation metadata bar for lessons.
 * Shows difficulty, implementation time estimate, and production-verified badge.
 * Place at the top of lesson MDX content, after the intro paragraph.
 *
 * Usage:
 *   <LessonMeta
 *     difficulty="advanced"
 *     implementationTime="45–90 min"
 *     evidence="Verified in production deployment of ai-execution-lab"
 *   />
 */

import { cn } from '@/lib/utils'

type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'operator'

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; classes: string }> = {
  beginner:     { label: 'Beginner',     classes: 'text-green-400 bg-green-500/10 border-green-500/25' },
  intermediate: { label: 'Intermediate', classes: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25' },
  advanced:     { label: 'Advanced',     classes: 'text-orange-400 bg-orange-500/10 border-orange-500/25' },
  operator:     { label: 'Operator',     classes: 'text-brand-400 bg-brand-500/10 border-brand-500/25' },
}

interface LessonMetaProps {
  difficulty?: Difficulty
  /** Estimated wall-clock implementation time (not reading time) */
  implementationTime?: string
  /** Short sentence confirming production verification */
  evidence?: string
}

export function LessonMeta({ difficulty, implementationTime, evidence }: LessonMetaProps) {
  if (!difficulty && !implementationTime && !evidence) return null

  return (
    <div className="my-6 flex flex-wrap items-center gap-2.5">
      {difficulty && (
        <span className={cn(
          'inline-flex items-center gap-1.5 text-[11px] font-mono rounded-full px-2.5 py-1 border',
          DIFFICULTY_CONFIG[difficulty].classes
        )}>
          <span className="text-[9px]">●</span>
          {DIFFICULTY_CONFIG[difficulty].label}
        </span>
      )}

      {implementationTime && (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-surface-500 bg-surface-800/50 border border-surface-700/40 rounded-full px-2.5 py-1">
          <span className="text-[10px]">⏱</span>
          {implementationTime} to implement
        </span>
      )}

      {evidence && (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-brand-400/80 bg-brand-500/8 border border-brand-500/20 rounded-full px-2.5 py-1">
          <span className="text-[10px]">⬡</span>
          {evidence}
        </span>
      )}
    </div>
  )
}
