import Link from 'next/link'
import type { Metadata } from 'next'
import { getAllMeta, type ContentSection } from '@/lib/content'
import { SECTION_META, ACCENT_CLASSES, formatDateMono, cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Operations',
  description: 'Platform operational status — recent failures, latest logs, content health, and publishing queue.',
  robots: { index: false, follow: false },
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const ALL_SECTIONS: ContentSection[] = [
  'docs', 'systems', 'labs', 'case-studies', 'playbooks', 'failures', 'logs',
]

const SEV_DOT: Record<string, string> = {
  low:      'bg-blue-400',
  medium:   'bg-yellow-400',
  high:     'bg-orange-400',
  critical: 'bg-red-500 animate-pulse',
}

const STA_TEXT: Record<string, string> = {
  open:          'text-red-400',
  investigating: 'text-yellow-400',
  resolved:      'text-green-400',
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function OpsPage() {
  const isProd = process.env.NODE_ENV === 'production'

  // Gather all content
  const allSectionData = ALL_SECTIONS.map(s => ({
    section: s,
    items: getAllMeta(s),
  }))

  const failures = getAllMeta('failures')
  const logs     = getAllMeta('logs')

  const openFailures   = failures.filter(f => f.frontmatter.failure_status !== 'resolved')
  const recentFailures = failures.slice(0, 5)
  const recentLogs     = logs.slice(0, 6)

  // Draft count (only visible in dev)
  const drafts = allSectionData.flatMap(({ section, items }) =>
    items
      .filter(i => i.frontmatter.status === 'draft')
      .map(i => ({ ...i, section }))
  )

  // Total published
  const totalPublished = allSectionData.reduce((n, { items }) => n + items.length, 0)

  return (
    <div className="px-6 lg:px-8 py-8 max-w-5xl">

      {/* Header */}
      <div className="mb-8 pb-6 border-b border-white/[0.05]">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest rounded px-2 py-1 border text-surface-500 bg-surface-800/60 border-surface-700/40">
            OPS
          </span>
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono ${isProd ? 'text-green-400' : 'text-yellow-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isProd ? 'bg-green-500' : 'bg-yellow-400 animate-pulse'}`} />
            {isProd ? 'Production' : 'Development'}
          </span>
          {openFailures.length > 0 && (
            <span className="text-[10px] font-mono text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-0.5">
              {openFailures.length} open incident{openFailures.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-50">
          Platform Operations
        </h1>
        <p className="mt-1 text-sm text-surface-500">
          {totalPublished} items published across {ALL_SECTIONS.length} sections
          {drafts.length > 0 && ` · ${drafts.length} draft${drafts.length > 1 ? 's' : ''} pending`}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column: failures + logs ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Active incidents */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600">
                Failure Archive
              </h2>
              <div className="flex items-center gap-2 text-[10px] font-mono text-surface-700">
                <span className="text-green-400">{failures.filter(f => f.frontmatter.failure_status === 'resolved').length} resolved</span>
                {openFailures.length > 0 && (
                  <span className="text-red-400">{openFailures.length} open</span>
                )}
              </div>
            </div>

            {recentFailures.length === 0 ? (
              <div className="rounded-xl border border-white/[0.05] border-dashed p-6 text-center">
                <p className="text-surface-700 text-xs">No failures documented yet.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
                {recentFailures.map(item => {
                  const fm  = item.frontmatter
                  const dot = fm.severity ? SEV_DOT[fm.severity] : 'bg-surface-600'
                  const sta = fm.failure_status ? STA_TEXT[fm.failure_status] : 'text-surface-600'
                  return (
                    <Link
                      key={item.slug}
                      href={`/failures/${item.slug}`}
                      className="group flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className={cn('w-2 h-2 rounded-full shrink-0', dot)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-surface-300 group-hover:text-surface-100 truncate transition-colors">
                          {fm.title}
                        </p>
                        {fm.failure_type && (
                          <p className="text-[10px] text-surface-700 mt-0.5">{fm.failure_type}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={cn('text-[10px] font-mono', sta)}>
                          {fm.failure_status ?? 'unknown'}
                        </span>
                        {fm.resolution_time && (
                          <span className="text-[10px] font-mono text-surface-700 hidden sm:block">
                            {fm.resolution_time}
                          </span>
                        )}
                        <time className="text-[10px] font-mono text-surface-700 hidden sm:block">
                          {formatDateMono(fm.date)}
                        </time>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

            <div className="mt-2 flex items-center gap-3">
              <Link href="/failures" className="text-[11px] font-mono text-surface-700 hover:text-surface-400 transition-colors">
                All failures →
              </Link>
              <Link href="/content/failures/new" className="text-[11px] font-mono text-brand-500/70 hover:text-brand-400 transition-colors">
                + Add failure
              </Link>
            </div>
          </div>

          {/* Recent logs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600">
                Execution Logs
              </h2>
              <span className="text-[10px] font-mono text-surface-700">
                {logs.length} total
              </span>
            </div>

            {recentLogs.length === 0 ? (
              <div className="rounded-xl border border-white/[0.05] border-dashed p-6 text-center">
                <p className="text-surface-700 text-xs">No logs yet.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
                {recentLogs.map(item => {
                  const fm = item.frontmatter
                  return (
                    <Link
                      key={item.slug}
                      href={`/logs/${item.slug}`}
                      className="group flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-surface-300 group-hover:text-surface-100 truncate transition-colors">
                          {fm.title}
                        </p>
                        {fm.outcome && (
                          <p className="text-[11px] text-surface-600 mt-0.5 truncate hidden sm:block">
                            {fm.outcome}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {fm.log_type && (
                          <span className="text-[10px] font-mono text-surface-700 capitalize">
                            {fm.log_type}
                          </span>
                        )}
                        {fm.duration && (
                          <span className="text-[10px] font-mono text-surface-700 hidden sm:block">
                            {fm.duration}
                          </span>
                        )}
                        <time className="text-[10px] font-mono text-surface-700">
                          {formatDateMono(fm.date)}
                        </time>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

            <div className="mt-2">
              <Link href="/logs" className="text-[11px] font-mono text-surface-700 hover:text-surface-400 transition-colors">
                All logs →
              </Link>
            </div>
          </div>

          {/* Drafts (dev only) */}
          {drafts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600">
                  Drafts
                </h2>
                <span className="text-[10px] font-mono text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded px-1.5 py-0.5">
                  {drafts.length} unpublished
                </span>
              </div>
              <div className="rounded-xl border border-yellow-500/15 divide-y divide-white/[0.04] overflow-hidden">
                {drafts.map(item => {
                  const meta = SECTION_META[item.section]
                  const ac   = ACCENT_CLASSES[meta.accent]
                  return (
                    <Link
                      key={item.slug}
                      href={`${meta.href}/${item.slug}`}
                      className="group flex items-center gap-3 px-4 py-3 hover:bg-yellow-500/[0.03] transition-colors"
                    >
                      <span className={`text-[10px] font-mono uppercase shrink-0 ${ac.text}`}>
                        {meta.label}
                      </span>
                      <span className="text-sm text-surface-400 group-hover:text-surface-200 truncate transition-colors flex-1">
                        {item.frontmatter.title}
                      </span>
                      <span className="text-[10px] font-mono text-yellow-500 shrink-0">draft</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: section health ── */}
        <div className="space-y-6">

          {/* Section counts */}
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-3">
              Content Health
            </h2>
            <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
              {allSectionData.map(({ section, items }) => {
                const meta   = SECTION_META[section]
                const ac     = ACCENT_CLASSES[meta.accent]
                const latest = items[0]
                return (
                  <Link
                    key={section}
                    href={meta.href}
                    className="group flex items-center gap-3 px-4 py-3 hover:bg-white/[0.025] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-[10px] font-mono font-semibold uppercase', ac.text)}>
                        {meta.label}
                      </p>
                      {latest && (
                        <p className="text-[11px] text-surface-700 mt-0.5 truncate">
                          {formatDateMono(latest.frontmatter.date)}
                        </p>
                      )}
                    </div>
                    <span className={cn('text-sm font-bold font-mono', ac.text)}>
                      {items.length}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-3">
              Quick Links
            </h2>
            <div className="space-y-1.5">
              {[
                { label: 'Syndication tool',      href: '/syndicate' },
                { label: 'Topics overview',       href: '/tags' },
                { label: 'Publishing workflow',   href: '/docs/publishing-workflow' },
                { label: 'Publishing cadence',    href: '/docs/publishing-cadence' },
                { label: 'Frontmatter reference', href: '/docs/frontmatter-reference' },
                { label: 'Analytics setup',       href: '/docs/analytics-setup' },
                { label: 'Launch checklist',      href: '/docs/launch-checklist' },
                { label: 'Deployment workflow',   href: '/docs/deployment-workflow' },
                { label: 'Launch assets',         href: '/docs/launch-assets' },
                { label: 'Execution Tracks',      href: '/tracks' },
                { label: 'Sitemap',               href: '/sitemap.xml' },
              ].map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.01] px-3 py-2 text-xs text-surface-500 hover:text-surface-200 hover:border-white/[0.10] transition-all group"
                >
                  <span>{label}</span>
                  <span className="text-surface-700 group-hover:text-surface-400 transition-colors">→</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Environment vars checklist */}
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-3">
              Analytics Status
            </h2>
            <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
              {[
                { label: 'Plausible',           env: 'NEXT_PUBLIC_PLAUSIBLE_DOMAIN' },
                { label: 'Google Analytics',    env: 'NEXT_PUBLIC_GA_ID'           },
                { label: 'Site URL',            env: 'NEXT_PUBLIC_SITE_URL'        },
              ].map(({ label, env }) => {
                const isSet = !!process.env[env]
                return (
                  <div key={env} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-xs text-surface-400">{label}</p>
                      <p className="text-[10px] font-mono text-surface-700">{env}</p>
                    </div>
                    <span className={`text-[10px] font-mono ${isSet ? 'text-green-400' : 'text-surface-700'}`}>
                      {isSet ? '✓ set' : 'not set'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
