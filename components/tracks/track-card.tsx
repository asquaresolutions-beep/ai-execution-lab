import Link from 'next/link'
import type { Track } from '@/lib/tracks'
import { TRACK_ACCENTS, getTrackStats } from '@/lib/tracks'
import { cn } from '@/lib/utils'

const LEVEL_LABEL: Record<string, string> = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
  operator:     'Operator',
}

const TYPE_ICON: Record<string, string> = {
  lesson:     '◎',
  playbook:   '▶',
  lab:        '⬡',
  checkpoint: '✓',
  project:    '◆',
}

interface TrackCardProps {
  track: Track
  className?: string
}

export function TrackCard({ track, className }: TrackCardProps) {
  const ac    = TRACK_ACCENTS[track.accent]
  const stats = getTrackStats(track)

  return (
    <Link
      href={`/tracks/${track.id}`}
      className={cn(
        'group block rounded-xl border border-white/[0.06] bg-white/[0.015] p-6',
        'hover:border-white/[0.12] hover:bg-white/[0.03] transition-all duration-200',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={cn('text-[10px] font-mono font-bold uppercase tracking-widest', ac.text)}>
              Track
            </span>
            <span className="text-[10px] font-mono text-surface-700">
              {LEVEL_LABEL[track.level]}
            </span>
            {track.status === 'coming-soon' && (
              <span className="text-[10px] font-mono text-surface-700 bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5">
                Coming Soon
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-surface-100 group-hover:text-white transition-colors leading-snug">
            {track.title}
          </h3>
        </div>

        {/* Hours badge */}
        <div className={cn('shrink-0 rounded-lg px-2.5 py-2 text-center', ac.bg, ac.border, 'border')}>
          <p className={cn('text-sm font-bold font-mono leading-none', ac.text)}>
            {track.estimatedHours}h
          </p>
          <p className="text-[10px] text-surface-600 mt-0.5">total</p>
        </div>
      </div>

      {/* Tagline */}
      <p className="text-xs text-surface-500 leading-relaxed mb-4 line-clamp-2">
        {track.tagline}
      </p>

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-4 text-[11px] font-mono text-surface-700">
        <span>{stats.moduleCount} modules</span>
        <span className="text-surface-800">·</span>
        <span>{stats.totalLessons} lessons</span>
        <span className="text-surface-800">·</span>
        <span>{stats.availableLessons} available</span>
      </div>

      {/* Module preview dots */}
      <div className="flex items-center gap-1.5 mb-4">
        {track.modules.map((mod, i) => {
          const available = mod.lessons.some((l) => l.status === 'available')
          return (
            <div
              key={mod.id}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                available ? ac.bg.replace('/10', '/40') : 'bg-white/[0.04]'
              )}
              title={mod.title}
            />
          )
        })}
      </div>

      {/* Tools */}
      <div className="flex flex-wrap gap-1">
        {track.tools.slice(0, 4).map((tool) => (
          <span
            key={tool}
            className="text-[10px] font-mono text-surface-700 bg-white/[0.03] border border-white/[0.05] rounded px-1.5 py-0.5"
          >
            {tool}
          </span>
        ))}
        {track.tools.length > 4 && (
          <span className="text-[10px] font-mono text-surface-700">+{track.tools.length - 4}</span>
        )}
      </div>
    </Link>
  )
}
