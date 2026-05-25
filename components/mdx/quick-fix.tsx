/**
 * components/mdx/quick-fix.tsx
 * Machine-readable quick fix block for failure pages.
 *
 * DESIGN GOALS — GEO / AI crawler extraction:
 *   - Renders as semantic H2 + <dl> HTML, not hidden JSX props
 *   - AI search crawlers (Perplexity, ChatGPT, Gemini) can extract
 *     the fix from structured <dt>/<dd> pairs without JS execution
 *   - Maps to HowTo schema steps when combined with page-level HowTo JSON-LD
 *
 * Usage in failure MDX:
 *   <QuickFix
 *     symptom="Build fails: TypeError — fs is not a function"
 *     rootCause="Node.js 'fs' module imported in a client component"
 *     fix="Move the import to a Server Component or API route; add 'use server'"
 *     time="15–30 min"
 *     confidence={85}
 *     steps={[
 *       "Identify the component importing fs (check build error stack trace)",
 *       "Convert the component to async and add 'use server' at top, OR",
 *       "Move the fs logic to an API route handler in /app/api/",
 *       "Run next build to confirm resolution",
 *     ]}
 *   />
 */

import { cn } from '@/lib/utils'

interface QuickFixProps {
  /** The observable error or symptom */
  symptom: string
  /** Root cause — one sentence */
  rootCause: string
  /** The verified fix — one sentence or command */
  fix: string
  /** Estimated time to resolve (e.g. "15–30 min") */
  time?: string
  /** Confidence score (0–100) from failure-memory.ts */
  confidence?: number
  /** Optional ordered resolution steps */
  steps?: string[]
  className?: string
}

function confidenceLabel(score: number): { label: string; cls: string } {
  if (score >= 80) return { label: 'High confidence',     cls: 'text-green-400  bg-green-500/10  border-green-500/25'  }
  if (score >= 60) return { label: 'Moderate confidence', cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25' }
  return              { label: 'Low confidence',          cls: 'text-red-400    bg-red-500/10    border-red-500/25'    }
}

export function QuickFix({
  symptom,
  rootCause,
  fix,
  time,
  confidence,
  steps,
  className,
}: QuickFixProps) {
  const conf = confidence !== undefined ? confidenceLabel(confidence) : null

  return (
    <section
      className={cn(
        'not-prose my-8 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5',
        className,
      )}
      aria-label="Quick Fix"
    >
      {/* ── Heading — rendered as plain H2 for AI crawler extraction */}
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-emerald-400">
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Quick Fix
        {conf && (
          <span className={cn('ml-auto rounded border px-2 py-0.5 text-[10px] font-mono', conf.cls)}>
            {conf.label}{confidence !== undefined ? ` · ${confidence}/100` : ''}
          </span>
        )}
      </h2>

      {/* ── Semantic definition list — machine-readable by AI crawlers */}
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="mb-0.5 text-[10px] font-mono uppercase tracking-widest text-white/30">Symptom</dt>
          <dd className="text-white/70">{symptom}</dd>
        </div>

        <div>
          <dt className="mb-0.5 text-[10px] font-mono uppercase tracking-widest text-white/30">Root Cause</dt>
          <dd className="text-white/70">{rootCause}</dd>
        </div>

        <div>
          <dt className="mb-0.5 text-[10px] font-mono uppercase tracking-widest text-white/30">Fix</dt>
          <dd className="font-medium text-emerald-300">{fix}</dd>
        </div>

        {time && (
          <div>
            <dt className="mb-0.5 text-[10px] font-mono uppercase tracking-widest text-white/30">Time to Resolve</dt>
            <dd className="font-mono text-white/60">{time}</dd>
          </div>
        )}
      </dl>

      {/* ── Ordered resolution steps (also machine-readable as plain <ol>) */}
      {steps && steps.length > 0 && (
        <div className="mt-5 border-t border-white/[0.06] pt-4">
          <p className="mb-2 text-[10px] font-mono uppercase tracking-widest text-white/30">
            Resolution Steps
          </p>
          <ol className="space-y-1.5">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-white/65">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-mono font-bold text-emerald-400">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
