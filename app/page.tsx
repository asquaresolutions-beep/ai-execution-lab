import Link from 'next/link'
import dynamic from 'next/dynamic'
import { getAllMeta, getRecentItems } from '@/lib/content'
import { SECTION_META, ACCENT_CLASSES, formatDateMono } from '@/lib/utils'
import { FeaturedFailures }  from '@/components/homepage/featured-failures'

// Code-split framer-motion components — reduces initial JS parse work
const StatsBar = dynamic(
  () => import('@/components/homepage/stats-bar').then(m => m.StatsBar),
  { loading: () => <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-10">{Array.from({length:7}).map((_,i) => <div key={i} className="h-[62px] rounded-xl border border-white/[0.05] bg-white/[0.01] animate-pulse" />)}</div> }
)
const SectionTracks = dynamic(
  () => import('@/components/homepage/section-tracks').then(m => m.SectionTracks),
  { loading: () => <div className="mb-12 grid grid-cols-1 sm:grid-cols-2 gap-3">{Array.from({length:6}).map((_,i) => <div key={i} className="h-28 rounded-xl border border-white/[0.05] bg-white/[0.01] animate-pulse" />)}</div> }
)

// ─────────────────────────────────────────────────────────────
// Environment badge
// ─────────────────────────────────────────────────────────────

function EnvBadge() {
  const isProd = process.env.NODE_ENV === 'production'
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-widest ${
      isProd ? 'text-green-500/80' : 'text-yellow-500/80'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isProd ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
      {isProd ? 'Production' : 'Local dev'}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function HomePage() {
  const docs        = getAllMeta('docs')
  const systems     = getAllMeta('systems')
  const labs        = getAllMeta('labs')
  const caseStudies = getAllMeta('case-studies')
  const playbooks   = getAllMeta('playbooks')
  const failures    = getAllMeta('failures')
  const logs        = getAllMeta('logs')
  const recent      = getRecentItems(8)

  const stats = [
    { key: 'docs'         as const, count: docs.length        },
    { key: 'systems'      as const, count: systems.length     },
    { key: 'labs'         as const, count: labs.length        },
    { key: 'case-studies' as const, count: caseStudies.length },
    { key: 'playbooks'    as const, count: playbooks.length   },
    { key: 'failures'     as const, count: failures.length    },
  ]

  const sections = [
    { key: 'docs'         as const, count: docs.length,        items: docs.slice(0, 2)        },
    { key: 'systems'      as const, count: systems.length,     items: systems.slice(0, 2)     },
    { key: 'labs'         as const, count: labs.length,        items: labs.slice(0, 2)        },
    { key: 'case-studies' as const, count: caseStudies.length, items: caseStudies.slice(0, 2) },
    { key: 'playbooks'    as const, count: playbooks.length,   items: playbooks.slice(0, 2)   },
    { key: 'failures'     as const, count: failures.length,    items: failures.slice(0, 2)    },
    { key: 'logs'         as const, count: logs.length,        items: logs.slice(0, 2)        },
  ]

  return (
    <div className="px-6 lg:px-8 py-8 max-w-5xl">

      {/* ── Hero ────────────────────────────────────────────── */}
      <div className="mb-10 pb-10 border-b border-white/[0.05]">
        <div className="flex items-center gap-2 mb-4">
          <EnvBadge />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-surface-50 leading-[1.15] text-balance mb-3">
          AI Execution Lab
        </h1>

        <p className="text-base text-surface-400 max-w-2xl leading-relaxed">
          A public AI engineering journal by{' '}
          <a
            href="https://asquaresolution.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-surface-300 hover:text-brand-400 transition-colors"
          >
            A Square Solutions
          </a>
          . Production failures with exact fixes, operational playbooks, Claude Code workflows,
          and execution tracks built from two years of daily AI engineering — documented while
          the work happens.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-surface-600">
          <span>Implementation over theory</span>
          <span>·</span>
          <span>Failures are first-class content</span>
          <span>·</span>
          <span>Built before documented</span>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/start-here"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors shadow-sm"
          >
            ▶ Start Here
          </Link>
          <Link
            href="/tracks"
            className="inline-flex items-center gap-2 rounded-lg border border-brand-500/25 bg-brand-500/[0.06] px-4 py-2 text-sm font-medium text-brand-400 hover:bg-brand-500/[0.12] hover:border-brand-500/40 transition-colors"
          >
            Execution Tracks
          </Link>
          <Link
            href="/failures"
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/[0.06] px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/[0.12] hover:border-red-500/40 transition-colors"
          >
            Failure Archive
          </Link>
          <Link
            href="/playbooks"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.10] px-4 py-2 text-sm font-medium text-surface-300 hover:text-surface-100 hover:border-white/[0.18] transition-colors"
          >
            Playbooks
          </Link>
        </div>
      </div>

      {/* ── Stats bar ────────────────────────────────────────── */}
      <StatsBar stats={stats} />

      {/* ── Featured failures ────────────────────────────────── */}
      <FeaturedFailures />

      {/* ── Section grid ─────────────────────────────────────── */}
      <SectionTracks sections={sections} />

      {/* ── Recent activity feed ─────────────────────────────── */}
      {recent.length > 0 && (
        <div className="mb-10">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-4">
            Recent activity
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
                  <span className="text-[11px] font-mono text-surface-700 shrink-0 hidden sm:block">
                    {item.readingTime}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Platform clarity ─────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] px-5 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-700 mb-4">
          How this platform works
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              title: 'Execution-first',
              desc:  'Content is written during or immediately after an actual execution — deployment, debug session, experiment, or build. Not drafted in advance.',
            },
            {
              title: 'Failures are first-class',
              desc:  'Every production incident is documented with root cause, timeline, and prevention pattern. The Failure Archive is core content, not a footnote.',
            },
            {
              title: 'GEO/AI-search native',
              desc:  'All content is structured for AI retrieval — entity-rich, schema-marked, and written with specificity that AI summarizers can extract accurately.',
            },
            {
              title: 'Public by design',
              desc:  'This is a public engineering journal. Distribution is part of the system. Every article has share actions, canonical URLs, and syndication templates.',
            },
          ].map(({ title, desc }) => (
            <div key={title} className="flex gap-3">
              <span className="text-brand-500 text-xs mt-0.5 shrink-0">▶</span>
              <div>
                <p className="text-xs font-medium text-surface-300">{title}</p>
                <p className="text-[11px] text-surface-600 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
