'use client'

import { useState, useEffect } from 'react'

export interface GalleryImage {
  src:      string
  alt:      string
  caption?: string
}

// Responsive image gallery with lightbox.
// Usage in MDX:
//   <Gallery images={[
//     { src: '/images/a.jpg', alt: 'Description', caption: 'Optional caption' },
//   ]} />

export function Gallery({ images }: { images: GalleryImage[] }) {
  const [selected, setSelected] = useState<number | null>(null)

  // Keyboard navigation
  useEffect(() => {
    if (selected === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')     setSelected(null)
      if (e.key === 'ArrowRight') setSelected((i) => i !== null ? Math.min(i + 1, images.length - 1) : null)
      if (e.key === 'ArrowLeft')  setSelected((i) => i !== null ? Math.max(i - 1, 0) : null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selected, images.length])

  // Lock scroll when lightbox open
  useEffect(() => {
    document.body.style.overflow = selected !== null ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selected])

  return (
    <>
      {/* Grid */}
      <div className="my-8 grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-xl overflow-hidden">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className="group relative aspect-video overflow-hidden bg-surface-900 border border-surface-800/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-surface-950"
            aria-label={`View ${img.alt}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.src}
              alt={img.alt}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            {img.caption && (
              <p className="absolute bottom-0 left-0 right-0 px-2 py-1 text-[10px] text-white bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity truncate">
                {img.caption}
              </p>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {selected !== null && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          {/* Close */}
          <button
            onClick={() => setSelected(null)}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Prev */}
          {selected > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setSelected(selected - 1) }}
              className="absolute left-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Previous image"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 1L2 7l7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}

          {/* Next */}
          {selected < images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setSelected(selected + 1) }}
              className="absolute right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Next image"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 1l7 6-7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}

          {/* Image */}
          <div
            className="max-w-5xl max-h-[85vh] mx-16 flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[selected].src}
              alt={images[selected].alt}
              className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
            />
            {images[selected].caption && (
              <p className="text-sm text-surface-400 text-center">
                {images[selected].caption}
              </p>
            )}
            <p className="text-xs text-surface-600 font-mono">
              {selected + 1} / {images.length}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
