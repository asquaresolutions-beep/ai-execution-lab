'use client'

import { useState, useRef, useCallback } from 'react'

// Draggable before/after image comparison slider.
// Usage in MDX:
//   <BeforeAfter
//     before="/images/before.jpg"
//     after="/images/after.jpg"
//     beforeLabel="Before"
//     afterLabel="After"
//   />

export function BeforeAfter({
  before,
  after,
  beforeLabel = 'Before',
  afterLabel  = 'After',
  height      = 360,
}: {
  before:       string
  after:        string
  beforeLabel?: string
  afterLabel?:  string
  height?:      number
}) {
  const [position, setPosition]   = useState(50)
  const [dragging, setDragging]   = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const updatePosition = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const pct = ((clientX - rect.left) / rect.width) * 100
    setPosition(Math.max(2, Math.min(98, pct)))
  }, [])

  return (
    <figure className="my-8">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl border border-surface-700/60 shadow-lg select-none touch-none"
        style={{ height }}
        onMouseMove={(e) => dragging && updatePosition(e.clientX)}
        onMouseDown={(e) => { setDragging(true); updatePosition(e.clientX) }}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
        onTouchMove={(e) => updatePosition(e.touches[0].clientX)}
        onTouchStart={(e) => updatePosition(e.touches[0].clientX)}
        aria-label={`Before/after comparison: ${beforeLabel} vs ${afterLabel}`}
      >
        {/* After (base layer — full width) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={after}
          alt={afterLabel}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />

        {/* After label */}
        <span className="absolute top-3 right-3 z-10 text-xs font-semibold bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-md border border-white/10">
          {afterLabel}
        </span>

        {/* Before (clipped to left side) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={before}
          alt={beforeLabel}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          draggable={false}
        />

        {/* Before label */}
        <span className="absolute top-3 left-3 z-10 text-xs font-semibold bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-md border border-white/10">
          {beforeLabel}
        </span>

        {/* Divider line */}
        <div
          className="absolute top-0 bottom-0 z-20 flex items-center justify-center"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        >
          <div className="w-0.5 h-full bg-white/80 shadow-[0_0_8px_rgba(0,0,0,0.5)]" />
          {/* Handle */}
          <div
            className="absolute w-9 h-9 rounded-full bg-white shadow-xl border-2 border-surface-200 flex items-center justify-center cursor-col-resize"
            style={{ top: '50%', transform: 'translate(-50%,-50%)', left: '50%' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 2L2 7l3 5M9 2l3 5-3 5" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </figure>
  )
}
