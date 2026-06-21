import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { TRACKS, getTrack, TRACK_ACCENTS, getTrackStats } from '@/lib/tracks'
import { TrackRoadmap } from '@/components/tracks/track-roadmap'
import { cn } from '@/lib/utils'

const SITE_URL  = 'https://lab.asquaresolution.com' // pinned to Lab host (see lib/metadata.ts)
const SITE_NAME = 'AI Execution Lab'
const TWITTER   = '@asquaresolution'

// Contextual "next recommended track" links (only genuinely-relevant adjacencies).
const RECOMMENDED_NEXT: Record<string, string[]> = {
  'ai-for-non-developers': ['ai-for-students'],
  'ai-for-students': ['ai-freelancing', 'ai-business-zero-budget'],
}

interface Props { params: Promise<{ track: string }> }

export function generateStaticParams() {
  return TRACKS.map((t) => ({ track: t.id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { track: trackId } = await params
  const track = getTrack(trackId)
  if (!track) return {}
  const url = `${SITE_URL}/tracks/${trackId}`
  return {
    title:       track.title,
    description: track.description,
    openGraph: {
      type:        'website',
      title:       `${track.title} | ${SITE_NAME}`,
      description: track.tagline,
      url,
      siteName:    SITE_NAME,
    },
    twitter: {
      card:        'summary',
      title:       `${track.title} | ${SITE_NAME}`,
      description: track.tagline,
      creator:     TWITTER,
    },
    alternates: { canonical: url },
  }
}

const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Beginner', intermediate: 'Intermediate',
  advanced: 'Advanced', operator: 'Operator Level',
}

export default async function TrackPage({ params }: Props) {
  const { track: trackId } = await params
  const track = getTrack(trackId)
  if (!track) notFound()

  const ac    = TRACK_ACCENTS[track.accent]
  const stats = getTrackStats(track)

  // Find the first available lesson for the CTA
  const firstLesson = (() => {
    for (const mod of track.modules) {
      const lesson = mod.lessons.find((l) => l.status === 'available')
      if (lesson) return { mod, lesson }
    }
    return null
  })()

  return (
    <div className="px-5 sm:px-6 lg:px-8 py-8 max-w-5xl">

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-surface-600">
        <Link href="/" className="hover:text-surface-400 transition-colors">Home</Link>
        <span>/</span>
        <Link href="/tracks" className="hover:text-surface-400 transition-colors">Tracks</Link>
        <span>/</span>
        <span className="text-surface-500 truncate max-w-[28ch]">{track.title}</span>
      </nav>

      {/* Hero */}
      <header className="mb-12 pb-10 border-b border-white/[0.06]">

        {/* Badge row */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className={cn(
            'inline-flex items-center text-[10px] font-mono font-bold uppercase tracking-widest rounded px-2 py-1 border',
            ac.text, ac.bg, ac.border
          )}>
            Track
          </span>
          <span className="text-[10px] font-mono text-surface-600 bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1">
            {LEVEL_LABEL[track.level]}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-surface-50 text-balance leading-[1.2] mb-3">
          {track.title}
        </h1>
        <p className="text-base text-surface-400 leading-relaxed max-w-2xl mb-6">
          {track.description}
        </p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-surface-600 font-mono mb-6">
          <span>{stats.moduleCount} modules</span>
          <span>·</span>
          <span>{stats.totalLessons} lessons</span>
          <span>·</span>
          <span>~{track.estimatedHours}h total</span>
          <span>·</span>
          <span>{stats.availableLessons} available now</span>
        </div>

        {/* CTA */}
        {firstLesson && (
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/tracks/${track.id}/${firstLesson.mod.id}/${firstLesson.lesson.id}`}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors shadow-sm',
                track.accent === 'amber'  && 'bg-amber-500 hover:bg-amber-600',
                track.accent === 'brand'  && 'bg-brand-500 hover:bg-brand-600',
                track.accent === 'cyan'   && 'bg-cyan-500 hover:bg-cyan-600',
                track.accent === 'purple' && 'bg-purple-500 hover:bg-purple-600',
                track.accent === 'green'  && 'bg-green-600 hover:bg-green-700',
              )}
            >
              Start Track →
            </Link>
            <Link
              href="/tracks"
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.10] px-4 py-2.5 text-sm font-medium text-surface-300 hover:text-surface-100 hover:border-white/[0.18] transition-colors"
            >
              All Tracks
            </Link>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-10">

        {/* ── Roadmap ─────────────────────────────── */}
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-4">
            Execution Roadmap
          </h2>
          <TrackRoadmap track={track} />
        </div>

        {/* ── Sidebar meta ─────────────────────────── */}
        <aside className="space-y-6">

          {/* What you'll build */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5">
            <p className={cn('text-[10px] font-mono font-bold uppercase tracking-widest mb-3', ac.text)}>
              What you&apos;ll build
            </p>
            <ul className="space-y-2">
              {track.outcomes.map((o, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-surface-400 leading-snug">
                  <span className={cn('shrink-0 mt-0.5 text-[10px]', ac.text)}>◆</span>
                  {o}
                </li>
              ))}
            </ul>
          </div>

          {/* Prerequisites */}
          {track.prerequisites.length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5">
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-surface-600 mb-3">
                Prerequisites
              </p>
              <ul className="space-y-1.5">
                {track.prerequisites.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-surface-500">
                    <span className="text-surface-700 shrink-0">—</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tools */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5">
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-surface-600 mb-3">
              Tools used
            </p>
            <div className="flex flex-wrap gap-1.5">
              {track.tools.map((tool) => (
                <span
                  key={tool}
                  className="text-xs font-mono text-surface-600 bg-white/[0.03] border border-white/[0.06] rounded px-2 py-0.5"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>

        </aside>
      </div>

      {/* ── Next recommended track ───────────────────────────── */}
      {(() => {
        const recs = (RECOMMENDED_NEXT[track.id] ?? [])
          .map((id) => getTrack(id))
          .filter((t): t is NonNullable<typeof t> => !!t)
        if (recs.length === 0) return null
        return (
          <div className="mt-12 pt-8 border-t border-white/[0.06]">
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-surface-600 mb-4">
              Recommended next track
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recs.map((t) => (
                <Link
                  key={t.id}
                  href={`/tracks/${t.id}`}
                  className="group flex flex-col gap-1 rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-3.5 transition hover:border-white/[0.12]"
                >
                  <span className="text-sm font-medium text-surface-200 group-hover:text-surface-50">{t.title} →</span>
                  <span className="text-xs text-surface-500 leading-snug">{t.tagline}</span>
                </Link>
              ))}
            </div>
          </div>
        )
      })()}

    </div>
  )
}
