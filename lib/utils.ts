import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'

// ─────────────────────────────────────────────────────────────
// Tailwind class merging
// ─────────────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// ─────────────────────────────────────────────────────────────
// Date formatting
// ─────────────────────────────────────────────────────────────

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'MMMM d, yyyy')
}

export function formatDateShort(iso: string): string {
  return format(parseISO(iso), 'MMM d, yyyy')
}

export function formatDateMono(iso: string): string {
  return format(parseISO(iso), 'yyyy-MM-dd')
}

// ─────────────────────────────────────────────────────────────
// Section metadata
// ─────────────────────────────────────────────────────────────

export const SECTION_META = {
  docs: {
    title: 'Docs',
    description: 'Reference documentation for AI tools, workflows, and production systems.',
    emoji: '◎',
    label: 'DOCS',
    href: '/docs',
    accent: 'blue' as const,
  },
  systems: {
    title: 'Systems',
    description: 'Documented production systems — architecture decisions, failure modes, maintenance.',
    emoji: '⚙',
    label: 'SYSTEM',
    href: '/systems',
    accent: 'purple' as const,
  },
  labs: {
    title: 'Labs',
    description: 'Active research and experiments with stated hypotheses and findings.',
    emoji: '⬡',
    label: 'LAB',
    href: '/labs',
    accent: 'green' as const,
  },
  'case-studies': {
    title: 'Case Studies',
    description: 'Real results — what we built, what broke, and what we measured.',
    emoji: '▲',
    label: 'CASE',
    href: '/case-studies',
    accent: 'orange' as const,
  },
  playbooks: {
    title: 'Playbooks',
    description: 'Step-by-step execution guides for repeatable operations.',
    emoji: '▶',
    label: 'PLAYBOOK',
    href: '/playbooks',
    accent: 'brand' as const,
  },
  failures: {
    title: 'Failure Archive',
    description: 'Documented production failures — root cause analysis, resolution timelines, and prevention patterns.',
    emoji: '✕',
    label: 'FAILURE',
    href: '/failures',
    accent: 'red' as const,
  },
  logs: {
    title: 'Execution Logs',
    description: 'Daily build logs, deployment journals, and weekly execution summaries from active production work.',
    emoji: '⬒',
    label: 'LOG',
    href: '/logs',
    accent: 'purple' as const,
  },
} as const

export type SectionKey = keyof typeof SECTION_META
export type AccentColor = typeof SECTION_META[SectionKey]['accent']

// ─────────────────────────────────────────────────────────────
// Accent color classes (must be complete strings for Tailwind JIT)
// ─────────────────────────────────────────────────────────────

export const ACCENT_CLASSES = {
  blue:   { text: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20'   },
  purple: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  green:  { text: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20'  },
  orange: { text: 'text-brand-400',  bg: 'bg-brand-500/10',  border: 'border-brand-500/20'  },
  brand:  { text: 'text-brand-400',  bg: 'bg-brand-500/10',  border: 'border-brand-500/20'  },
  red:    { text: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20'    },
} as const

// ─────────────────────────────────────────────────────────────
// Badge variants
// ─────────────────────────────────────────────────────────────

export const STATUS_STYLES = {
  published: 'bg-green-500/10 text-green-400 border-green-500/20',
  draft:     'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  archived:  'bg-surface-500/10 text-surface-400 border-surface-500/20',
} as const

export const RESULT_STYLES = {
  confirmed:    'bg-green-500/10 text-green-400 border-green-500/20',
  refuted:      'bg-red-500/10 text-red-400 border-red-500/20',
  inconclusive: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  ongoing:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
} as const
