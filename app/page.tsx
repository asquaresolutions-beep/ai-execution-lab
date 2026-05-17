import Link from 'next/link'
import { getAllMeta, getRecentItems } from '@/lib/content'
import { SECTION_META, ACCENT_CLASSES, formatDateMono } from '@/lib/utils'
import { StatsBar }      from '@/components/homepage/stats-bar'
import { SectionTracks } from '@/components/homepage/section-tracks'

export default function HomePage() {
  const docs        = getAllMeta('docs')
  const systems     = getAllMeta('systems')
  const labs        = getAllMeta('labs')
  const caseStudies = getAllMeta('case-studies')
  const playbooks   = getAllMeta('playbooks')
  const recent      = getRecentItems(8)

  const stats = [
    { key: 'docs'         as const, count: docs.length        },
    { key: 'systems'      as const, count: systems.length     },
    { key: 'labs'         as const, count: labs.length        },
    { key: 'case-studies' as const, count: caseStudies.length },
    { key: 'playbooks'    as const, count: playbooks.length   },
  ]

  const sections = [
    { key: 'docs'         as const, count: docs.length,        items: docs.slice(0, 2)        },
    { key: 'systems'      as const, count: systems.length,     items: systems.slice(0, 2)     },
    { key: 'labs'         as const, count: labs.length,        items: labs.slice(0, 2)        },
    { key: 'case-studies' as const, count: caseStudies.length, items: caseStudies.slice(0, 2) },
    { key: 'playbooks'    as const, count: playbooks.length,   items: playbooks.slice(0, 2)   },
  ]

  return (
    <div className="px-6 lg:px-8 py-8 max-w-5xl">

      {/* ── Hero header ─────────────────────────────────────── */}
      <div className="mb-10 pb-10 border-b border-white/[0.05]">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold text-brand-500/80 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
            Local development
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-surface-50 leading-[1.15] text-balance mb-4">
          AI Execution Lab
        </h1>

        <p className="text-base text-surface-400 max-w-2xl leading-relaxed">
          Operational knowledge base by{' '}
          <a
            href="https://asquaresolution.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-surface-300 hover:text-brand-400 transition-colors"
          >
            A Square Solutions
          </a>
          . Real workflows, real systems, real results — documented while building
          production AI tools, SEO engineering pipelines, and GEO/AI-search strategies.
        </p>

        <p className="mt-2 text-sm text-surface-600 italic">
          Not a tutorial site. Every document here comes from something we actually built, broke, fixed, or measured.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/playbooks"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors shadow-sm"
          >
            Browse Playbooks
          </Link>
          <Link
            href="/case-studies"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.10] px-4 py-2 text-sm font-medium text-surface-300 hover:text-surface-100 hover:border-white/[0.18] transition-colors"
          >
            Case Studies
          </Link>
        </div>
      </div>

      {/* ── Animated stats bar ──────────────────────────────── */}
      <StatsBar stats={stats} />

      {/* ── Animated section tracks ─────────────────────────── */}
      <SectionTracks sections={sections} />

      {/* ── Recent feed ────────────────────────────────────── */}
      {recent.length > 0 && (
        <div className="mb-10">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-4">
            Recently added
          </h2>
          <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
            {recent.map((item) => {
              const meta = SECTION_META[item.section]
              const ac   = ACCENT_CLASSES[meta.accent]
              return (
                <Link
                  key={`${item.section}/${item.slug}`}
                  href={`${meta.href}/${item.slug}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.025] transition-colors group"
                >
                  <time className="text-[11px] font-mono text-surface-700 shrink-0 w-20 hidden sm:block">
                    {formatDateMono(item.frontmatter.date)}
                  </time>
                  <span className={`text-[10px] font-mono font-semibold uppercase shrink-0 w-16 ${ac.text}`}>
                    {meta.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-surface-300 group-hover:text-surface-100 transition-colors truncate block">
                      {item.frontmatter.title}
                    </span>
                    {item.frontmatter.description && (
                      <span className="text-xs text-surface-600 truncate block mt-0.5 hidden sm:block">
                        {item.frontmatter.description}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Stack callout ──────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-700 mb-3">
          Built from real execution
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
          {[
            { label: 'Claude Code',           desc: 'AI-assisted development & automation' },
            { label: 'GEO / AI Search',       desc: 'Generative engine optimization' },
            { label: 'WordPress + LiteSpeed', desc: 'Production CMS systems' },
            { label: 'Python / REST API',     desc: 'Automation scripts' },
          ].map(({ label, desc }) => (
            <div key={label}>
              <p className="text-xs font-medium text-surface-300">{label}</p>
              <p className="text-[11px] text-surface-600">{desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
