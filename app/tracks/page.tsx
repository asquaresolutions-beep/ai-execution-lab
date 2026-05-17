import type { Metadata } from 'next'
import { TRACKS, TRACK_ACCENTS, getTrackStats } from '@/lib/tracks'
import { TrackCard } from '@/components/tracks/track-card'

export const metadata: Metadata = {
  title: 'Execution Tracks',
  description: 'Structured operational learning pathways — from zero to production-grade AI systems.',
}

const LEVEL_ORDER: Record<string, number> = {
  beginner: 0, intermediate: 1, advanced: 2, operator: 3,
}

export default function TracksPage() {
  const totalLessons = TRACKS.reduce((n, t) => n + getTrackStats(t).totalLessons, 0)
  const totalHours   = TRACKS.reduce((n, t) => n + t.estimatedHours, 0)

  return (
    <div className="px-5 sm:px-6 lg:px-8 py-8 max-w-5xl">

      {/* Header */}
      <div className="mb-10 pb-8 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold text-brand-500/80 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
            Execution Tracks
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-surface-50 text-balance leading-[1.2] mb-3">
          Operational Learning Pathways
        </h1>
        <p className="text-base text-surface-400 max-w-2xl leading-relaxed">
          Not tutorials. Not courses. Structured execution pathways built around
          real systems, real workflows, and real implementation — the same way
          we build and operate AI infrastructure at A Square Solutions.
        </p>

        {/* Stats */}
        <div className="mt-6 flex flex-wrap gap-6">
          {[
            { v: TRACKS.length,  l: 'Tracks'  },
            { v: totalLessons,   l: 'Lessons'  },
            { v: `${totalHours}h`, l: 'Content' },
          ].map(({ v, l }) => (
            <div key={l}>
              <p className="text-xl font-bold font-mono text-surface-100">{v}</p>
              <p className="text-[11px] text-surface-600 uppercase tracking-widest font-mono">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tracks grid */}
      <div className="mb-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-4">
          Available Tracks
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TRACKS.map((track) => (
            <TrackCard key={track.id} track={track} />
          ))}
        </div>
      </div>

      {/* Philosophy note */}
      <div className="mt-10 rounded-xl border border-white/[0.05] bg-white/[0.01] px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-700 mb-2">
          How execution tracks work
        </p>
        <p className="text-sm text-surface-500 leading-relaxed">
          Each track is structured as a sequence of modules containing lessons, playbooks, labs, and projects.
          Progress is tracked locally — no account required. Available lessons are live and fully executable.
          Coming-soon lessons show the complete roadmap so you know exactly what&apos;s being built.
        </p>
      </div>

    </div>
  )
}
