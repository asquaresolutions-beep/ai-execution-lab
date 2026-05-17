'use client'

/**
 * DebugReplay + DebugStep — compositional debug session renderer.
 * Each DebugStep represents one phase of a debugging session.
 * Steps are expandable; the DebugReplay wrapper shows the phase summary strip.
 *
 * Usage in MDX:
 *   <DebugReplay title="Tracing undefined props after next-mdx-remote v6 upgrade">
 *     <DebugStep phase="error" title="Components rendering empty">
 *       StepList and Checklist rendered wrapper shells but no items.
 *       No console errors, no build warnings.
 *     </DebugStep>
 *     <DebugStep phase="hypothesis" title="Suspected prop serialization issue">
 *       Array and object literal props might be stripped during MDX compilation.
 *     </DebugStep>
 *     <DebugStep phase="investigation" title="Added logging to compileMDX output">
 *       Confirmed: `items` prop was undefined at render time. Props were missing
 *       from serialized JSX output, not from the MDX source files.
 *     </DebugStep>
 *     <DebugStep phase="fix" title="Set blockJS: false in content-renderer.tsx">
 *       One line change. Documented the reason at the call site.
 *     </DebugStep>
 *     <DebugStep phase="verify" title="Build passing, all components rendering">
 *       152 pages, 0 TypeScript errors. Verified in production.
 *     </DebugStep>
 *   </DebugReplay>
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Phase config
// ─────────────────────────────────────────────────────────────

const PHASE_CONFIG = {
  error: {
    label: 'Error',
    icon: '✕',
    border: 'border-red-500/30',
    bg: 'bg-red-500/5',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
    dot: 'bg-red-500',
  },
  hypothesis: {
    label: 'Hypothesis',
    icon: '?',
    border: 'border-yellow-500/30',
    bg: 'bg-yellow-500/5',
    badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    dot: 'bg-yellow-500',
  },
  investigation: {
    label: 'Investigation',
    icon: '⌕',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    dot: 'bg-blue-400',
  },
  fix: {
    label: 'Fix',
    icon: '⚙',
    border: 'border-brand-500/30',
    bg: 'bg-brand-500/5',
    badge: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
    dot: 'bg-brand-400',
  },
  verify: {
    label: 'Verify',
    icon: '✓',
    border: 'border-green-500/30',
    bg: 'bg-green-500/5',
    badge: 'bg-green-500/10 text-green-400 border-green-500/20',
    dot: 'bg-green-500',
  },
} as const

type DebugPhase = keyof typeof PHASE_CONFIG

// ─────────────────────────────────────────────────────────────
// DebugStep
// ─────────────────────────────────────────────────────────────

interface DebugStepProps {
  phase: DebugPhase
  title: string
  children: React.ReactNode
  /** Open by default (default: true) */
  defaultOpen?: boolean
}

export function DebugStep({ phase, title, children, defaultOpen = true }: DebugStepProps) {
  const [open, setOpen] = useState(defaultOpen)
  const cfg = PHASE_CONFIG[phase]

  return (
    <div className={cn('rounded-lg border overflow-hidden', cfg.border, cfg.bg)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
        aria-expanded={open}
      >
        <span className={cn('shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded border', cfg.badge)}>
          {cfg.label}
        </span>
        <span className="flex-1 text-sm font-medium text-surface-200">{title}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={['text-surface-600 shrink-0 transition-transform', open ? 'rotate-180' : ''].join(' ')}
          aria-hidden="true"
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-surface-300 leading-relaxed [&>p]:mt-0 space-y-2">
          {children}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// DebugReplay wrapper
// ─────────────────────────────────────────────────────────────

interface DebugReplayProps {
  title?: string
  children: React.ReactNode
}

export function DebugReplay({ title, children }: DebugReplayProps) {
  return (
    <div className="my-8 rounded-xl border border-surface-700/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-900/80 border-b border-surface-800/60">
        <div className="flex gap-1">
          {(Object.keys(PHASE_CONFIG) as DebugPhase[]).map(phase => (
            <span
              key={phase}
              className={cn('w-2 h-2 rounded-full', PHASE_CONFIG[phase].dot)}
              title={PHASE_CONFIG[phase].label}
            />
          ))}
        </div>
        {title && (
          <span className="text-xs font-mono text-surface-400 truncate">{title}</span>
        )}
        <span className="ml-auto text-[10px] font-mono text-surface-700 uppercase tracking-widest">
          Debug Replay
        </span>
      </div>

      {/* Steps */}
      <div className="p-4 space-y-3 bg-surface-950/60">
        {children}
      </div>
    </div>
  )
}
