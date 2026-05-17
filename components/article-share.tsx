'use client'

import { useState } from 'react'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface ArticleShareProps {
  title: string
  description?: string
  url: string        // absolute canonical URL
  tags?: string[]
}

// ─────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────

function buildTwitterUrl(title: string, url: string, tags?: string[]): string {
  const hashtags = (tags ?? []).slice(0, 3).map(t => t.replace(/[-\s]/g, '')).join(',')
  const text = encodeURIComponent(`${title}\n\n`)
  const urlParam = encodeURIComponent(url)
  const base = `https://twitter.com/intent/tweet?text=${text}&url=${urlParam}`
  return hashtags ? `${base}&hashtags=${hashtags}` : base
}

function buildLinkedInUrl(url: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function ArticleShare({ title, url, tags }: ArticleShareProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select a temp input
      const el = document.createElement('input')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-mono text-surface-700 mr-1 uppercase tracking-wider hidden sm:block">
        Share
      </span>

      {/* Copy link */}
      <button
        onClick={handleCopy}
        title="Copy link"
        className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-mono border border-white/[0.08] bg-white/[0.03] text-surface-500 hover:text-surface-200 hover:border-white/[0.14] transition-all"
      >
        {copied ? (
          <>
            <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-400">Copied</span>
          </>
        ) : (
          <>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Link
          </>
        )}
      </button>

      {/* X / Twitter */}
      <a
        href={buildTwitterUrl(title, url, tags)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X (Twitter)"
        title="Share on X"
        className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-mono border border-white/[0.08] bg-white/[0.03] text-surface-500 hover:text-surface-200 hover:border-white/[0.14] transition-all"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.261 5.634L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
        </svg>
        X
      </a>

      {/* LinkedIn */}
      <a
        href={buildLinkedInUrl(url)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on LinkedIn"
        title="Share on LinkedIn"
        className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-mono border border-white/[0.08] bg-white/[0.03] text-surface-500 hover:text-surface-200 hover:border-white/[0.14] transition-all"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
        LinkedIn
      </a>
    </div>
  )
}
