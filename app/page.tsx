import Link from 'next/link'
import { getAllMeta, getRecentItems } from '@/lib/content'
import { SECTION_META, ACCENT_CLASSES, formatDateMono } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Dashboard homepage
// ─────────────────────────────────────────────────────────────

export default function HomePage() {
  const docs        = getAllMeta('docs')
  const systems     = getAllMeta('systems')
  const labs        = getAllMeta('labs')
  const caseStudies = getAllMeta('case-studies')
  const playbooks   = getAllMeta('playbooks')
  const recent      = getRecentItems(8)

  const totalDocs = docs.length + systems.length + labs.length + caseStudies.length + playbooks.length

  // Section cards config
  const sections = [
    { key: 'docs'         as const, count: docs.length,        items: docs.slice(0, 2)        },
    { key: 'systems'      as const, count: systems.length,     items: systems.slice(0, 2)     },
    { key: 'labs'         as const, count: labs.length,        items: labs.slice(0, 2)        },
    { key: 'case-studies' as const, count: caseStudies.length, items: caseStudies.slice(0, 2) },
    { key: 'playbooks'    as const, count: playbooks.length,   items: playbooks.slice(0, 2)   },
  ]

  return (
    <div className="px-6 lg:px-8 py-8 max-w-5xl">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-mono text-surface-600 uppercase tracking-widest">
            AI Execution Lab
          </span>
          <span className="text-surface-800">·</span>
          <span className="text-[10px] font-mono text-surface-700 uppercase tracking-widest">
            A Square Solutions
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-50">
          Operational Knowledge Base
        </h1>
        <p className="mt-2 text-sm text-surface-400 max-w-xl leading-relaxed">
          Real workflows, real systems, real results — built while shipping{' '}
          <a href="https://asquaresolution.com" target="_blank" rel="noopener noreferrer"
            className="text-surface-300 hover:text-brand-400 transition-colors">
            asquaresolution.com
          </a>
          , TrustSeal, and ScamCheck.
        </p>
      </div>

      {/* ── Stats bar ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-10">
        {sections.map(({ key, count }) => {
          const meta = SECTION_META[key]
          const ac   = ACCENT_CLASSES[meta.accent]
          return (
            <Link
              key={key}
              href={meta.href}
              className={`rounded-lg border px-3 py-2.5 text-center hover:opacity-90 transition-opacity ${ac.border} ${ac.bg}`}
            >
              <p className={`text-lg font-bold font-mono leading-none ${ac.text}`}>{count}</p>
              <p className="mt-1 text-[10px] text-surface-500 uppercase tracking-wide">{meta.title}</p>
            </Link>
          )
        })}
      </div>

      {/* ── Section tracks ─────────────────────────────────── */}
      <div className="mb-12">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-4">
          Sections
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sections.map(({ key, count, items }) => {
            const meta = SECTION_META[key]
            const ac   = ACCENT_CLASSES[meta.accent]
            return (
              <Link
                key={key}
                href={meta.href}
                className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-white/[0.10] hover:bg-white/[0.04] transition-all"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-surface-100 group-hover:text-white transition-colors">
                      {meta.title}
                    </p>
                    <p className="mt-0.5 text-xs text-surface-500 leading-snug max-w-[18ch]">
                      {meta.description.split('.')[0]}.
                    </p>
                  </div>
                  <span className={`text-lg font-bold font-mono ${ac.text}`}>{count}</span>
                </div>

                {/* Recent items in this section */}
                {items.length > 0 && (
                  <div className="space-y-1.5 border-t border-white/[0.05] pt-3">
                    {items.map((item) => (
                      <p key={item.slug} className="text-xs text-surface-500 truncate">
                        <span className="text-surface-600">→ </span>
                        {item.frontmatter.title}
                      </p>
                    ))}
                  </div>
                )}

                {items.length === 0 && (
                  <div className="border-t border-white/[0.05] pt-3">
                    <p className="text-xs text-surface-700 italic">No entries yet</p>
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      </div>

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
                  className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.03] transition-colors group"
                >
                  <time className="text-[11px] font-mono text-surface-700 shrink-0 w-20">
                    {formatDateMono(item.frontmatter.date)}
                  </time>
                  <span className={`text-[10px] font-mono font-semibold uppercase shrink-0 w-14 ${ac.text}`}>
                    {meta.label}
                  </span>
                  <span className="text-sm text-surface-300 group-hover:text-surface-100 transition-colors truncate">
                    {item.frontmatter.title}
                  </span>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2">
          {[
            { label: 'Claude Code',           desc: 'AI-assisted development' },
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
