'use client'

import { useState, useRef } from 'react'

// Client-side <pre> wrapper that adds a hover-reveal copy button.
// Used as the MDX `pre` override so all code fences get copy support.

export function PreBlock({
  children,
  ...props
}: React.HTMLAttributes<HTMLPreElement>) {
  const [copied, setCopied] = useState(false)
  const preRef = useRef<HTMLPreElement>(null)

  function handleCopy() {
    const text = preRef.current?.innerText ?? ''
    navigator.clipboard.writeText(text.trim()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="relative group my-6 rounded-xl border border-surface-700/60 overflow-hidden">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 z-10 text-[11px] font-mono text-surface-600 hover:text-surface-200 transition-colors opacity-0 group-hover:opacity-100 bg-surface-950/80 px-2 py-0.5 rounded"
        aria-label="Copy code"
      >
        {copied ? '✓ copied' : 'copy'}
      </button>
      <pre
        ref={preRef}
        className="overflow-x-auto bg-surface-950/80 p-4 text-sm leading-relaxed"
        {...props}
      >
        {children}
      </pre>
    </div>
  )
}
