/**
 * ExecutionEvidence — trust signal for content built from real production work.
 * Shows that the lesson/pattern/system was tested in a real environment.
 *
 * Usage:
 *   <ExecutionEvidence
 *     context="Tested during the production build of ai-execution-lab on Vercel"
 *     commitRef="b70733c"
 *     date="2026-05-17"
 *   />
 */

export function ExecutionEvidence({
  context,
  commitRef,
  date,
  repo,
}: {
  /** What this was built/tested on — one sentence */
  context: string
  /** Short git commit hash reference */
  commitRef?: string
  /** ISO date string */
  date?: string
  /** GitHub repo URL for the commit reference */
  repo?: string
}) {
  return (
    <div className="my-6 flex items-start gap-3 rounded-lg border border-brand-500/15 bg-brand-500/[0.04] px-4 py-3.5">
      {/* Icon */}
      <span className="text-brand-400 text-lg shrink-0 mt-0.5">⬡</span>

      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-400 mb-1.5">
          Built from real execution
        </p>
        <p className="text-sm text-surface-400 leading-relaxed">{context}</p>

        {(commitRef || date) && (
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {date && (
              <span className="text-[10px] font-mono text-surface-600">{date}</span>
            )}
            {commitRef && (
              repo ? (
                <a
                  href={`${repo}/commit/${commitRef}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono text-surface-600 hover:text-brand-400 transition-colors"
                >
                  commit {commitRef}
                </a>
              ) : (
                <span className="text-[10px] font-mono text-surface-600">
                  commit {commitRef}
                </span>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
