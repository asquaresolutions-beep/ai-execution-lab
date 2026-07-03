import type { Metadata } from 'next'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { getAllMeta, getRecentItems } from '@/lib/content'
import { SECTION_META, ACCENT_CLASSES, formatDateMono } from '@/lib/utils'
import { getPlatformStatus } from '@/lib/activity'
import { FeaturedFailures }  from '@/components/homepage/featured-failures'
import { LiveActivityBar } from '@/components/platform/live-activity-bar'
import { CheckMessageBox } from '@/components/scam/check-message-box'
import { TrendingTicker } from '@/components/scam/trending-ticker'
import { getEvidenceMetrics, formatOperationalHours, formatAvgResolution } from '@/lib/evidence-metrics'
import { FeaturedArticles } from '@/components/lab/featured-articles'
import { PopularArticles } from '@/components/lab/popular-articles'
import { NewsletterSignup } from '@/components/lab/newsletter-signup'

// Code-split framer-motion components — reduces initial JS parse work
const StatsBar = dynamic(
  () => import('@/components/homepage/stats-bar').then(m => m.StatsBar),
  { loading: () => <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-10">{Array.from({length:7}).map((_,i) => <div key={i} className="h-[62px] rounded-xl border border-white/[0.05] bg-white/[0.01] animate-pulse" />)}</div> }
)
const SectionTracks = dynamic(
  () => import('@/components/homepage/section-tracks').then(m => m.SectionTracks),
  { loading: () => <div className="mb-12 grid grid-cols-1 sm:grid-cols-2 gap-3">{Array.from({length:6}).map((_,i) => <div key={i} className="h-28 rounded-xl border border-white/[0.05] bg-white/[0.01] animate-pulse" />)}</div> }
)

// Page-level canonical: the root layout deliberately sets none (a global one
// previously leaked across product domains), so the Lab homepage self-canonicalizes.
export const metadata: Metadata = {
  alternates: { canonical: '/', types: { 'application/rss+xml': 'https://lab.asquaresolution.com/feed.xml' } },
}

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
  const platformStatus = getPlatformStatus()

  const stats = [
    { key: 'docs'         as const, count: docs.length        },
    { key: 'systems'      as const, count: systems.length     },
    { key: 'labs'         as const, count: labs.length        },
    { key: 'case-studies' as const, count: caseStudies.length },
    { key: 'playbooks'    as const, count: playbooks.length   },
    { key: 'failures'     as const, count: failures.length    },
  ]

  const evMetrics = getEvidenceMetrics()

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
          and execution tracks built from building{' '}
          <a href="https://trustseal.asquaresolution.com" target="_blank" rel="noopener noreferrer" className="text-blue-400/80 hover:text-blue-400 transition-colors">TrustSeal</a>
          ,{' '}
          <a href="https://scamcheck.asquaresolution.com" target="_blank" rel="noopener noreferrer" className="text-amber-400/80 hover:text-amber-400 transition-colors">ScamCheck</a>
          , and production AI pipelines for clients — documented while the work happens.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-surface-600">
          <span>Implementation over theory</span>
          <span>·</span>
          <span>Failures are first-class content</span>
          <span>·</span>
          <span>Built before documented</span>
        </div>

        <p className="mt-2 text-xs text-surface-500">
          Written and maintained by{' '}
          <a
            href="https://asquaresolution.com/about-us/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-surface-400 underline decoration-surface-700 underline-offset-2 hover:text-brand-400 transition-colors"
          >
            Anis Ansari
          </a>
          , founder of A Square Solutions.
        </p>

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
            href="/scams"
            className="inline-flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/[0.12] hover:border-amber-500/40 transition-colors"
          >
            Scam Alerts
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

        {/* ── Check a message (above-the-fold engagement) ──────── */}
        <CheckMessageBox />
      </div>

      {/* ── Live trending ticker (above fold, auto-rotating) ─── */}
      <TrendingTicker />

      {/* ── Live activity bar ────────────────────────────────── */}
      <LiveActivityBar status={platformStatus} />

      {/* ── Stats bar ────────────────────────────────────────── */}
      <StatsBar stats={stats} />

      {/* ── Featured articles ────────────────────────────────── */}
      <FeaturedArticles heading="Featured Articles" />

      {/* ── Popular + Newsletter ─────────────────────────────── */}
      <div className="mb-12 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><PopularArticles heading="Popular Articles" /></div>
        <NewsletterSignup />
      </div>

      {/* ── Operational evidence strip ───────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-10 -mt-6">
        {[
          {
            value: evMetrics.evidenceCount,
            label: 'evidence pieces',
            sub:   'production screenshots',
          },
          {
            value: formatOperationalHours(evMetrics),
            label: 'operational hours',
            sub:   `${evMetrics.deploymentCount} deployments logged`,
          },
          {
            value: `${evMetrics.resolvedCount}/${evMetrics.failureCount}`,
            label: 'failures resolved',
            sub:   `avg ${formatAvgResolution(evMetrics)}`,
          },
          {
            value: evMetrics.totalContentItems,
            label: 'published items',
            sub:   'across all sections',
          },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-white/[0.05] bg-white/[0.01] px-3 py-2.5 text-center">
            <p className="text-lg font-bold font-mono text-surface-200 leading-none">{item.value}</p>
            <p className="text-[10px] text-surface-600 mt-1">{item.label}</p>
            <p className="text-[9px] text-surface-700 mt-0.5 font-mono">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Scam Intelligence (homepage → scam entity authority flow) ── */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600">
            Scam Intelligence — live India scam alerts
          </h2>
          <Link href="/scams" className="text-[10px] font-mono text-surface-600 hover:text-amber-400 transition-colors">
            All scams →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { href: '/scams/type/upi-fraud', q: 'Is this a UPI scam?', sub: 'refund / collect-request tricks' },
            { href: '/scams/type/kyc-fraud', q: 'Got a KYC update link?', sub: 'fake KYC freeze threats' },
            { href: '/scams/platform/whatsapp', q: 'Suspicious WhatsApp message?', sub: 'forwarded fraud warnings' },
            { href: '/scams/type/fake-job', q: 'Offered an easy job?', sub: 'task / registration-fee scams' },
            { href: '/scams/hub/festival-scams', q: 'Festival sale too good?', sub: 'seasonal scam alerts' },
            { href: '/scams', label: 'See all scam alerts', sub: 'trending + active now', arrow: true },
          ].map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="rounded-xl border border-amber-500/[0.12] bg-amber-500/[0.03] px-3 py-2.5 hover:border-amber-500/30 hover:bg-amber-500/[0.07] transition-colors"
            >
              <p className="text-sm font-medium text-surface-200">{c.arrow ? `${c.label} →` : c.q}</p>
              <p className="text-[10px] text-surface-600 mt-0.5 font-mono">{c.sub}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Topic cluster ───────────────────────────────────── */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600">
            Explore by topic
          </h2>
          <Link
            href="/tags"
            className="text-[10px] font-mono text-surface-600 hover:text-brand-400 transition-colors"
          >
            All topics →
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { tag: 'firebase',     label: 'Firebase',       color: 'text-amber-400  border-amber-500/20  bg-amber-500/[0.04]  hover:border-amber-500/35'  },
            { tag: 'deployment',   label: 'Deployment',     color: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/[0.04] hover:border-indigo-500/35' },
            { tag: 'gemini',       label: 'Gemini API',     color: 'text-blue-400   border-blue-500/20   bg-blue-500/[0.04]   hover:border-blue-500/35'   },
            { tag: 'observability',label: 'Observability',  color: 'text-red-400    border-red-500/20    bg-red-500/[0.04]    hover:border-red-500/35'    },
            { tag: 'geo',          label: 'GEO',            color: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/[0.04] hover:border-yellow-500/35' },
            { tag: 'seo',          label: 'SEO',            color: 'text-green-400  border-green-500/20  bg-green-500/[0.04]  hover:border-green-500/35'  },
            { tag: 'trustseal',    label: 'TrustSeal',      color: 'text-blue-300   border-blue-400/20   bg-blue-400/[0.04]   hover:border-blue-400/35'   },
            { tag: 'scamcheck',    label: 'ScamCheck',      color: 'text-amber-300  border-amber-400/20  bg-amber-400/[0.04]  hover:border-amber-400/35'  },
            { tag: 'claude-code',  label: 'Claude Code',    color: 'text-brand-400  border-brand-500/20  bg-brand-500/[0.04]  hover:border-brand-500/35'  },
            { tag: 'reliability',  label: 'Reliability',    color: 'text-surface-400 border-white/[0.08] bg-white/[0.02]      hover:border-white/[0.15]'  },
          ].map(({ tag, label, color }) => (
            <Link
              key={tag}
              href={`/tags/${tag}`}
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-mono transition-all ${color}`}
            >
              #{label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Featured failures ────────────────────────────────── */}
      <FeaturedFailures />

      {/* ── Featured beginner track for students ─────────────── */}
      <Link
        href="/tracks/ai-for-students"
        className="group mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-purple-500/25 bg-purple-500/[0.05] px-5 py-4 transition hover:border-purple-500/45"
      >
        <div>
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-purple-300/80">New to AI? Start here</p>
          <p className="mt-1 text-sm font-medium text-surface-100">AI for Students — our most complete beginner track</p>
          <p className="mt-0.5 text-xs text-surface-500">Learn faster, research smarter, and write honestly with AI — 9 practical lessons.</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-purple-300">Start the track →</span>
      </Link>

      {/* ── Section grid ─────────────────────────────────────── */}
      <SectionTracks sections={sections} />

      {/* ── Live production systems ──────────────────────────── */}
      <div className="mb-10">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-4">
          Production systems documented here
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              name: 'A Square Solutions',
              tag: 'Agency',
              href: 'https://asquaresolution.com',
              desc: 'Production WordPress & AI engineering. GEO strategy, SEO operations, full-stack AI deployment for B2B clients.',
              accent: 'text-brand-400',
              borderColor: 'hover:border-brand-500/30',
            },
            {
              name: 'TrustSeal',
              tag: 'Product',
              href: 'https://trustseal.asquaresolution.com',
              desc: 'Trust Intelligence Platform for domain & business verification — trust scores, certificates and a Trust API. Built and documented in this Lab.',
              accent: 'text-blue-400',
              borderColor: 'hover:border-blue-500/30',
            },
            {
              name: 'ScamCheck',
              tag: 'Product',
              href: 'https://scamcheck.asquaresolution.com',
              desc: 'Free AI scam detection. Analyzes messages, UPI IDs, and links for fraud signals. Firebase + Cloud Functions. Built and documented in this Lab.',
              accent: 'text-amber-400',
              borderColor: 'hover:border-amber-500/30',
            },
          ].map(item => (
            <a
              key={item.name}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`group rounded-xl border border-white/[0.06] bg-white/[0.01] px-4 py-3.5 ${item.borderColor} hover:bg-white/[0.03] transition-all`}
            >
              <div className="flex items-start justify-between mb-2">
                <p className={`text-sm font-semibold ${item.accent} group-hover:opacity-90 transition-opacity`}>{item.name} ↗</p>
                <span className="text-[9px] font-mono font-semibold uppercase tracking-wider text-surface-700 mt-0.5">{item.tag}</span>
              </div>
              <p className="text-[11px] text-surface-600 leading-relaxed">{item.desc}</p>
            </a>
          ))}
        </div>
      </div>

      {/* ── Work with us (closes the evaluation loop) ────────── */}
      <a
        href="https://asquaresolution.com/contact/"
        target="_blank"
        rel="noopener noreferrer"
        className="group mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-brand-500/25 bg-brand-500/[0.05] px-5 py-4 transition hover:border-brand-500/45"
      >
        <div>
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-300/80">Evaluating us for a project?</p>
          <p className="mt-1 text-sm font-medium text-surface-100">This Lab is how we actually work — failures included.</p>
          <p className="mt-0.5 text-xs text-surface-500">If you want the same engineering discipline on your build, talk to A Square Solutions. Free consultation, 24h response.</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-brand-300">Start a conversation →</span>
      </a>

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
