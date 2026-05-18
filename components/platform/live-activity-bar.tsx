'use client'

/**
 * components/platform/live-activity-bar.tsx
 * Compact platform status strip — shows the platform is actively operating.
 * Server component data, thin client wrapper for hover states only.
 */

import Link from 'next/link'
import type { PlatformStatus } from '@/lib/activity'

// ─────────────────────────────────────────────────────────────
// Signal type badge styles
// ─────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<string, string> = {
  lesson:     'text-brand-400',
  failure:    'text-red-400',
  log:        'text-surface-500',
  playbook:   'text-cyan-400',
  doc:        'text-surface-500',
  'case-study': 'text-amber-400',
  lab:        'text-purple-400',
  system:     'text-green-400',
}

const TYPE_LABEL: Record<string, string> = {
  lesson:     'lesson',
  failure:    'failure',
  log:        'log',
  playbook:   'playbook',
  doc:        'doc',
  'case-study': 'case study',
  lab:        'lab',
  system:     'system',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─────────────────────────────────────────────────────────────
// Status dot
// ─────────────────────────────────────────────────────────────

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
        active ? 'bg-green-500 animate-pulse' : 'bg-surface-700'
      }`}
    />
  )
}

// ─────────────────────────────────────────────────────────────
// Velocity indicator
// ─────────────────────────────────────────────────────────────

function VelocityBadge({ count, label }: { count: number; label: string }) {
  const color =
    count >= 10 ? 'text-green-400 bg-green-500/10 border-green-500/20' :
    count >= 5  ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' :
                  'text-surface-600 bg-surface-700/10 border-surface-700/20'
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono rounded px-1.5 py-0.5 border ${color}`}>
      {count} {label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

interface Props {
  status: PlatformStatus
}

export function LiveActivityBar({ status }: Props) {
  const { latestLesson, latestFailure, latestLog, recentSignals, itemsThisMonth, itemsThisWeek } = status

  const isProd = process.env.NODE_ENV === 'production'

  return (
    <div className="mb-8 rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">

      {/* Top bar — system status line */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04]">
        <StatusDot active={isProd} />
        <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-surface-600">
          Platform Status
        </span>
        <span className="flex-1" />
        <VelocityBadge count={itemsThisWeek}  label="this week" />
        <VelocityBadge count={itemsThisMonth} label="this month" />
      </div>

      {/* Signal grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.04]">

        {/* Latest lesson */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-mono text-surface-700 mb-1 uppercase tracking-wider">Latest lesson</p>
          {latestLesson ? (
            <Link
              href={latestLesson.href}
              className="group block"
            >
              <p className="text-xs text-surface-300 group-hover:text-brand-400 transition-colors leading-snug line-clamp-2">
                {latestLesson.title}
              </p>
              <p className="text-[10px] font-mono text-surface-700 mt-1 truncate">
                {latestLesson.trackTitle} · {formatDate(latestLesson.date)}
              </p>
            </Link>
          ) : (
            <p className="text-xs text-surface-700">No lessons yet</p>
          )}
        </div>

        {/* Latest failure */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-mono text-surface-700 mb-1 uppercase tracking-wider">Latest failure</p>
          {latestFailure ? (
            <Link
              href={`/failures/${latestFailure.slug}`}
              className="group block"
            >
              <p className="text-xs text-surface-300 group-hover:text-red-400 transition-colors leading-snug line-clamp-2">
                {latestFailure.frontmatter.title}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] font-mono ${
                  latestFailure.frontmatter.failure_status === 'resolved'
                    ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {latestFailure.frontmatter.failure_status ?? 'unknown'}
                </span>
                <span className="text-[10px] font-mono text-surface-700">
                  {formatDate(latestFailure.frontmatter.date)}
                </span>
              </div>
            </Link>
          ) : (
            <p className="text-xs text-surface-700">No failures documented</p>
          )}
        </div>

        {/* Latest log */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-mono text-surface-700 mb-1 uppercase tracking-wider">Latest log</p>
          {latestLog ? (
            <Link
              href={`/logs/${latestLog.slug}`}
              className="group block"
            >
              <p className="text-xs text-surface-300 group-hover:text-surface-100 transition-colors leading-snug line-clamp-2">
                {latestLog.frontmatter.title}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {latestLog.frontmatter.outcome && (
                  <p className="text-[10px] text-surface-700 truncate hidden sm:block">
                    {latestLog.frontmatter.outcome}
                  </p>
                )}
                <span className="text-[10px] font-mono text-surface-700 shrink-0">
                  {formatDate(latestLog.frontmatter.date)}
                </span>
              </div>
            </Link>
          ) : (
            <p className="text-xs text-surface-700">No logs yet</p>
          )}
        </div>
      </div>

      {/* Recent signal stream */}
      {recentSignals.length > 0 && (
        <div className="border-t border-white/[0.04] px-4 py-2 flex items-center gap-3 overflow-x-auto scrollbar-hide">
          <span className="text-[10px] font-mono text-surface-700 shrink-0">Recent:</span>
          {recentSignals.slice(0, 7).map((sig, i) => (
            <Link
              key={i}
              href={sig.href}
              className="flex items-center gap-1.5 shrink-0 group"
            >
              <span className={`text-[10px] font-mono ${TYPE_STYLES[sig.type] ?? 'text-surface-600'}`}>
                {TYPE_LABEL[sig.type] ?? sig.type}
              </span>
              <span className="text-[10px] text-surface-600 group-hover:text-surface-400 transition-colors max-w-[140px] truncate">
                {sig.title}
              </span>
              <span className="text-[10px] font-mono text-surface-800">
                {formatDate(sig.date)}
              </span>
              {i < recentSignals.slice(0, 7).length - 1 && (
                <span className="text-surface-800 text-[10px] ml-1">·</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
