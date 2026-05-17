'use client'

/**
 * TranscriptBlock — collapsible transcript with timestamps and speaker labels.
 * Can be used standalone or embedded inside TerminalRecording / YouTubeWalkthrough.
 *
 * Usage in MDX:
 *   <TranscriptBlock
 *     entries={[
 *       { time: 0,  speaker: "Dev",     text: "Starting the project..." },
 *       { time: 12, speaker: "Claude",  text: "I'll scaffold the route first." },
 *     ]}
 *   />
 */

import { useState } from 'react'
import type { TranscriptEntry } from '@/lib/media'
import { formatTimestamp } from '@/lib/media'

interface TranscriptBlockProps {
  entries: TranscriptEntry[]
  /** When true, renders expanded by default */
  defaultOpen?: boolean
  title?: string
}

const SPEAKER_COLORS: Record<string, string> = {
  claude:   'text-brand-400',
  dev:      'text-green-400',
  terminal: 'text-yellow-400',
  system:   'text-surface-500',
}

function speakerColor(speaker: string): string {
  return SPEAKER_COLORS[speaker.toLowerCase()] ?? 'text-surface-400'
}

export function TranscriptBlock({
  entries,
  defaultOpen = false,
  title = 'Transcript',
}: TranscriptBlockProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="my-4 rounded-xl border border-surface-800/60 bg-surface-950/60 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-800/30 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-surface-600" aria-hidden="true">
            <path d="M2 3h10M2 7h7M2 11h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-surface-600">
            {title}
          </span>
          <span className="text-[10px] font-mono text-surface-700">
            {entries.length} {entries.length === 1 ? 'cue' : 'cues'}
          </span>
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={['text-surface-600 transition-transform', open ? 'rotate-180' : ''].join(' ')}
          aria-hidden="true"
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Entries */}
      {open && (
        <div className="divide-y divide-surface-800/40 max-h-80 overflow-y-auto">
          {entries.map((entry, i) => (
            <div key={i} className="flex gap-3 px-4 py-2.5 hover:bg-surface-800/20 transition-colors">
              <span className="shrink-0 w-12 text-[10px] font-mono text-surface-700 pt-0.5">
                {formatTimestamp(entry.time)}
              </span>
              {entry.speaker && (
                <span className={['shrink-0 text-[10px] font-mono font-semibold w-16 pt-0.5 truncate', speakerColor(entry.speaker)].join(' ')}>
                  {entry.speaker}
                </span>
              )}
              <p className="text-xs text-surface-300 leading-relaxed flex-1">
                {entry.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
