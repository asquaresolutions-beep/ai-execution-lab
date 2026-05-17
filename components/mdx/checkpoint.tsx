'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

// Implementation checkpoint — checklist inside lessons.
// Usage in MDX:
//   <Checkpoint title="Before continuing">
//     <CheckItem>Claude Code is installed and shows version ≥ 1.0</CheckItem>
//     <CheckItem>CLAUDE.md exists in project root</CheckItem>
//     <CheckItem>You've run /help and seen the command list</CheckItem>
//   </Checkpoint>

export function CheckItem({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false)

  return (
    <li
      className="flex items-start gap-3 cursor-pointer group"
      onClick={() => setChecked((v) => !v)}
    >
      <div
        className={cn(
          'mt-0.5 shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all',
          checked
            ? 'bg-green-500/20 border-green-500/50 text-green-400'
            : 'border-surface-700/70 bg-surface-900/40 group-hover:border-surface-600'
        )}
      >
        {checked && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 6l3 3 5-5" />
          </svg>
        )}
      </div>
      <span className={cn(
        'text-sm leading-relaxed transition-colors',
        checked ? 'text-surface-500 line-through' : 'text-surface-300'
      )}>
        {children}
      </span>
    </li>
  )
}

export function Checkpoint({
  children,
  title = 'Implementation Checkpoint',
}: {
  children: React.ReactNode
  title?: string
}) {
  return (
    <div className="my-8 rounded-xl border border-brand-500/25 bg-brand-500/[0.04] overflow-hidden">
      <div className="px-5 py-3 border-b border-brand-500/15 flex items-center gap-2.5">
        <svg className="w-4 h-4 text-brand-400 shrink-0" fill="none" viewBox="0 0 16 16" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 8l4 4 6-7" />
        </svg>
        <p className="text-sm font-semibold text-brand-400">{title}</p>
      </div>
      <div className="px-5 py-4">
        <ul className="space-y-2.5">
          {children}
        </ul>
      </div>
    </div>
  )
}
