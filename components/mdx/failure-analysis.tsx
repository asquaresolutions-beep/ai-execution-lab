/**
 * FailureAnalysis — side-by-side before/after showing a broken pattern
 * and its production-correct replacement, with a lesson extracted.
 *
 * Usage:
 *   <FailureAnalysis
 *     title="Vague task prompt"
 *     before="Fix the form"
 *     after="The contact form at /contact/page.tsx..."
 *     lesson="Specific scope + file context = targeted fix."
 *   />
 */
export function FailureAnalysis({
  title,
  before,
  after,
  lesson,
}: {
  title: string
  before: string
  after: string
  lesson: string
}) {
  return (
    <div className="my-8 rounded-xl border border-red-500/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 bg-red-500/5 border-b border-red-500/15">
        <span className="text-red-400 text-sm">✕</span>
        <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-red-400">
          Failure Pattern — {title}
        </p>
      </div>

      {/* Before / After grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.06]">
        {/* Before */}
        <div className="px-5 py-4 bg-red-500/[0.03]">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-red-500/70 mb-3">
            ✕ Before (broken pattern)
          </p>
          <pre className="text-sm text-surface-400 whitespace-pre-wrap font-mono leading-relaxed break-words">
            {before}
          </pre>
        </div>

        {/* After */}
        <div className="px-5 py-4 bg-green-500/[0.03]">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-green-500/70 mb-3">
            ✓ After (production pattern)
          </p>
          <pre className="text-sm text-surface-300 whitespace-pre-wrap font-mono leading-relaxed break-words">
            {after}
          </pre>
        </div>
      </div>

      {/* Lesson extracted */}
      <div className="px-5 py-3 border-t border-white/[0.06] bg-surface-900/30">
        <p className="text-xs text-surface-500 leading-relaxed">
          <span className="text-surface-400 font-semibold">Lesson: </span>
          {lesson}
        </p>
      </div>
    </div>
  )
}
