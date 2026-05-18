import Link from 'next/link'
import type { Metadata } from 'next'
import { getAllMeta, type ContentSection } from '@/lib/content'
import { getPlatformStatus, getPublishingStreak, getMonthlyVelocity, getTrackCompletion } from '@/lib/activity'
import {
  ECOSYSTEM_PROPERTIES,
  OPERATIONAL_DEBT,
  ACTIVE_EXPERIMENTS,
  getEcosystemSummary,
  type PropertyStatus,
  type DebtPriority,
} from '@/lib/ecosystem'
import { SECTION_META, ACCENT_CLASSES, formatDateMono, cn } from '@/lib/utils'
import { ReadingQueue } from '@/components/platform/reading-queue'

export const metadata: Metadata = {
  title: 'Operations — Command Center',
  description: 'Platform operational status — execution velocity, track completion, failures, publishing momentum, and content health.',
  robots: { index: false, follow: false },
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const ALL_SECTIONS: ContentSection[] = [
  'docs', 'systems', 'labs', 'case-studies', 'playbooks', 'failures', 'logs',
]

function getAccent(key: string) {
  return (ACCENT_CLASSES as Record<string, typeof ACCENT_CLASSES[keyof typeof ACCENT_CLASSES]>)[key] ?? ACCENT_CLASSES['brand']
}

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
// Velocity bar (visual)
// ─────────────────────────────────────────────────────────────

function VelocityBar({ count, max }: { count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  const color = count >= 12 ? 'bg-green-500' : count >= 6 ? 'bg-yellow-500' : count >= 2 ? 'bg-orange-500' : 'bg-surface-700'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-surface-600 w-4 text-right shrink-0">{count}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Track completion bar
// ─────────────────────────────────────────────────────────────

function TrackProgressBar({ pct, accent }: { pct: number; accent: string }) {
  const ac = getAccent(accent)
  const bgColor = ac.bg.replace('/10', '/30')
  return (
    <div className="flex-1 h-1 bg-white/[0.05] rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${bgColor}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Ecosystem status helpers
// ─────────────────────────────────────────────────────────────

const PROPERTY_STATUS_STYLES: Record<PropertyStatus, { dot: string; text: string; label: string }> = {
  live:        { dot: 'bg-green-500',              text: 'text-green-400',  label: 'Live'        },
  degraded:    { dot: 'bg-yellow-400 animate-pulse', text: 'text-yellow-400', label: 'Degraded'  },
  maintenance: { dot: 'bg-blue-400',               text: 'text-blue-400',   label: 'Maintenance' },
  building:    { dot: 'bg-brand-400 animate-pulse', text: 'text-brand-400', label: 'Building'    },
}

const DEBT_PRIORITY_STYLES: Record<DebtPriority, { text: string; bg: string; border: string }> = {
  p1: { text: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20'    },
  p2: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  p3: { text: 'text-surface-500', bg: 'bg-white/[0.03]', border: 'border-white/[0.06]'  },
}

// ─────────────────────────────────────────────────────────────
// Quick action button
// ─────────────────────────────────────────────────────────────

function QuickAction({ href, label, badge }: { href: string; label: string; badge?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.01] px-3 py-2 text-xs text-surface-500 hover:text-surface-200 hover:border-white/[0.10] hover:bg-white/[0.03] transition-all group"
    >
      <span>{label}</span>
      <div className="flex items-center gap-1.5">
        {badge && (
          <span className="text-[10px] font-mono text-surface-700">{badge}</span>
        )}
        <span className="text-surface-700 group-hover:text-surface-400 transition-colors">→</span>
      </div>
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function OpsPage() {
  const isProd = process.env.NODE_ENV === 'production'

  // Content data
  const allSectionData = ALL_SECTIONS.map(s => ({
    section: s,
    items: getAllMeta(s),
  }))
  const failures  = getAllMeta('failures')
  const logs      = getAllMeta('logs')

  const openFailures   = failures.filter(f => f.frontmatter.failure_status !== 'resolved')
  const recentFailures = failures.slice(0, 5)
  const recentLogs     = logs.slice(0, 6)

  // Activity + metrics
  const status          = getPlatformStatus()
  const { recentSignals, itemsThisMonth, itemsThisWeek, totalLessons, availableLessons } = status
  const streak          = getPublishingStreak(recentSignals)
  const velocity        = getMonthlyVelocity(recentSignals, 4)
  const trackCompletion = getTrackCompletion()
  const maxVelocity     = Math.max(...velocity.map(v => v.count), 1)

  // Ecosystem + observability
  const ecosystemSummary = getEcosystemSummary()
  const p1Debt = OPERATIONAL_DEBT.filter(d => d.priority === 'p1')
  const activeExperiments = ACTIVE_EXPERIMENTS.filter(e => e.status === 'active')

  // Draft count (dev only)
  const drafts = allSectionData.flatMap(({ section, items }) =>
    items.filter(i => i.frontmatter.status === 'draft').map(i => ({ ...i, section }))
  )
  const totalPublished = allSectionData.reduce((n, { items }) => n + items.length, 0)

  // Staleness
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const staleSections = allSectionData.filter(({ items }) => {
    if (items.length === 0) return false
    const latest = items[0]?.frontmatter.date
    if (!latest) return false
    return new Date(latest) < thirtyDaysAgo
  })

  return (
    <div className="px-6 lg:px-8 py-8 max-w-5xl">

      {/* ── Header ── */}
      <div className="mb-8 pb-6 border-b border-white/[0.05]">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
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
          {ecosystemSummary.degraded > 0 && (
            <span className="text-[10px] font-mono text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-0.5">
              {ecosystemSummary.degraded} property degraded
            </span>
          )}
          {ecosystemSummary.p1Debt > 0 && (
            <span className="text-[10px] font-mono text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded px-2 py-0.5">
              {ecosystemSummary.p1Debt} P1 debt item{ecosystemSummary.p1Debt > 1 ? 's' : ''}
            </span>
          )}
          {streak > 1 && (
            <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5">
              {streak}-day streak
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-50">
          Platform Operations
        </h1>
        <p className="mt-1 text-sm text-surface-500">
          {totalPublished} items · {availableLessons}/{totalLessons} lessons live
          · {itemsThisMonth} published this month
          {drafts.length > 0 && ` · ${drafts.length} draft${drafts.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {/* ── Execution Momentum Strip ── */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'This week',
            value: itemsThisWeek,
            color: itemsThisWeek >= 5 ? 'text-green-400' : itemsThisWeek >= 2 ? 'text-yellow-400' : 'text-red-400',
            sub: 'items shipped',
          },
          {
            label: 'This month',
            value: itemsThisMonth,
            color: itemsThisMonth >= 20 ? 'text-green-400' : itemsThisMonth >= 10 ? 'text-yellow-400' : 'text-red-400',
            sub: 'items shipped',
          },
          {
            label: 'Lessons live',
            value: availableLessons,
            color: 'text-brand-400',
            sub: `of ${totalLessons} total`,
          },
          {
            label: 'Open incidents',
            value: openFailures.length,
            color: openFailures.length > 0 ? 'text-red-400' : 'text-green-400',
            sub: openFailures.length === 0 ? 'all resolved' : `need attention`,
          },
        ].map(({ label, value, color, sub }) => (
          <div
            key={label}
            className="rounded-xl border border-white/[0.06] bg-white/[0.01] px-4 py-3"
          >
            <p className="text-[10px] font-mono text-surface-700 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
            <p className="text-[10px] text-surface-700 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: failures + logs + drafts ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Failure archive */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600">
                Failure Archive
              </h2>
              <div className="flex items-center gap-2 text-[10px] font-mono text-surface-700">
                <span className="text-green-400">{failures.filter(f => f.frontmatter.failure_status === 'resolved').length} resolved</span>
                {openFailures.length > 0 && <span className="text-red-400">{openFailures.length} open</span>}
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
                          <p className="text-[10px] text-surface-700 mt-0.5 capitalize">{fm.failure_type}</p>
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
            <div className="mt-2">
              <Link href="/failures" className="text-[11px] font-mono text-surface-700 hover:text-surface-400 transition-colors">
                All failures →
              </Link>
            </div>
          </div>

          {/* Execution logs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600">
                Execution Logs
              </h2>
              <span className="text-[10px] font-mono text-surface-700">{logs.length} total</span>
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

          {/* Ecosystem deployment state */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600">
                Ecosystem
              </h2>
              <span className="text-[10px] font-mono text-green-400">
                {ecosystemSummary.live}/{ecosystemSummary.total} live
              </span>
            </div>
            <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
              {ECOSYSTEM_PROPERTIES.map(prop => {
                const st = PROPERTY_STATUS_STYLES[prop.status]
                return (
                  <a
                    key={prop.domain}
                    href={prop.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <span className={cn('w-2 h-2 rounded-full shrink-0 mt-1', st.dot)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-surface-300 group-hover:text-surface-100 transition-colors font-medium">
                        {prop.name}
                      </p>
                      <p className="text-[10px] font-mono text-surface-700 mt-0.5 truncate">
                        {prop.domain} · {prop.platform}
                      </p>
                      <p className="text-[10px] text-surface-700 mt-0.5 truncate hidden sm:block">
                        {prop.deployNote}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cn('text-[10px] font-mono', st.text)}>{st.label}</p>
                      <p className="text-[10px] font-mono text-surface-700 mt-0.5">{prop.lastDeployed}</p>
                    </div>
                  </a>
                )
              })}
            </div>
          </div>

          {/* Operational debt */}
          {OPERATIONAL_DEBT.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600">
                  Operational Debt
                </h2>
                <span className="text-[10px] font-mono text-surface-700">
                  {OPERATIONAL_DEBT.length} items
                </span>
              </div>
              <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
                {OPERATIONAL_DEBT.map(item => {
                  const pst = DEBT_PRIORITY_STYLES[item.priority]
                  return (
                    <div key={item.id} className="px-4 py-3 flex items-start gap-3">
                      <span className={cn(
                        'text-[9px] font-mono font-bold uppercase rounded px-1.5 py-0.5 border shrink-0 mt-0.5',
                        pst.text, pst.bg, pst.border
                      )}>
                        {item.priority.toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-surface-400 leading-snug">{item.title}</p>
                        <p className="text-[10px] font-mono text-surface-700 mt-0.5 capitalize">{item.area}</p>
                      </div>
                      {item.linkedDoc && (
                        <Link
                          href={item.linkedDoc}
                          className="shrink-0 text-[10px] font-mono text-surface-700 hover:text-brand-400 transition-colors"
                        >
                          doc →
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Active experiments */}
          {activeExperiments.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600">
                  Active Experiments
                </h2>
                <span className="text-[10px] font-mono text-brand-400">
                  {activeExperiments.length} running
                </span>
              </div>
              <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
                {activeExperiments.map(exp => (
                  <div key={exp.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs text-surface-300 font-medium leading-snug">{exp.title}</p>
                      <span className="text-[10px] font-mono text-brand-400 shrink-0">{exp.startDate}</span>
                    </div>
                    <p className="text-[11px] text-surface-600 leading-snug mb-1">{exp.hypothesis}</p>
                    <p className="text-[10px] font-mono text-surface-700">Metric: {exp.metric}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Track completion table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600">
                Track Completion
              </h2>
              <span className="text-[10px] font-mono text-surface-700">
                {availableLessons}/{totalLessons} lessons live
              </span>
            </div>
            <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
              {trackCompletion.map(t => {
                const ac = getAccent(t.accent)
                return (
                  <Link
                    key={t.id}
                    href={`/tracks/${t.id}`}
                    className="group flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-surface-400 group-hover:text-surface-200 transition-colors truncate">
                        {t.title}
                      </p>
                      <div className="mt-1.5">
                        <TrackProgressBar pct={t.pct} accent={t.accent} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-surface-700">
                        {t.available}/{t.total}
                      </span>
                      <span className={`text-[10px] font-mono font-semibold ${ac.text} w-8 text-right`}>
                        {t.pct}%
                      </span>
                    </div>
                  </Link>
                )
              })}
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
                      <span className={`text-[10px] font-mono uppercase shrink-0 ${ac.text}`}>{meta.label}</span>
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

        {/* ── Right: velocity + content health + quick actions ── */}
        <div className="space-y-6">

          {/* Publishing velocity chart */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600">
                Velocity
              </h2>
              {streak > 0 && (
                <span className="text-[10px] font-mono text-amber-400">
                  {streak}d streak
                </span>
              )}
            </div>
            <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
              {velocity.map(v => (
                <div key={v.key} className="px-4 py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] font-mono text-surface-500">{v.label}</p>
                    <span className={`text-[10px] font-mono ${v.count >= 12 ? 'text-green-400' : v.count >= 6 ? 'text-yellow-400' : 'text-surface-600'}`}>
                      {v.count}
                    </span>
                  </div>
                  <VelocityBar count={v.count} max={maxVelocity} />
                </div>
              ))}
              <div className="px-4 py-2.5 flex items-center justify-between">
                <p className="text-[10px] text-surface-600">Target</p>
                <span className="text-[10px] font-mono text-surface-700">≥ 12/mo</span>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between">
                <p className="text-[10px] text-surface-600">Stale sections</p>
                <span className={`text-[10px] font-mono ${staleSections.length > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {staleSections.length > 0
                    ? staleSections.map(s => SECTION_META[s.section as ContentSection]?.label ?? s.section).join(', ')
                    : '✓ none'}
                </span>
              </div>
            </div>
          </div>

          {/* Content health per section */}
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-3">
              Content Health
            </h2>
            <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
              {allSectionData.map(({ section, items }) => {
                const meta   = SECTION_META[section]
                const ac     = ACCENT_CLASSES[meta.accent]
                const latest = items[0]
                const daysOld = latest
                  ? Math.floor((Date.now() - new Date(latest.frontmatter.date).getTime()) / 86_400_000)
                  : null
                const freshColor = daysOld === null
                  ? 'text-surface-700'
                  : daysOld < 7 ? 'text-green-400'
                  : daysOld < 30 ? 'text-yellow-400'
                  : 'text-orange-400'
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
                        <p className={`text-[10px] font-mono mt-0.5 ${freshColor}`}>
                          {daysOld === 0 ? 'today' : daysOld === 1 ? '1d ago' : `${daysOld}d ago`}
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

          {/* Analytics env status */}
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-3">
              Analytics Status
            </h2>
            <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
              {[
                { label: 'Plausible',        env: 'NEXT_PUBLIC_PLAUSIBLE_DOMAIN' },
                { label: 'Google Analytics', env: 'NEXT_PUBLIC_GA_ID' },
                { label: 'Site URL',         env: 'NEXT_PUBLIC_SITE_URL' },
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

          {/* Quick actions — grouped command panel */}
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-3">
              Quick Access
            </h2>
            <div className="space-y-4">
              {/* Content */}
              <div>
                <p className="text-[9px] font-mono uppercase tracking-widest text-surface-700 mb-1.5 px-1">Content</p>
                <div className="space-y-1">
                  <QuickAction href="/tracks"       label="Execution Tracks" />
                  <QuickAction href="/failures"     label="Failure Archive"  badge={`${failures.length}`} />
                  <QuickAction href="/case-studies" label="Case Studies" />
                  <QuickAction href="/playbooks"    label="Playbooks" />
                  <QuickAction href="/logs"         label="Execution Logs"   badge={`${logs.length}`} />
                </div>
              </div>
              {/* Technical */}
              <div>
                <p className="text-[9px] font-mono uppercase tracking-widest text-surface-700 mb-1.5 px-1">Technical</p>
                <div className="space-y-1">
                  <QuickAction href="/docs/deployment-workflow"             label="Deploy Workflow" />
                  <QuickAction href="/docs/execution-checklist-system"      label="Execution Checklists" />
                  <QuickAction href="/docs/execution-artifacts-architecture" label="Evidence Framework" />
                  <QuickAction href="/docs/frontmatter-reference"           label="Frontmatter Reference" />
                </div>
              </div>
              {/* Intelligence */}
              <div>
                <p className="text-[9px] font-mono uppercase tracking-widest text-surface-700 mb-1.5 px-1">Intelligence</p>
                <div className="space-y-1">
                  <QuickAction href="/docs/geo-intelligence-architecture"   label="GEO Intelligence" />
                  <QuickAction href="/docs/failure-intelligence-architecture" label="Failure Intelligence" />
                  <QuickAction href="/docs/platform-maturity-audit-2026-05" label="Maturity Audit" />
                  <QuickAction href="/docs/knowledge-graph-architecture"    label="Knowledge Graph" />
                  <QuickAction href="/tags"                                 label="Topic Tags" />
                </div>
              </div>
              {/* Navigation */}
              <div>
                <p className="text-[9px] font-mono uppercase tracking-widest text-surface-700 mb-1.5 px-1">Navigation</p>
                <div className="space-y-1">
                  <QuickAction href="/start-here"  label="Start Here" />
                  <QuickAction href="/syndicate"   label="Syndication" />
                  <QuickAction href="/sitemap.xml" label="Sitemap" />
                </div>
              </div>
            </div>
          </div>

          {/* Internal planning docs */}
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-3">
              Internal Docs
            </h2>
            <div className="space-y-1">
              {[
                { label: 'Content Quality Standards', href: '/docs/content-quality-standards' },
                { label: 'Platform Focus Lock',       href: '/docs/platform-focus-lock' },
                { label: 'Content Expansion Roadmap', href: '/docs/content-expansion-roadmap' },
                { label: 'Track Audit 2026-05',       href: '/docs/track-audit-2026-05' },
                { label: 'Platform Vision',           href: '/docs/platform-vision-architecture' },
                { label: 'Research Workflow',         href: '/docs/ai-research-workflow' },
              ].map(({ label, href }) => (
                <QuickAction key={href} href={href} label={label} />
              ))}
            </div>
          </div>

          {/* Operator reading queue */}
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-3">
              Reading Queue
            </h2>
            <ReadingQueue />
          </div>

        </div>
      </div>
    </div>
  )
}
