import Link from 'next/link'
import { getRecentItems } from '@/lib/content'
import { SECTION_META, formatDateShort } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

const SECTIONS = [
  {
    key: 'docs' as const,
    title: 'Docs',
    description: 'Reference documentation for Claude Code, GEO, LiteSpeed, WordPress production systems, and AI workflow primitives.',
    emoji: '📖',
    href: '/docs',
    examples: ['Claude Code hook patterns', 'LiteSpeed UCSS behaviour', 'GEO entity targeting'],
  },
  {
    key: 'systems' as const,
    title: 'Systems',
    description: 'Documented production systems built and actively running. Architecture decisions, failure modes, and maintenance notes included.',
    emoji: '⚙️',
    href: '/systems',
    examples: ['WordPress typography system', 'SEO engineering pipeline', 'AI content workflow'],
  },
  {
    key: 'labs' as const,
    title: 'Labs',
    description: 'Active experiments and research. Hypothesis, method, findings. Some ongoing, some closed. All real.',
    emoji: '🔬',
    href: '/labs',
    examples: ['LiteSpeed UCSS stripping research', 'GEO citation tracking', 'Astra specificity cascade'],
  },
  {
    key: 'case-studies' as const,
    title: 'Case Studies',
    description: 'Real results from asquaresolution.com, TrustSeal, and ScamCheck. What we built, what broke, what we measured.',
    emoji: '📊',
    href: '/case-studies',
    examples: ['GEO pillar typography repair', 'ChatGPT Search visibility', 'Post 8717 UCSS fix'],
  },
]

export default function HomePage() {
  const recent = getRecentItems(4)

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

      {/* Hero */}
      <section className="pt-20 pb-16 sm:pt-28 sm:pb-20">
        <div className="max-w-3xl">
          <div className="mb-5">
            <Badge variant="brand">Local — in active development</Badge>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-surface-50 text-balance leading-[1.1]">
            AI Execution Lab
          </h1>
          <p className="mt-5 text-lg text-surface-400 max-w-2xl text-pretty leading-relaxed">
            A practical AI systems lab by{' '}
            <a
              href="https://asquaresolution.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-400 hover:text-brand-300 transition-colors"
            >
              A Square Solutions
            </a>
            . Real workflows, real systems, real results — from the team building
            production AI tools, SEO engineering pipelines, and GEO/AI-search strategies.
          </p>
          <p className="mt-3 text-sm text-surface-500">
            This is not a tutorial site. Every document here comes from something
            we actually built, broke, fixed, or measured.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/systems"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
            >
              Browse Systems
            </Link>
            <Link
              href="/case-studies"
              className="inline-flex items-center gap-2 rounded-lg border border-surface-700 px-4 py-2 text-sm font-medium text-surface-300 hover:text-surface-100 hover:border-surface-600 transition-colors"
            >
              Case Studies
            </Link>
          </div>
        </div>
      </section>

      {/* What's in the lab */}
      <section className="pb-16">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-surface-500 mb-8">
          What&apos;s in the lab
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SECTIONS.map((section) => (
            <Link
              key={section.key}
              href={section.href}
              className="group rounded-xl border border-surface-800 bg-surface-900/50 p-6 hover:border-surface-700 hover:bg-surface-900 transition-all"
            >
              <div className="flex items-start gap-4">
                <span className="text-2xl" aria-hidden>{section.emoji}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-surface-100 group-hover:text-white transition-colors">
                    {section.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-surface-400 leading-relaxed">
                    {section.description}
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {section.examples.map((ex) => (
                      <li
                        key={ex}
                        className="text-xs text-surface-500 bg-surface-800 rounded px-2 py-0.5 border border-surface-700"
                      >
                        {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent additions */}
      {recent.length > 0 && (
        <section className="pb-20 border-t border-surface-800 pt-12">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-surface-500 mb-8">
            Recently added
          </h2>
          <div className="space-y-4">
            {recent.map((item) => {
              const sectionMeta = SECTION_META[item.section]
              return (
                <Link
                  key={`${item.section}/${item.slug}`}
                  href={`${sectionMeta.href}/${item.slug}`}
                  className="group flex items-start gap-4 rounded-lg p-4 hover:bg-surface-900 transition-colors"
                >
                  <span className="mt-0.5 text-sm text-surface-500 w-20 shrink-0 text-right font-mono">
                    {formatDateShort(item.frontmatter.date)}
                  </span>
                  <div>
                    <span className="text-xs text-surface-600 mr-2">{sectionMeta.emoji} {sectionMeta.title}</span>
                    <span className="text-sm font-medium text-surface-200 group-hover:text-white transition-colors">
                      {item.frontmatter.title}
                    </span>
                    {item.frontmatter.description && (
                      <p className="mt-0.5 text-xs text-surface-500 line-clamp-1">
                        {item.frontmatter.description}
                      </p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Stack callout */}
      <section className="pb-20 border-t border-surface-800 pt-12">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-surface-500 mb-6">
          Built from real execution
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Claude Code', desc: 'AI-assisted development' },
            { label: 'GEO / AI Search', desc: 'Generative engine optimization' },
            { label: 'WordPress / LiteSpeed', desc: 'Production CMS systems' },
            { label: 'Vercel / GitHub', desc: 'Deployment & CI workflows' },
          ].map(({ label, desc }) => (
            <div
              key={label}
              className="rounded-lg border border-surface-800 bg-surface-900/30 p-4"
            >
              <p className="text-sm font-medium text-surface-200">{label}</p>
              <p className="mt-1 text-xs text-surface-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
