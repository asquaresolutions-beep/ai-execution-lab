import Link from 'next/link'
import type { ContentItem } from '@/lib/content'
import { SECTION_META, ACCENT_CLASSES, formatDate, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ContentRenderer } from './content-renderer'

interface ContentPageProps {
  item: ContentItem
}

export async function ContentPage({ item }: ContentPageProps) {
  const sectionMeta = SECTION_META[item.section]
  const ac          = ACCENT_CLASSES[sectionMeta.accent]
  const fm          = item.frontmatter

  return (
    <div className="px-6 lg:px-8 py-8">
      <div className="max-w-3xl">

        {/* ── Breadcrumb ─────────────────────────────────────── */}
        <nav className="mb-8 flex items-center gap-1.5 text-xs text-surface-600">
          <Link href="/" className="hover:text-surface-400 transition-colors">Home</Link>
          <span>/</span>
          <Link href={sectionMeta.href} className="hover:text-surface-400 transition-colors">
            {sectionMeta.title}
          </Link>
          <span>/</span>
          <span className="text-surface-500 truncate max-w-[24ch]">{fm.title}</span>
        </nav>

        {/* ── Header ─────────────────────────────────────────── */}
        <header className="mb-10 pb-8 border-b border-white/[0.06]">

          {/* Section tag + badges */}
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <Link
              href={sectionMeta.href}
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-mono font-semibold uppercase tracking-widest rounded px-2 py-1 border transition-colors hover:opacity-80',
                ac.text, ac.bg, ac.border
              )}
            >
              {sectionMeta.label}
            </Link>

            {fm.status === 'draft' && <Badge variant="yellow">Draft</Badge>}

            {fm.difficulty && (
              <Badge variant={
                fm.difficulty === 'advanced'     ? 'red' :
                fm.difficulty === 'intermediate' ? 'yellow' : 'green'
              }>
                {fm.difficulty}
              </Badge>
            )}

            {fm.result && (
              <Badge variant={
                fm.result === 'confirmed'    ? 'green' :
                fm.result === 'refuted'      ? 'red' :
                fm.result === 'ongoing'      ? 'blue' : 'yellow'
              }>
                {fm.result}
              </Badge>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-surface-50 text-balance leading-[1.2]">
            {fm.title}
          </h1>

          {fm.description && (
            <p className="mt-3 text-base text-surface-400 leading-relaxed">
              {fm.description}
            </p>
          )}

          {/* Meta row */}
          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-surface-600 font-mono">
            <time dateTime={fm.date}>{formatDate(fm.date)}</time>
            {fm.updated && fm.updated !== fm.date && (
              <span>· updated {formatDate(fm.updated)}</span>
            )}
            <span>· {item.readingTime}</span>
            {fm.stack && fm.stack.length > 0 && (
              <span>· {fm.stack.join(' · ')}</span>
            )}
            {fm.estimated_time && (
              <span>· ~{fm.estimated_time}</span>
            )}
          </div>

          {/* Lab hypothesis */}
          {fm.hypothesis && (
            <div className="mt-5 rounded-lg border border-brand-500/25 bg-brand-500/[0.06] px-4 py-3">
              <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest mb-1.5">
                Hypothesis
              </p>
              <p className="text-sm text-surface-300 leading-relaxed">{fm.hypothesis}</p>
            </div>
          )}

          {/* Case study impact */}
          {fm.impact && (
            <div className="mt-5 rounded-lg border border-green-500/25 bg-green-500/[0.06] px-4 py-3">
              <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-1.5">
                Impact
              </p>
              <p className="text-sm text-surface-300 leading-relaxed">{fm.impact}</p>
            </div>
          )}

          {/* Playbook goal */}
          {fm.goal && (
            <div className="mt-5 rounded-lg border border-blue-500/25 bg-blue-500/[0.06] px-4 py-3">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1.5">
                Goal
              </p>
              <p className="text-sm text-surface-300 leading-relaxed">{fm.goal}</p>
            </div>
          )}

          {/* Playbook prerequisites */}
          {fm.prerequisites && fm.prerequisites.length > 0 && (
            <div className="mt-3 rounded-lg border border-surface-700/50 bg-surface-900/30 px-4 py-3">
              <p className="text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-2">
                Prerequisites
              </p>
              <ul className="space-y-1">
                {fm.prerequisites.map((p, i) => (
                  <li key={i} className="text-sm text-surface-400 flex items-start gap-2">
                    <span className="text-surface-600 shrink-0 mt-0.5">—</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tags */}
          {fm.tags && fm.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {fm.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs text-surface-600 bg-white/[0.03] rounded-full px-2.5 py-0.5 border border-white/[0.06]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* ── MDX content ───────────────────────────────────── */}
        <ContentRenderer source={item.content} />

        {/* ── Footer nav ────────────────────────────────────── */}
        <div className="mt-14 pt-8 border-t border-white/[0.06]">
          <Link
            href={sectionMeta.href}
            className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-200 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to {sectionMeta.title}
          </Link>
        </div>

      </div>
    </div>
  )
}
