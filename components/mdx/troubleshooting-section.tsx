'use client'

/**
 * TroubleshootingSection — expandable section for known failure modes and fixes.
 * Collapsed by default to keep the lesson flow uncluttered.
 * Users expand only the troubleshooting scenario they've hit.
 *
 * Usage:
 *   <TroubleshootingSection title="Claude asks permission on every git command">
 *     Your allow rules don't cover git operations...
 *   </TroubleshootingSection>
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'

export function TroubleshootingSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={cn(
      'my-4 rounded-lg border overflow-hidden transition-all',
      isOpen ? 'border-yellow-500/30' : 'border-yellow-500/15 hover:border-yellow-500/25'
    )}>
      <button
        onClick={() => setIsOpen(o => !o)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
          isOpen ? 'bg-yellow-500/8' : 'bg-yellow-500/[0.03] hover:bg-yellow-500/[0.06]'
        )}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-yellow-400/80 text-sm shrink-0">⚠</span>
          <span className="text-sm font-semibold text-yellow-300/90 leading-snug">
            Troubleshooting: {title}
          </span>
        </div>
        <svg
          className={cn('w-4 h-4 text-yellow-500/50 transition-transform shrink-0 ml-3', isOpen && 'rotate-180')}
          fill="none" viewBox="0 0 16 16" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-4 py-4 border-t border-yellow-500/15 text-sm text-surface-300 leading-relaxed
          [&>p]:mb-3 [&>p:last-child]:mb-0
          [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:space-y-1 [&>ul]:mb-3
          [&>code]:bg-surface-800 [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-[11px]">
          {children}
        </div>
      )}
    </div>
  )
}
