'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { SidebarNav } from './sidebar-nav'

// ─────────────────────────────────────────────────────────────
// Mobile TopBar — hidden on desktop (lg:hidden)
// ─────────────────────────────────────────────────────────────

export function TopBar() {
  const [menuOpen, setMenuOpen] = useState(false)

  // Close on ESC
  useEffect(() => {
    if (!menuOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  function openSearch() {
    window.dispatchEvent(new Event('search:open'))
  }

  return (
    <>
      {/* Bar */}
      <header
        className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-12 border-b border-white/[0.06]"
        style={{ backgroundColor: 'rgb(9,14,26)' }}
      >
        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen(true)}
          className="w-8 h-8 flex items-center justify-center rounded text-surface-400 hover:text-surface-200 hover:bg-white/[0.05] transition-colors"
          aria-label="Open navigation"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Logo */}
        <Link href="/" className="flex-1 text-sm font-semibold text-surface-100">
          AI Execution Lab
        </Link>

        {/* Search icon */}
        <button
          onClick={openSearch}
          className="w-8 h-8 flex items-center justify-center rounded text-surface-400 hover:text-surface-200 hover:bg-white/[0.05] transition-colors"
          aria-label="Search"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path
              d="M10 6.5a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0zm-.47 3.59l2.88 2.88"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          {/* Drawer */}
          <div
            className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 flex flex-col border-r border-white/[0.06] animate-slide-in-left"
            style={{ backgroundColor: 'rgb(9,14,26)' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 h-12 border-b border-white/[0.06]">
              <Link
                href="/"
                className="flex-1 text-sm font-bold text-surface-100"
                onClick={() => setMenuOpen(false)}
              >
                AI Execution Lab
              </Link>
              <button
                onClick={() => setMenuOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded text-surface-500 hover:text-surface-300 transition-colors"
                aria-label="Close menu"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Nav */}
            <SidebarNav onNavigate={() => setMenuOpen(false)} />

            {/* Footer */}
            <div className="mt-auto px-4 py-4 border-t border-white/[0.06]">
              <a
                href="https://asquaresolution.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-surface-600 hover:text-surface-400 font-mono"
              >
                asquaresolution.com ↗
              </a>
            </div>
          </div>
        </>
      )}
    </>
  )
}
