import Link from 'next/link'
import { getFeaturedItems } from '@/lib/content'
import { SECTION_META, formatDateMono } from '@/lib/utils'

// Featured Articles section — surfaces frontmatter `featured: true` posts above
// the normal lists. Renders nothing if none are featured.
export function FeaturedArticles({ limit = 6, heading = 'Featured' }: { limit?: number; heading?: string }) {
  const items = getFeaturedItems(limit)
  if (items.length === 0) return null
  return (
    <section className="mb-12">
      <h2 className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-surface-600">
        <span className="text-brand-400">★</span> {heading}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((i) => (
          <Link key={`${i.section}/${i.slug}`} href={`${SECTION_META[i.section].href}/${i.slug}`}
            className="group rounded-xl border border-brand-500/20 bg-brand-500/[0.04] px-4 py-3.5 hover:border-brand-500/40 hover:bg-brand-500/[0.07] transition-all">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-brand-400">{SECTION_META[i.section].label}</span>
              <time className="text-[10px] font-mono text-surface-700">{formatDateMono(i.frontmatter.date)}</time>
            </div>
            <p className="text-sm font-medium text-surface-200 group-hover:text-surface-50 line-clamp-2">{i.frontmatter.title}</p>
            {i.frontmatter.description && <p className="mt-1 text-xs text-surface-500 line-clamp-2">{i.frontmatter.description}</p>}
          </Link>
        ))}
      </div>
    </section>
  )
}
