/**
 * Custom MDX component overrides.
 * These replace default HTML elements rendered from Markdown
 * with styled versions that match the lab aesthetic.
 */
import type { MDXComponents } from 'mdx/types'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Callout (custom MDX component — use as <Callout type="warn">)
// ─────────────────────────────────────────────────────────────

const CALLOUT_STYLES = {
  info:    { border: 'border-blue-500/40',   bg: 'bg-blue-500/5',   icon: 'ℹ', label: 'text-blue-400'  },
  warn:    { border: 'border-yellow-500/40', bg: 'bg-yellow-500/5', icon: '⚠', label: 'text-yellow-400'},
  danger:  { border: 'border-red-500/40',    bg: 'bg-red-500/5',    icon: '✕', label: 'text-red-400'   },
  success: { border: 'border-green-500/40',  bg: 'bg-green-500/5',  icon: '✓', label: 'text-green-400' },
  lab:     { border: 'border-brand-500/40',  bg: 'bg-brand-500/5',  icon: '🔬', label: 'text-brand-400'},
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
          {s.icon} {title}
        </p>
      )}
      <div className="text-surface-300 text-sm leading-relaxed [&>p]:mb-0">
        {children}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Stat card (custom — use as <Stat value="0" label="..." />)
// ─────────────────────────────────────────────────────────────

export function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="rounded-lg border border-surface-700 bg-surface-900 px-5 py-4 text-center">
      <div className="text-2xl font-bold text-brand-400">{value}</div>
      <div className="mt-1 text-sm font-medium text-surface-200">{label}</div>
      {note && <div className="mt-1 text-xs text-surface-500">{note}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// StatsGrid — wrapper for Stat cards
// ─────────────────────────────────────────────────────────────

export function StatsGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Standard MDX component map
// ─────────────────────────────────────────────────────────────

export const mdxComponents: MDXComponents = {
  // Custom components available in all MDX files
  Callout,
  Stat,
  StatsGrid,

  // Override standard elements
  a: ({ href, children, ...props }) => {
    const isExternal = href?.startsWith('http')
    if (isExternal) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-400 hover:text-brand-300 underline underline-offset-2"
          {...props}
        >
          {children}
        </a>
      )
    }
    return (
      <Link
        href={href ?? '#'}
        className="text-brand-400 hover:text-brand-300 underline underline-offset-2"
        {...props}
      >
        {children}
      </Link>
    )
  },

  // Code blocks get a slight surface treatment
  pre: ({ children, ...props }) => (
    <pre
      className="overflow-x-auto rounded-lg border border-surface-700 bg-surface-900 p-4 text-sm leading-relaxed"
      {...props}
    >
      {children}
    </pre>
  ),

  // Inline tables
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto rounded-lg border border-surface-700">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-surface-700 bg-surface-800 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-surface-300">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-surface-800 px-4 py-2.5 text-surface-300">
      {children}
    </td>
  ),

  // HR
  hr: () => <hr className="my-8 border-surface-800" />,
}
