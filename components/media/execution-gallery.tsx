'use client'

/**
 * ExecutionGallery — extended gallery with step numbers, outcome badges,
 * and optional timestamps. Full lightbox included.
 *
 * Usage in MDX:
 *   <ExecutionGallery images={[
 *     {
 *       src: "/evidence/session-01/01-initial-error.png",
 *       alt: "TypeScript error in content-renderer.tsx — missing component import",
 *       caption: "Initial error state",
 *       step: 1,
 *       outcome: "failure",
 *     },
 *     {
 *       src: "/evidence/session-01/02-fix-applied.png",
 *       alt: "Build passing after adding blockJS: false to compileMDX options",
 *       caption: "Fix applied, build passing",
 *       step: 2,
 *       outcome: "success",
 *     },
 *   ]} />
 */

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export interface ExecutionGalleryImage {
  src: string
  alt: string
  caption?: string
  /** Optional sequential step number */
  step?: number
  /** Visual outcome badge */
  outcome?: 'success' | 'failure' | 'neutral'
  /** Optional timestamp label (e.g. "14:32" or "T+12m") */
  timestamp?: string
}

interface ExecutionGalleryProps {
  images: ExecutionGalleryImage[]
  /** Optional section heading */
  title?: string
}

const OUTCOME_STYLES = {
  success: { dot: 'bg-green-500', badge: 'text-green-400 bg-green-500/10 border-green-500/20', label: 'Success' },
  failure: { dot: 'bg-red-500',   badge: 'text-red-400 bg-red-500/10 border-red-500/20',       label: 'Failure' },
  neutral: { dot: 'bg-surface-500', badge: 'text-surface-400 bg-surface-800/60 border-surface-700/40', label: 'Neutral' },
}

export function ExecutionGallery({ images, title }: ExecutionGalleryProps) {
  const [selected, setSelected] = useState<number | null>(null)

  // Keyboard nav
  useEffect(() => {
    if (selected === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')     setSelected(null)
      if (e.key === 'ArrowRight') setSelected(i => i !== null ? Math.min(i + 1, images.length - 1) : null)
      if (e.key === 'ArrowLeft')  setSelected(i => i !== null ? Math.max(i - 1, 0) : null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selected, images.length])

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = selected !== null ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selected])

  return (
    <>
      <div className="my-8">
        {title && (
          <h4 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-3">
            {title}
          </h4>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {images.map((img, i) => {
            const outcome = img.outcome ? OUTCOME_STYLES[img.outcome] : null
            return (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className="group relative aspect-video overflow-hidden bg-surface-900 border border-surface-800/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-surface-950 text-left"
                aria-label={`View step ${img.step ?? i + 1}: ${img.alt}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.src}
                  alt={img.alt}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />

                {/* Step badge */}
                {img.step !== undefined && (
                  <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-surface-950/80 border border-surface-700/60 flex items-center justify-center">
                    <span className="text-[9px] font-mono font-bold text-surface-300">{img.step}</span>
                  </div>
                )}

                {/* Outcome dot */}
                {outcome && (
                  <div className={cn('absolute top-1.5 right-1.5 w-2 h-2 rounded-full', outcome.dot)} />
                )}

                {/* Timestamp */}
                {img.timestamp && (
                  <div className="absolute bottom-1.5 right-1.5 bg-black/60 rounded px-1.5 py-0.5">
                    <span className="text-[9px] font-mono text-white/70">{img.timestamp}</span>
                  </div>
                )}

                {/* Caption on hover */}
                {img.caption && (
                  <p className="absolute bottom-0 left-0 right-0 px-2 py-1.5 text-[10px] text-white bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity line-clamp-2">
                    {img.caption}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Lightbox */}
      {selected !== null && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/92 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          {/* Close */}
          <button
            onClick={() => setSelected(null)}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Prev */}
          {selected > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setSelected(selected - 1) }}
              className="absolute left-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Previous"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M9 1L2 7l7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}

          {/* Next */}
          {selected < images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setSelected(selected + 1) }}
              className="absolute right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Next"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M5 1l7 6-7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}

          {/* Content */}
          <div
            className="max-w-5xl max-h-[88vh] mx-16 flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const img = images[selected]
              const outcome = img.outcome ? OUTCOME_STYLES[img.outcome] : null
              return (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.src}
                    alt={img.alt}
                    className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
                  />
                  <div className="flex items-center gap-3">
                    {img.step !== undefined && (
                      <span className="text-[11px] font-mono text-surface-600">Step {img.step}</span>
                    )}
                    {outcome && (
                      <span className={cn('text-[10px] font-mono px-2 py-0.5 rounded border', outcome.badge)}>
                        {outcome.label}
                      </span>
                    )}
                    {img.timestamp && (
                      <span className="text-[10px] font-mono text-surface-600">{img.timestamp}</span>
                    )}
                  </div>
                  {img.caption && (
                    <p className="text-sm text-surface-400 text-center max-w-2xl">{img.caption}</p>
                  )}
                  <p className="text-xs text-surface-700 font-mono">
                    {selected + 1} / {images.length}
                  </p>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </>
  )
}
