import Link from 'next/link'
import { getPopularItems } from '@/lib/content'
import { SECTION_META } from '@/lib/utils'

// Popular Articles widget (sidebar/homepage). Deterministic fallback ranking:
// featured → most internally-linked → most recent (no analytics dependency).
export function PopularArticles({ limit = 6, heading = 'Popular' }: { limit?: number; heading?: string }) {
  const items = getPopularItems(limit)
  if (items.length === 0) return null
  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-surface-600">{heading}</h2>
      <ol className="space-y-2.5">
        {items.map((i, idx) => (
          <li key={`${i.section}/${i.slug}`} className="flex gap-3">
            <span className="text-sm font-bold text-surface-700 tabular-nums">{idx + 1}</span>
            <Link href={`${SECTION_META[i.section].href}/${i.slug}`} className="text-sm text-surface-400 hover:text-brand-300 transition-colors line-clamp-2">
              {i.frontmatter.title}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
