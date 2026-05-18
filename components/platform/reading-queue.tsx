'use client'

/**
 * components/platform/reading-queue.tsx
 * Displays the operator's saved bookmarks. Client-only.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getBookmarks, removeBookmark, clearBookmarks, type Bookmark } from '@/lib/bookmarks'

const TYPE_STYLES: Record<string, string> = {
  lesson:       'text-brand-400',
  failure:      'text-red-400',
  playbook:     'text-cyan-400',
  log:          'text-surface-500',
  doc:          'text-surface-500',
  'case-study': 'text-amber-400',
  lab:          'text-purple-400',
  system:       'text-green-400',
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 7)   return `${days} days ago`
  if (days < 30)  return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

export function ReadingQueue() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setBookmarks(getBookmarks())
  }, [])

  function handleRemove(href: string) {
    removeBookmark(href)
    setBookmarks(getBookmarks())
  }

  function handleClear() {
    clearBookmarks()
    setBookmarks([])
  }

  if (!mounted) return null

  if (bookmarks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.06] px-5 py-6 text-center">
        <p className="text-xs text-surface-600">Reading queue is empty.</p>
        <p className="text-[11px] text-surface-700 mt-1">
          Click <span className="font-mono text-surface-500">○ Save</span> on any lesson, failure, or playbook to add it here.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono text-surface-700 uppercase tracking-widest">
          {bookmarks.length} item{bookmarks.length !== 1 ? 's' : ''} saved
        </span>
        <button
          onClick={handleClear}
          className="text-[10px] font-mono text-surface-700 hover:text-red-400 transition-colors"
        >
          Clear all
        </button>
      </div>

      <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
        {bookmarks.map(b => (
          <div key={b.href} className="flex items-center gap-3 px-4 py-3 group hover:bg-white/[0.02] transition-colors">
            <span className={`text-[10px] font-mono shrink-0 w-16 truncate ${TYPE_STYLES[b.type] ?? 'text-surface-600'}`}>
              {b.type}
            </span>
            <Link
              href={b.href}
              className="flex-1 min-w-0"
            >
              <p className="text-sm text-surface-300 hover:text-surface-100 transition-colors truncate">
                {b.title}
              </p>
              {b.section && (
                <p className="text-[10px] text-surface-700 truncate mt-0.5">{b.section}</p>
              )}
            </Link>
            <span className="text-[10px] font-mono text-surface-800 shrink-0 hidden sm:block">
              {timeAgo(b.addedAt)}
            </span>
            <button
              onClick={() => handleRemove(b.href)}
              className="text-[10px] font-mono text-surface-800 hover:text-red-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
              aria-label="Remove bookmark"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
