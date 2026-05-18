'use client'

/**
 * components/platform/bookmark-button.tsx
 * Client-side bookmark toggle. No auth required — localStorage only.
 * Drop into any lesson or content page.
 */

import { useState, useEffect } from 'react'
import { isBookmarked, toggleBookmark, type Bookmark } from '@/lib/bookmarks'

interface Props {
  href:     string
  title:    string
  type:     string
  section?: string
  className?: string
}

export function BookmarkButton({ href, title, type, section, className = '' }: Props) {
  const [bookmarked, setBookmarked] = useState(false)
  const [mounted,    setMounted]    = useState(false)

  // Avoid hydration mismatch — localStorage isn't available SSR
  useEffect(() => {
    setMounted(true)
    setBookmarked(isBookmarked(href))
  }, [href])

  function handleClick() {
    const item: Omit<Bookmark, 'addedAt'> = { href, title, type, section }
    const next = toggleBookmark(item)
    setBookmarked(next)
  }

  if (!mounted) {
    return (
      <button
        className={`inline-flex items-center gap-1.5 text-[11px] font-mono text-surface-700 rounded px-2 py-1 border border-transparent hover:border-white/[0.08] transition-colors ${className}`}
        aria-label="Bookmark"
        title="Bookmark"
      >
        <span className="text-surface-700">○</span>
        <span className="hidden sm:inline">Save</span>
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 text-[11px] font-mono rounded px-2 py-1 border transition-all ${
        bookmarked
          ? 'text-amber-400 border-amber-500/25 bg-amber-500/[0.06] hover:bg-amber-500/[0.10]'
          : 'text-surface-600 border-transparent hover:border-white/[0.08] hover:text-surface-400'
      } ${className}`}
      aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this page'}
      title={bookmarked ? 'Remove bookmark' : 'Save to reading queue'}
    >
      <span>{bookmarked ? '●' : '○'}</span>
      <span className="hidden sm:inline">{bookmarked ? 'Saved' : 'Save'}</span>
    </button>
  )
}
