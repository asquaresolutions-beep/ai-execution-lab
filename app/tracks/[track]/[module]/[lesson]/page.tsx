import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import {
  getAllLessonPaths,
  getTrack,
  getModule,
  getLesson,
  getLessonNeighbors,
  getLessonPosition,
  TRACK_ACCENTS,
} from '@/lib/tracks'
import { getLessonContent } from '@/lib/lesson-content'
import { LessonSidebar }  from '@/components/tracks/lesson-sidebar'
import { LessonNav }      from '@/components/tracks/lesson-nav'
import { CompleteButton } from '@/components/tracks/complete-button'
import { BookmarkButton } from '@/components/platform/bookmark-button'
import { RelatedContent } from '@/components/tracks/related-content'
import { NotifyForm } from '@/components/tracks/notify-form'
import { ContentRenderer } from '@/components/content-renderer'
import { ReadingProgress } from '@/components/layout/reading-progress'
import { cn } from '@/lib/utils'

const SITE_URL  = 'https://lab.asquaresolution.com' // pinned to Lab host (see lib/metadata.ts)
const SITE_NAME = 'AI Execution Lab'
const TWITTER   = '@asquaresolution'

interface Props {
  params: Promise<{ track: string; module: string; lesson: string }>
}

export function generateStaticParams() {
  return getAllLessonPaths()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { track: trackId, module: moduleId, lesson: lessonId } = await params
  const track  = getTrack(trackId)
  const lesson = getLesson(trackId, moduleId, lessonId)
  if (!track || !lesson) return {}

  const url        = `${SITE_URL}/tracks/${trackId}/${moduleId}/${lessonId}`
  const title      = lesson.title
  const ogTitle    = `${lesson.title} — ${track.title}`
  const ogImageUrl = `${SITE_URL}/api/og?${new URLSearchParams({
    title:   lesson.title,
    section: track.title,
    description: lesson.description ?? '',
  }).toString()}`

  return {
    title:       ogTitle,
    description: lesson.description,
    openGraph: {
      type:        'article',
      title:       ogTitle,
      description: lesson.description,
      url,
      siteName:    SITE_NAME,
      images:      [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card:        'summary_large_image',
      title:       ogTitle,
      description: lesson.description,
      creator:     TWITTER,
      images:      [ogImageUrl],
    },
    alternates: { canonical: url },
  }
}

const LESSON_TYPE_LABEL: Record<string, string> = {
  lesson:     'Lesson',
  playbook:   'Playbook',
  lab:        'Lab',
  checkpoint: 'Checkpoint',
  project:    'Project',
}

const ACCENT_BTN: Record<string, string> = {
  amber:  'bg-amber-500',
  brand:  'bg-brand-500',
  cyan:   'bg-cyan-500',
  purple: 'bg-purple-500',
  green:  'bg-green-600',
}

export default async function LessonPage({ params }: Props) {
  const { track: trackId, module: moduleId, lesson: lessonId } = await params

  const track  = getTrack(trackId)
  const mod    = getModule(trackId, moduleId)
  const lesson = getLesson(trackId, moduleId, lessonId)

  if (!track || !mod || !lesson) notFound()

  const ac       = TRACK_ACCENTS[track.accent]
  const content  = getLessonContent(trackId, moduleId, lessonId)
  const position = getLessonPosition(trackId, moduleId, lessonId)
  const { prev, next } = getLessonNeighbors(trackId, moduleId, lessonId)

  return (
    <>
      <ReadingProgress />

      <div className="px-5 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8 max-w-[72rem]">

          {/* ── Main content ──────────────────────── */}
          <div className="flex-1 min-w-0 max-w-3xl">

            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-surface-600 flex-wrap">
              <Link href="/tracks" className="hover:text-surface-400 transition-colors">Tracks</Link>
              <span>/</span>
              <Link href={`/tracks/${track.id}`} className="hover:text-surface-400 transition-colors truncate max-w-[18ch]">
                {track.title}
              </Link>
              <span>/</span>
              <Link href={`/tracks/${track.id}#${mod.id}`} className="hover:text-surface-400 transition-colors truncate max-w-[18ch]">
                {mod.title}
              </Link>
              <span>/</span>
              <span className="text-surface-500 truncate max-w-[20ch]">{lesson.title}</span>
            </nav>

            {/* Lesson header */}
            <header className="mb-8 pb-7 border-b border-white/[0.06]">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className={cn(
                  'inline-flex items-center text-[10px] font-mono font-bold uppercase tracking-widest rounded px-2 py-1 border',
                  ac.text, ac.bg, ac.border
                )}>
                  {LESSON_TYPE_LABEL[lesson.type]}
                </span>
                <span className="text-[10px] font-mono text-surface-700">
                  {lesson.duration}
                </span>
                {position && (
                  <span className="text-[10px] font-mono text-surface-700">
                    {position.lessonNumber} of {position.totalLessons}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-surface-50 text-balance leading-[1.2] mb-3">
                {lesson.title}
              </h1>

              <p className="text-base text-surface-400 leading-relaxed max-w-2xl">
                {lesson.description}
              </p>
            </header>

            {/* Content or coming-soon */}
            {content ? (
              <ContentRenderer source={content} />
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-8 py-12 text-center">
                <div className={cn('text-3xl mb-4', ac.text)}>⬡</div>
                <h2 className="text-lg font-semibold text-surface-200 mb-2">Coming Soon</h2>
                <p className="text-sm text-surface-500 max-w-sm mx-auto leading-relaxed">
                  This lesson is in the roadmap and will be published as the track is built out.
                  The structure above shows exactly what&apos;s covered.
                </p>
                <NotifyForm lessonId={lessonId} />

                <Link
                  href={`/tracks/${track.id}`}
                  className="inline-flex items-center gap-2 mt-6 text-sm text-surface-500 hover:text-surface-300 transition-colors"
                >
                  ← Back to track overview
                </Link>
              </div>
            )}

            {/* Complete + bookmark */}
            {content && (
              <div className="mt-10 pt-8 border-t border-white/[0.06] flex items-center justify-between flex-wrap gap-4">
                <CompleteButton
                  trackId={trackId}
                  moduleId={moduleId}
                  lessonId={lessonId}
                  accentClass={ACCENT_BTN[track.accent] ?? 'bg-brand-500'}
                />
                <div className="flex items-center gap-3">
                  <BookmarkButton
                    href={`/tracks/${trackId}/${moduleId}/${lessonId}`}
                    title={lesson.title}
                    type="lesson"
                    section={track.title}
                  />
                  <span className="text-xs text-surface-700 font-mono">
                    Progress saved locally
                  </span>
                </div>
              </div>
            )}

            {/* Related content */}
            {content && (
              <RelatedContent lessonId={lessonId} trackId={trackId} />
            )}

            {/* Prev / Next lesson */}
            <LessonNav trackId={trackId} prev={prev} next={next} />

          </div>

          {/* ── Track sidebar ─────────────────────── */}
          <LessonSidebar
            track={track}
            activeModuleId={moduleId}
            activeLessonId={lessonId}
          />

        </div>
      </div>
    </>
  )
}
