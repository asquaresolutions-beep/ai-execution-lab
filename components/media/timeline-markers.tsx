'use client'

/**
 * TimelineMarkers — horizontal chapter strip for navigating long-form content.
 * Clicking a marker scrolls to the matching section anchor.
 * Designed to sit at the top of a long MDX document.
 *
 * Usage in MDX:
 *   <TimelineMarkers
 *     chapters={[
 *       { title: "Setup",       start: 0,   anchor: "setup" },
 *       { title: "First build", start: 180, anchor: "first-build" },
 *       { title: "Debugging",   start: 420, anchor: "debugging" },
 *       { title: "Resolution",  start: 720, anchor: "resolution" },
 *     ]}
 *   />
 */

import { useState } from 'react'
import type { MediaChapter } from '@/lib/media'
import { formatTimestamp } from '@/lib/media'

interface TimelineMarkersProps {
  chapters: MediaChapter[]
  /** Label shown before the chapter strip */
  label?: string
}

export function TimelineMarkers({ chapters, label = 'Jump to' }: TimelineMarkersProps) {
  const [active, setActive] = useState<number | null>(null)

  function scrollTo(ch: MediaChapter, index: number) {
    setActive(index)
    if (ch.anchor) {
      const el = document.getElementById(ch.anchor)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }

  if (chapters.length === 0) return null

  return (
    <nav
      aria-label="Section navigation"
      className="my-6 rounded-xl border border-surface-700/40 bg-surface-900/60 px-4 py-3 overflow-hidden"
    >
      <div className="flex items-start gap-3">
        {/* Label */}
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-surface-600 pt-1.5">
          {label}
        </span>

        {/* Scrollable strip */}
        <div className="flex-1 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1 min-w-max">
            {chapters.map((ch, i) => (
              <button
                key={i}
                onClick={() => scrollTo(ch, i)}
                className={[
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-mono transition-colors whitespace-nowrap',
                  active === i
                    ? 'bg-brand-500/15 text-brand-300 border border-brand-500/25'
                    : 'text-surface-500 hover:text-surface-200 hover:bg-surface-800/60 border border-transparent',
                ].join(' ')}
              >
                {/* Progress position indicator */}
                <span className="text-[9px] text-surface-700 tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{ch.title}</span>
                {ch.start > 0 && (
                  <span className="text-surface-700">{formatTimestamp(ch.start)}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Progress bar — fills as you scroll through chapters */}
      {active !== null && (
        <div className="mt-2 h-0.5 rounded-full bg-surface-800/60 overflow-hidden">
          <div
            className="h-full bg-brand-500/50 rounded-full transition-all duration-300"
            style={{ width: `${((active + 1) / chapters.length) * 100}%` }}
          />
        </div>
      )}
    </nav>
  )
}
