'use client'

import { useState, useRef } from 'react'

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function extractLang(className?: string): string | null {
  if (!className) return null
  const match = className.match(/language-(\w+)/)
  return match ? match[1] : null
}

const LANG_DISPLAY: Record<string, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  tsx:        'TSX',
  jsx:        'JSX',
  bash:       'Bash',
  sh:         'Shell',
  css:        'CSS',
  json:       'JSON',
  mdx:        'MDX',
  md:         'Markdown',
  python:     'Python',
  yaml:       'YAML',
  toml:       'TOML',
  sql:        'SQL',
  html:       'HTML',
}

// ─────────────────────────────────────────────────────────────
// PreBlock — MDX `pre` override
// ─────────────────────────────────────────────────────────────

export function PreBlock({
  children,
  ...props
}: React.HTMLAttributes<HTMLPreElement>) {
  const [copied, setCopied] = useState(false)
  const preRef = useRef<HTMLPreElement>(null)

  // Extract language from child <code> element's className
  const codeEl  = children as React.ReactElement<{ className?: string }>
  const lang    = extractLang(codeEl?.props?.className)
  const display = lang ? (LANG_DISPLAY[lang] ?? lang.toUpperCase()) : null

  function handleCopy() {
    const text = preRef.current?.innerText ?? ''
    navigator.clipboard.writeText(text.trim()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // Fallback for older browsers / non-https
      const el = document.createElement('textarea')
      el.value = text.trim()
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="relative group my-6 rounded-xl border border-surface-700/50 overflow-hidden bg-surface-950/90">
      {/* Header bar: language label + copy */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-surface-700/40 bg-surface-900/60">
        <span className="text-[10px] font-mono text-surface-600 uppercase tracking-widest">
          {display ?? 'Code'}
        </span>
        <button
          onClick={handleCopy}
          className="text-[11px] font-mono text-surface-600 hover:text-surface-200 transition-colors px-1.5 py-0.5 rounded hover:bg-white/[0.05]"
          aria-label="Copy code"
        >
          {copied ? (
            <span className="text-green-400">✓ Copied</span>
          ) : (
            'Copy'
          )}
        </button>
      </div>

      {/* Code content — touch-scroll on mobile */}
      <pre
        ref={preRef}
        className="overflow-x-auto p-4 text-sm leading-relaxed [-webkit-overflow-scrolling:touch]"
        style={{ scrollbarWidth: 'thin' }}
        {...props}
      >
        {children}
      </pre>
    </div>
  )
}
