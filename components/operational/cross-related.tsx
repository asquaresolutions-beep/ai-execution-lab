/**
 * components/operational/cross-related.tsx
 * Cross-section related content panel.
 *
 * Renders related items from OTHER sections (failures, logs, docs, playbooks,
 * case-studies) based on the `related_*` frontmatter fields.
 *
 * Usage (in a page or afterContent slot):
 *   <CrossRelated section="failures" slug={slug} />
 */
import Link from 'next/link'
import { getCrossRelated } from '@/lib/relationship-index'
import type { ContentMeta, ContentSection } from '@/lib/content'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Section config
// ─────────────────────────────────────────────────────────────

const SECTION_CONFIG: Record<string, {
  label: string
  href:  (slug: string) => string
  color: string
  dot:   string
}> = {
  failures: {
    label: 'Related Failure',
    href:  (s) => `/failures/${s}`,
    color: 'text-red-400',
    dot:   'bg-red-400',
  },
  logs: {
    label: 'Execution Log',
    href:  (s) => `/logs/${s}`,
    color: 'text-blue-400',
    dot:   'bg-blue-400',
  },
  'case-studies': {
    label: 'Case Study',
    href:  (s) => `/case-studies/${s}`,
    color: 'text-purple-400',
    dot:   'bg-purple-400',
  },
  docs: {
    label: 'Doc',
    href:  (s) => `/docs/${s}`,
    color: 'text-emerald-400',
    dot:   'bg-emerald-400',
  },
  playbooks: {
    label: 'Playbook',
    href:  (s) => `/playbooks/${s}`,
    color: 'text-yellow-400',
    dot:   'bg-yellow-400',
  },
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function RelatedItem({
  item,
  sectionKey,
}: {
  item: ContentMeta
  sectionKey: string
}) {
  const cfg = SECTION_CONFIG[sectionKey]
  if (!cfg) return null

  return (
    <Link
      href={cfg.href(item.slug)}
      className={cn(
        'group flex items-start gap-3 rounded-lg border border-white/[0.06]',
        'bg-white/[0.03] px-4 py-3 transition-colors',
        'hover:border-white/[0.12] hover:bg-white/[0.06]',
      )}
    >
      <span className={cn('mt-[5px] h-2 w-2 shrink-0 rounded-full', cfg.dot)} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white/80 group-hover:text-white">
          {item.frontmatter.title}
        </p>
        {item.frontmatter.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-white/40">
            {item.frontmatter.description}
          </p>
        )}
        <span className={cn('mt-1 inline-block text-[10px] font-mono', cfg.color)}>
          {cfg.label}
        </span>
      </div>
    </Link>
  )
}

function SectionGroup({
  items,
  sectionKey,
}: {
  items: ContentMeta[]
  sectionKey: string
}) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <RelatedItem key={item.slug} item={item} sectionKey={sectionKey} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

interface CrossRelatedProps {
  section: ContentSection
  slug: string
  className?: string
}

export function CrossRelated({ section, slug, className }: CrossRelatedProps) {
  const related = getCrossRelated(section, slug)

  const groups: [string, ContentMeta[]][] = [
    ['failures',     related.failures],
    ['logs',         related.logs],
    ['case-studies', related.case_studies],
    ['playbooks',    related.playbooks],
    ['docs',         related.docs],
  ]

  const hasAny = groups.some(([, items]) => items.length > 0)
  if (!hasAny) return null

  return (
    <aside className={cn('not-prose', className)}>
      <div className="mb-3 flex items-center gap-2">
        <div className="h-px flex-1 bg-white/[0.06]" />
        <span className="text-[11px] font-mono uppercase tracking-widest text-white/30">
          Related Across Lab
        </span>
        <div className="h-px flex-1 bg-white/[0.06]" />
      </div>
      <div className="flex flex-col gap-3">
        {groups.map(([key, items]) => (
          <SectionGroup key={key} items={items} sectionKey={key} />
        ))}
      </div>
    </aside>
  )
}
