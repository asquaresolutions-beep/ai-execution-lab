'use client'

/**
 * YouTubeWalkthrough — enhanced YouTube embed with chapter navigation,
 * TranscriptBlock integration, and VideoObject JSON-LD.
 *
 * Usage in MDX:
 *   <YouTubeWalkthrough
 *     id="dQw4w9WgXcQ"
 *     title="Claude Code: Full Session Walkthrough"
 *     duration={1842}
 *     uploadDate="2026-05-17"
 *     chapters={[
 *       { title: "Intro", start: 0 },
 *       { title: "First prompt", start: 120 },
 *     ]}
 *   />
 */

import { useState } from 'react'
import type { MediaChapter, TranscriptEntry } from '@/lib/media'
import { formatTimestamp, formatISO8601Duration } from '@/lib/media'
import { TranscriptBlock } from './transcript-block'

interface YouTubeWalkthroughProps {
  /** YouTube video ID */
  id: string
  title: string
  duration: number
  uploadDate: string
  description?: string
  thumbnailUrl?: string
  chapters?: MediaChapter[]
  transcript?: TranscriptEntry[]
}

export function YouTubeWalkthrough({
  id,
  title,
  duration,
  uploadDate,
  description,
  thumbnailUrl,
  chapters = [],
  transcript = [],
}: YouTubeWalkthroughProps) {
  const [startTime, setStartTime] = useState(0)
  const [activeChapter, setActiveChapter] = useState(0)
  const [key, setKey] = useState(0) // force iframe reload on chapter click

  function seekTo(seconds: number, index: number) {
    setStartTime(seconds)
    setActiveChapter(index)
    setKey(k => k + 1) // remount the iframe with new start param
  }

  const src = `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&start=${startTime}${startTime > 0 ? '&autoplay=1' : ''}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: title,
    description: description ?? title,
    duration: formatISO8601Duration(duration),
    uploadDate,
    embedUrl: `https://www.youtube.com/embed/${id}`,
    thumbnailUrl: thumbnailUrl ?? `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
    ...(chapters.length > 0 ? {
      hasPart: chapters.map((ch, i) => ({
        '@type': 'Clip',
        name: ch.title,
        startOffset: ch.start,
        endOffset: ch.end ?? (chapters[i + 1]?.start ?? duration),
        url: `https://www.youtube.com/watch?v=${id}&t=${ch.start}s`,
      })),
    } : {}),
  }

  return (
    <figure className="my-8 rounded-xl overflow-hidden border border-surface-700/60 shadow-xl">

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Embed */}
      <div className="aspect-video bg-black">
        <iframe
          key={key}
          src={src}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          className="w-full h-full"
        />
      </div>

      {/* Chapter strip */}
      {chapters.length > 0 && (
        <div className="bg-surface-900/80 border-t border-surface-800/60">
          <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto scrollbar-none">
            {chapters.map((ch, i) => (
              <button
                key={i}
                onClick={() => seekTo(ch.start, i)}
                className={[
                  'shrink-0 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-mono transition-colors',
                  activeChapter === i
                    ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                    : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/60 border border-transparent',
                ].join(' ')}
              >
                <span className="text-surface-600">{formatTimestamp(ch.start)}</span>
                <span className="truncate max-w-[120px]">{ch.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Caption */}
      <figcaption className="px-4 py-2 bg-surface-900/60 border-t border-surface-800/40">
        <div className="flex items-center justify-between">
          <span className="text-xs text-surface-500 font-mono">{title}</span>
          <span className="text-[10px] font-mono text-surface-700">{formatTimestamp(duration)}</span>
        </div>
      </figcaption>

      {/* Transcript */}
      {transcript.length > 0 && (
        <div className="border-t border-surface-800/40 bg-surface-950/40">
          <TranscriptBlock entries={transcript} />
        </div>
      )}
    </figure>
  )
}
