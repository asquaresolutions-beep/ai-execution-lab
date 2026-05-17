'use client'

import { useState, useRef } from 'react'

// Usage in MDX:
//   <PromptBlock title="GEO research prompt" role="user">
//   You are an expert in generative engine optimization...
//   </PromptBlock>

const ROLE_STYLES = {
  user: {
    label: 'USER PROMPT',
    labelColor: 'text-blue-400',
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/[0.04]',
    headerBg: 'bg-blue-500/[0.06]',
  },
  system: {
    label: 'SYSTEM',
    labelColor: 'text-yellow-400',
    border: 'border-yellow-500/20',
    bg: 'bg-yellow-500/[0.04]',
    headerBg: 'bg-yellow-500/[0.06]',
  },
  assistant: {
    label: 'ASSISTANT',
    labelColor: 'text-green-400',
    border: 'border-green-500/20',
    bg: 'bg-green-500/[0.04]',
    headerBg: 'bg-green-500/[0.06]',
  },
} as const

type PromptRole = keyof typeof ROLE_STYLES

export function PromptBlock({
  title,
  role = 'user',
  children,
}: {
  title?: string
  role?: PromptRole
  children: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const s = ROLE_STYLES[role]

  function handleCopy() {
    const text = contentRef.current?.innerText ?? ''
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={`my-6 rounded-xl border overflow-hidden ${s.border} ${s.bg}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2 border-b border-white/[0.05] ${s.headerBg}`}>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-mono font-bold tracking-widest ${s.labelColor}`}>
            {s.label}
          </span>
          {title && (
            <span className="text-xs text-surface-400">{title}</span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="text-[11px] text-surface-500 hover:text-surface-300 transition-colors font-mono"
        >
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        className="px-4 py-3 text-sm text-surface-300 font-mono leading-relaxed whitespace-pre-wrap"
      >
        {children}
      </div>
    </div>
  )
}
