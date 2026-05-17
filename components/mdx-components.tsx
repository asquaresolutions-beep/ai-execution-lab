/**
 * Custom MDX component overrides.
 * All components exported here are available in every MDX file
 * without explicit imports.
 */
import type { MDXComponents } from 'mdx/types'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Callout
// ─────────────────────────────────────────────────────────────

const CALLOUT_STYLES = {
  info:    { border: 'border-blue-500/30',   bg: 'bg-blue-500/5',   icon: 'ℹ',  label: 'text-blue-400'   },
  warn:    { border: 'border-yellow-500/30', bg: 'bg-yellow-500/5', icon: '⚠',  label: 'text-yellow-400' },
  danger:  { border: 'border-red-500/30',    bg: 'bg-red-500/5',    icon: '✕',  label: 'text-red-400'    },
  success: { border: 'border-green-500/30',  bg: 'bg-green-500/5',  icon: '✓',  label: 'text-green-400'  },
  lab:     { border: 'border-brand-500/30',  bg: 'bg-brand-500/5',  icon: '⬡',  label: 'text-brand-400'  },
} as const

type CalloutType = keyof typeof CALLOUT_STYLES

export function Callout({
  children,
  type = 'info',
  title,
}: {
  children: React.ReactNode
  type?: CalloutType
  title?: string
}) {
  const s = CALLOUT_STYLES[type]
  return (
    <div className={cn('my-6 rounded-lg border px-5 py-4', s.border, s.bg)}>
      {title && (
        <p className={cn('mb-2 text-sm font-semibold', s.label)}>
          <span className="mr-1.5">{s.icon}</span>
          {title}
        </p>
      )}
      <div className="text-surface-300 text-sm leading-relaxed [&>p]:mb-0 [&>p:last-child]:mb-0">
        {children}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Stats display
// ─────────────────────────────────────────────────────────────

export function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="rounded-lg border border-surface-700/60 bg-surface-900/40 px-5 py-4 text-center">
      <div className="text-2xl font-bold text-brand-400 font-mono">{value}</div>
      <div className="mt-1 text-sm font-medium text-surface-200">{label}</div>
      {note && <div className="mt-1 text-xs text-surface-500">{note}</div>}
    </div>
  )
}

export function StatsGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Re-export rich MDX components
// ─────────────────────────────────────────────────────────────

export { WorkflowBlock, WorkflowStep } from './mdx/workflow-block'
export { PromptBlock }                 from './mdx/prompt-block'
export { CodeBlock }                   from './mdx/code-block'
export { StepList, Checklist }         from './mdx/step-list'

// Media
export { YouTube }     from './media/youtube-embed'
export { VideoEmbed }  from './media/video-embed'
export { BeforeAfter } from './media/before-after'
export { Gallery }     from './media/gallery'

// ─────────────────────────────────────────────────────────────
// Standard MDX element overrides
// ─────────────────────────────────────────────────────────────

export const mdxComponents: MDXComponents = {
  // Custom components
  Callout,
  Stat,
  StatsGrid,

  // ── Re-exported rich components (must be listed here for MDX to pick them up)
  // WorkflowBlock, WorkflowStep, PromptBlock, CodeBlock, StepList, Checklist
  // are added to this map in content-renderer.tsx

  // ── Link
  a: ({ href, children, ...props }) => {
    const isExternal = href?.startsWith('http')
    if (isExternal) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-400 hover:text-brand-300 underline underline-offset-2 decoration-brand-500/40"
          {...props}
        >
          {children}
        </a>
      )
    }
    return (
      <Link
        href={href ?? '#'}
        className="text-brand-400 hover:text-brand-300 underline underline-offset-2 decoration-brand-500/40"
        {...props}
      >
        {children}
      </Link>
    )
  },

  // ── Code blocks (client wrapper with copy button)
  pre: (props) => {
    const { PreBlock } = require('./layout/pre-block')
    return <PreBlock {...props} />
  },

  // ── Tables
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-surface-700/60">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-surface-700/60 bg-surface-800/50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-surface-300">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-surface-800/40 px-4 py-2.5 text-surface-300">
      {children}
    </td>
  ),

  // ── HR
  hr: () => <hr className="my-10 border-surface-800/60" />,
}
