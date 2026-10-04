// ─────────────────────────────────────────────────────────────────
// lib/scamcheck/result-presentation.ts
// Pure presentation helpers for ScamCheck result cards (quick check +
// screenshot analyzer): verdict styles, verdict labels, category labels, the
// trusted-entity note and the share summary. No React, no I/O — testable in Node.
//
// Fail safe: only the exact lowercase verdicts below are recognised; anything
// else (missing, malformed, other casing) is presented as `unclear` — never as
// safe. Share text never includes the user's input and never calls a non-safe
// verdict safe, verified or legitimate.
// ─────────────────────────────────────────────────────────────────

export type Verdict = 'likely_scam' | 'suspicious' | 'needs_review' | 'unclear' | 'likely_safe'

export const VERDICT_STYLE: Record<Verdict, string> = {
  likely_scam: 'bg-red-500/15 text-red-300 border-red-500/40',
  suspicious: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  likely_safe: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  unclear: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40',
  needs_review: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
}

const VERDICT_LABEL: Record<Verdict, string> = {
  likely_scam: 'Likely scam',
  suspicious: 'Suspicious',
  needs_review: 'Needs review',
  unclear: 'Unclear',
  likely_safe: 'Likely safe',
}

export const TRUSTED_NOTE = "Mentions or links to an official domain. That alone doesn't prove who sent it — confirm in the official app."

export function normalizeVerdict(verdict: unknown): Verdict {
  return typeof verdict === 'string' && Object.prototype.hasOwnProperty.call(VERDICT_STYLE, verdict) ? (verdict as Verdict) : 'unclear'
}

export function verdictStyle(verdict: unknown): string {
  return VERDICT_STYLE[normalizeVerdict(verdict)]
}

export function verdictLabel(verdict: unknown): string {
  return VERDICT_LABEL[normalizeVerdict(verdict)]
}

export function categoryLabel(category: unknown): string {
  return typeof category === 'string' ? category.replace(/_/g, ' ') : ''
}

function riskOutOf100(riskScore: unknown): string | null {
  return typeof riskScore === 'number' && Number.isFinite(riskScore) ? `${Math.round(riskScore)}/100` : null
}

/** Verdict-specific share text. Deliberately takes no input/message text. */
export function buildShareSummary(result: { verdict?: unknown; riskScore?: unknown } | null | undefined): string {
  const verdict = normalizeVerdict(result?.verdict)
  const risk = riskOutOf100(result?.riskScore)
  switch (verdict) {
    case 'likely_scam':
      return `⚠️ ScamCheck flagged this as a likely scam${risk ? ` (risk ${risk})` : ''}. Do not pay, click links or share OTPs or security codes.`
    case 'suspicious':
    case 'needs_review':
      return `⚠️ ScamCheck found warning signs${risk ? ` (risk ${risk})` : ''}. Verify independently through the official app or website before acting.`
    case 'likely_safe':
      return `ScamCheck rated this low risk${risk ? ` (${risk})` : ''}. Always verify payments and requests through the official app.`
    case 'unclear':
    default:
      return 'Unable to determine. No clear scam signals were found, but this does not prove the message is safe.'
  }
}
