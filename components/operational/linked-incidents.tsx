/**
 * components/operational/linked-incidents.tsx
 * Linked incidents panel — items sharing root cause or operational context.
 *
 * Renders items from `linked_incidents` frontmatter field. These are typically
 * failures or logs that share the same root cause, failure pattern, or deployment
 * window, even if their immediate symptom differs.
 *
 * Usage (in a failure or log page afterContent slot):
 *   <LinkedIncidents section="failures" slug={slug} />
 */
import Link from 'next/link'
import { getLinkedIncidents } from '@/lib/relationship-index'
import type { ContentSection } from '@/lib/content'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Severity / log_type color helpers
// ─────────────────────────────────────────────────────────────

function severityColor(severity?: string): string {
  switch (severity) {
    case 'critical': return 'text-red-400 border-red-500/25 bg-red-500/10'
    case 'high':     return 'text-orange-400 border-orange-500/25 bg-orange-500/10'
    case 'medium':   return 'text-yellow-400 border-yellow-500/25 bg-yellow-500/10'
    case 'low':      return 'text-green-400 border-green-500/25 bg-green-500/10'
    default:         return 'text-white/40 border-white/10 bg-white/[0.04]'
  }
}

function logTypeColor(logType?: string): string {
  switch (logType) {
    case 'deployment': return 'text-indigo-400 border-indigo-500/25 bg-indigo-500/10'
    case 'debug':      return 'text-orange-400 border-orange-500/25 bg-orange-500/10'
    case 'release':    return 'text-emerald-400 border-emerald-500/25 bg-emerald-500/10'
    case 'experiment': return 'text-purple-400 border-purple-500/25 bg-purple-500/10'
    default:           return 'text-blue-400 border-blue-500/25 bg-blue-500/10'
  }
}

function incidentHref(section: string, slug: string): string {
  if (section === 'failures') return `/failures/${slug}`
  if (section === 'logs')     return `/logs/${slug}`
  return `/${section}/${slug}`
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

interface LinkedIncidentsProps {
  section: ContentSection
  slug: string
  className?: string
}

export function LinkedIncidents({ section, slug, className }: LinkedIncidentsProps) {
  const incidents = getLinkedIncidents(section, slug)
  if (incidents.length === 0) return null

  return (
    <aside className={cn('not-prose', className)}>
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="h-px w-3 bg-white/[0.06]" />
        <span className="text-[11px] font-mono uppercase tracking-widest text-white/30">
          Linked Incidents
        </span>
        <div className="h-px flex-1 bg-white/[0.06]" />
      </div>

      {/* Incident list */}
      <ul className="flex flex-col gap-2">
        {incidents.map((incident) => {
          const fm       = incident.frontmatter
          const isLog    = incident.section === 'logs'
          const chipCls  = isLog
            ? logTypeColor(fm.log_type)
            : severityColor(fm.severity)
          const chipText = isLog
            ? (fm.log_type ?? 'log')
            : (fm.severity ?? 'failure')
          const href     = incidentHref(incident.section, incident.slug)

          return (
            <li key={incident.slug}>
              <Link
                href={href}
                className={cn(
                  'group flex items-start gap-3 rounded-lg border border-white/[0.06]',
                  'bg-white/[0.03] px-4 py-3 transition-colors',
                  'hover:border-white/[0.12] hover:bg-white/[0.06]',
                )}
              >
                {/* Link icon */}
                <svg
                  className="mt-[3px] h-3.5 w-3.5 shrink-0 text-white/25 group-hover:text-white/50"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>

                <div className="min-w-0 flex-1">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-white/80 group-hover:text-white truncate">
                      {fm.title}
                    </p>
                    <span
                      className={cn(
                        'shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-mono capitalize',
                        chipCls,
                      )}
                    >
                      {chipText}
                    </span>
                  </div>

                  {/* Description */}
                  {fm.description && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-white/40">
                      {fm.description}
                    </p>
                  )}

                  {/* Date + section tag */}
                  <p className="mt-1 text-[10px] font-mono text-white/25">
                    {fm.date}
                    <span className="mx-1.5 opacity-50">·</span>
                    {incident.section}
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
