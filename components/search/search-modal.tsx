'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { SearchItem } from '@/lib/search-index'
import { SECTION_META } from '@/lib/utils'
import type { ContentSection } from '@/lib/content'

// ─────────────────────────────────────────────────────────────
// Module-level cache so we don't refetch every open
// ─────────────────────────────────────────────────────────────

let cachedItems: SearchItem[] | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fuseInstance: any = null

// ─────────────────────────────────────────────────────────────
// Search modal
// ─────────────────────────────────────────────────────────────

export function SearchModal() {
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<SearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)

  const inputRef  = useRef<HTMLInputElement>(null)
  const listRef   = useRef<HTMLDivElement>(null)
  const router    = useRouter()

  // ── Open / close ──────────────────────────────────────────

  const openModal  = useCallback(() => setOpen(true),  [])
  const closeModal = useCallback(() => {
    setOpen(false)
    setQuery('')
    setActiveIdx(0)
  }, [])

  // ── Global keyboard & custom event listeners ───────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') closeModal()
    }
    function onOpen() { openModal() }

    document.addEventListener('keydown', onKey)
    window.addEventListener('search:open', onOpen)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('search:open', onOpen)
    }
  }, [openModal, closeModal])

  // ── Load index on first open ───────────────────────────────

  useEffect(() => {
    if (!open) return

    setTimeout(() => inputRef.current?.focus(), 30)

    if (cachedItems) {
      setResults(cachedItems.slice(0, 8))
      return
    }

    setLoading(true)
    fetch('/api/search')
      .then((r) => r.json())
      .then(async (data: SearchItem[]) => {
        cachedItems = data

        const Fuse = (await import('fuse.js')).default
        fuseInstance = new Fuse(data, {
          keys: [
            { name: 'title',       weight: 3 },
            { name: 'description', weight: 2 },
            { name: 'tags',        weight: 1 },
          ],
          threshold: 0.35,
          includeScore: true,
        })

        setResults(data.slice(0, 8))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [open])

  // ── Search ─────────────────────────────────────────────────

  useEffect(() => {
    if (!cachedItems) return
    if (!query.trim()) {
      setResults(cachedItems.slice(0, 8))
      setActiveIdx(0)
      return
    }
    if (fuseInstance) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = fuseInstance.search(query).slice(0, 8).map((r: any) => r.item)
      setResults(res)
      setActiveIdx(0)
    }
  }, [query])

  // ── Keyboard navigation in results ────────────────────────

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[activeIdx]) {
      navigate(results[activeIdx].href)
    }
  }

  function navigate(href: string) {
    router.push(href)
    closeModal()
  }

  // ── Render ─────────────────────────────────────────────────

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
      onClick={closeModal}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-lg rounded-xl border border-white/[0.10] bg-surface-900 shadow-2xl animate-fade-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06]">
          <svg className="w-4 h-4 text-surface-500 shrink-0" fill="none" viewBox="0 0 15 15">
            <path
              d="M10 6.5a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0zm-.47 3.59l2.88 2.88"
              stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search docs, labs, playbooks..."
            className="flex-1 bg-transparent text-sm text-surface-100 placeholder-surface-600 outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {loading && (
            <span className="text-xs text-surface-600 animate-pulse">Loading…</span>
          )}
          <kbd className="text-[10px] text-surface-700 font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto">
          {!loading && results.length === 0 && query.trim() && (
            <p className="text-center text-sm text-surface-600 py-10">
              No results for &ldquo;{query}&rdquo;
            </p>
          )}
          {results.map((item, i) => {
            const sectionMeta = SECTION_META[item.section as ContentSection]
            return (
              <button
                key={item.id}
                className={`w-full text-left px-4 py-3 transition-colors border-l-2 ${
                  i === activeIdx
                    ? 'border-brand-500 bg-brand-500/5'
                    : 'border-transparent hover:bg-white/[0.03]'
                }`}
                onClick={() => navigate(item.href)}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-semibold text-surface-600 uppercase w-16 shrink-0">
                    {item.label}
                  </span>
                  <span className="text-sm font-medium text-surface-100 truncate">
                    {item.title}
                  </span>
                </div>
                {item.description && (
                  <p className="mt-0.5 text-xs text-surface-500 line-clamp-1 ml-18 pl-[72px]">
                    {item.description}
                  </p>
                )}
              </button>
            )
          })}
        </div>

        {/* Footer hints */}
        <div className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-4 text-[10px] text-surface-700 font-mono">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>Esc close</span>
          <span className="ml-auto">⌘K toggle</span>
        </div>
      </div>
    </div>
  )
}
