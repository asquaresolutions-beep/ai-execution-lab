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

// ─────────────────────────────────────────────────────────────
// Section display names and descriptions
// ─────────────────────────────────────────────────────────────

export const SECTION_META = {
  docs: {
    title: 'Docs',
    description: 'Reference documentation for AI tools, workflows, and systems.',
    emoji: '📖',
    href: '/docs',
  },
  systems: {
    title: 'Systems',
    description: 'Documented production systems built and deployed in real workflows.',
    emoji: '⚙️',
    href: '/systems',
  },
  labs: {
    title: 'Labs',
    description: 'Active research, experiments, and findings from real execution.',
    emoji: '🔬',
    href: '/labs',
  },
  'case-studies': {
    title: 'Case Studies',
    description: 'Real results — what worked, what failed, and what we measured.',
    emoji: '📊',
    href: '/case-studies',
  },
} as const

export type SectionKey = keyof typeof SECTION_META

// ─────────────────────────────────────────────────────────────
// Status badges
// ─────────────────────────────────────────────────────────────

export const STATUS_STYLES = {
  published:    'bg-green-500/10 text-green-400 border-green-500/20',
  draft:        'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  archived:     'bg-surface-500/10 text-surface-400 border-surface-500/20',
} as const

export const RESULT_STYLES = {
  confirmed:    'bg-green-500/10 text-green-400 border-green-500/20',
  refuted:      'bg-red-500/10 text-red-400 border-red-500/20',
  inconclusive: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  ongoing:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
} as const
