'use client'

/**
 * ArchitectureDiagram — image viewer with optional lightbox zoom and
 * annotation dot overlay for callouts on specific coordinates.
 *
 * Usage in MDX:
 *   <ArchitectureDiagram
 *     src="/diagrams/stack-overview.png"
 *     alt="AI Execution Lab stack — Next.js 15, Vercel, MDX, Tailwind"
 *     caption="Production stack as of 2026-05-17"
 *     annotations={[
 *       { x: 25, y: 40, label: "Content layer: MDX files in /content" },
 *       { x: 70, y: 20, label: "Vercel Edge Network" },
 *     ]}
 *   />
 */

import { useState } from 'react'

interface Annotation {
  /** Horizontal position as percentage (0–100) of image width */
  x: number
  /** Vertical position as percentage (0–100) of image height */
  y: number
  /** Label shown on hover */
  label: string
}

interface ArchitectureDiagramProps {
  src: string
  alt: string
  caption?: string
  annotations?: Annotation[]
  /** Disable lightbox (default: false — lightbox enabled) */
  noZoom?: boolean
}

export function ArchitectureDiagram({
  src,
  alt,
  caption,
  annotations = [],
  noZoom = false,
}: ArchitectureDiagramProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [activeAnnotation, setActiveAnnotation] = useState<number | null>(null)

  return (
    <>
      <figure className="my-8 rounded-xl overflow-hidden border border-surface-700/60 bg-surface-950">
        {/* Image container */}
        <div
          className={['relative group', !noZoom ? 'cursor-zoom-in' : ''].join(' ')}
          onClick={() => !noZoom && setLightboxOpen(true)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="w-full h-auto block"
          />

          {/* Annotation dots */}
          {annotations.map((ann, i) => (
            <button
              key={i}
              style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-brand-500 border-2 border-white/80 shadow-lg hover:scale-125 transition-transform focus:outline-none focus:ring-2 focus:ring-brand-400"
              onClick={(e) => { e.stopPropagation(); setActiveAnnotation(activeAnnotation === i ? null : i) }}
              aria-label={ann.label}
            >
              <span className="sr-only">{ann.label}</span>
            </button>
          ))}

          {/* Active annotation tooltip */}
          {activeAnnotation !== null && annotations[activeAnnotation] && (
            <div
              style={{
                left: `${Math.min(annotations[activeAnnotation].x, 70)}%`,
                top: `${annotations[activeAnnotation].y + 5}%`,
              }}
              className="absolute z-10 bg-surface-900 border border-surface-700/80 rounded-lg px-3 py-2 max-w-[200px] shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs text-surface-200 leading-snug">
                {annotations[activeAnnotation].label}
              </p>
              <button
                onClick={() => setActiveAnnotation(null)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-surface-700 text-surface-400 text-[9px] flex items-center justify-center hover:bg-surface-600"
                aria-label="Close annotation"
              >
                ✕
              </button>
            </div>
          )}

          {/* Zoom hint */}
          {!noZoom && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-md px-2 py-1">
              <span className="text-[10px] font-mono text-white/70">click to expand</span>
            </div>
          )}
        </div>

        {/* Caption */}
        {caption && (
          <figcaption className="px-4 py-2.5 border-t border-surface-800/40 bg-surface-900/40">
            <p className="text-xs text-surface-500">{caption}</p>
          </figcaption>
        )}
      </figure>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/92 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <div
            className="max-w-6xl max-h-[90vh] mx-8 flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-[82vh] object-contain rounded-lg shadow-2xl"
            />
            {caption && (
              <p className="text-sm text-surface-400 text-center">{caption}</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
