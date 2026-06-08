// components/scamcheck/scam-resources.tsx
// asq-growth-links-v1 — "Related guides & resources" block: ScamCheck → blog
// internal links for the authority cluster + subscriber growth. Server component
// (no client JS). Descriptive anchors + ItemList JSON-LD for SEO. Reuses existing
// card styles. Rollback: remove this file + its usages (asq-growth-links-v1).
import { resourcesForChecker, BLOG_HUB } from '@/lib/scamcheck/blog-resources'

export function ScamResources({ currentSlug, limit = 3, className = '' }: { currentSlug: string; limit?: number; className?: string }) {
  const items = resourcesForChecker(currentSlug, limit)
  if (items.length === 0) return null

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Related scam-protection guides',
    itemListElement: items.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: r.url, name: r.title })),
  }

  return (
    <section className={`rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 ${className}`} aria-labelledby="resources-h">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <h2 id="resources-h" className="text-base font-semibold text-zinc-100">Related guides &amp; resources</h2>
      <p className="mt-1 text-xs text-zinc-400">In-depth guides from the A Square Solutions blog to help you stay ahead of scammers.</p>
      <ul className="mt-3 space-y-2">
        {items.map((r) => (
          <li key={r.slug}>
            <a
              href={r.url}
              rel="noopener"
              className="group flex items-start gap-3 rounded-lg border border-transparent px-2 py-2 hover:border-sky-500/30 hover:bg-sky-500/[0.05]"
            >
              <span aria-hidden="true" className="mt-0.5 text-sky-400">📘</span>
              <span>
                <span className="block text-sm font-medium text-zinc-100 group-hover:text-sky-300">{r.title}</span>
                <span className="block text-xs text-zinc-400">{r.blurb}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <a href={BLOG_HUB} rel="noopener" className="mt-3 inline-block text-xs font-medium text-sky-400 hover:underline">
        Browse all scam-protection guides →
      </a>
    </section>
  )
}
