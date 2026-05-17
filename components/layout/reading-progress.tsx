'use client'

import { useEffect, useState } from 'react'

// Thin reading-progress bar fixed at top of viewport.
// Only visible when page is scrollable (progress > 0).

export function ReadingProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function update() {
      const scrollY  = window.scrollY
      const docH     = document.documentElement.scrollHeight - window.innerHeight
      setProgress(docH > 0 ? Math.min(100, (scrollY / docH) * 100) : 0)
    }

    window.addEventListener('scroll', update, { passive: true })
    update() // run once on mount
    return () => window.removeEventListener('scroll', update)
  }, [])

  if (progress === 0) return null

  return (
    <div
      className="fixed top-0 left-0 z-[60] h-[2px] bg-brand-500 pointer-events-none"
      style={{
        width: `${progress}%`,
        transition: 'width 80ms linear',
        boxShadow: '0 0 8px rgba(249,115,22,0.5)',
      }}
    />
  )
}
