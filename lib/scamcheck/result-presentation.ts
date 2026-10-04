// ─────────────────────────────────────────────────────────────────
// lib/scamcheck/result-presentation.ts
// Pure presentation helpers for ScamCheck result cards (quick check +
// screenshot analyzer): verdict styles, verdict labels, category labels, the
// trusted-entity note and the share summary. No React, no I/O — testable in Node.
// ─────────────────────────────────────────────────────────────────

export type Verdict = 'likely_scam' | 'suspicious' | 'needs_review' | 'unclear' | 'likely_safe'

export const VERDICT_STYLE: Record<Verdict, string> = {
  likely_scam: 'bg-red-500/15 text-red-300 border-red-500/40',
  suspicious: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  likely_safe: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  unclear: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40',
  needs_review: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
}

export const TRUSTED_NOTE = 'Matches a verified/official entity — likely legitimate (still verify in the official app).'

export function verdictStyle(verdict: string): string {
  return VERDICT_STYLE[verdict as Verdict] || VERDICT_STYLE.unclear
}

export function verdictLabel(verdict: string): string {
  return verdict.replace(/_/g, ' ')
}

export function categoryLabel(category: string): string {
  return category.replace(/_/g, ' ')
}

export function buildShareSummary(result: { verdict: string; riskScore: number; category: string }, site: string): string {
  return `ScamCheck result: ${verdictLabel(result.verdict)} (risk ${result.riskScore}/100) — ${categoryLabel(result.category)}. Checked free at ${site}/scamcheck`
}
