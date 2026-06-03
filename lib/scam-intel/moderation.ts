// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/moderation.ts
// Two-stage safety: (1) fast deterministic spam/abuse + PII pre-filter,
// (2) Gemini/Vertex moderation for nuanced cases. PII is redacted before
// anything is stored or displayed publicly.
// ─────────────────────────────────────────────────────────────────

import { generateJSON } from '@/lib/ai/provider'
import { cached } from '@/lib/ai/cache'
import { moderationPrompt, MODERATION_SYSTEM } from './prompts'
import type { Moderation, SpamAssessment } from './types'

// ── PII redaction (always applied before storage/display) ──────────
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
const PHONE_RE = /(?:\+?\d[\d\s-]{8,}\d)/g
const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/g
const CARD_RE = /\b(?:\d[ -]?){13,16}\b/g
const ACCT_RE = /\b\d{9,18}\b/g

export function redactPII(text: string): { text: string; redactions: number } {
  let n = 0
  const sub = (re: RegExp, tag: string) => (s: string) =>
    s.replace(re, () => { n++; return tag })
  let out = text
  out = sub(AADHAAR_RE, '[redacted-id]')(out)
  out = sub(CARD_RE, '[redacted-card]')(out)
  out = sub(EMAIL_RE, '[redacted-email]')(out)
  out = sub(PHONE_RE, '[redacted-phone]')(out)
  out = sub(ACCT_RE, '[redacted-number]')(out)
  return { text: out, redactions: n }
}

export function containsPII(text: string): boolean {
  return EMAIL_RE.test(text) || PHONE_RE.test(text) || AADHAAR_RE.test(text) || CARD_RE.test(text)
}

// ── Spam / abuse pre-filter (deterministic, free) ──────────────────
const SPAM_SIGNALS: Array<{ re: RegExp; reason: string; w: number }> = [
  { re: /(.)\1{9,}/, reason: 'repeated characters', w: 0.4 },
  { re: /(buy now|free money|click here){2,}/i, reason: 'spam phrasing', w: 0.5 },
  { re: /https?:\/\/\S+(\s+https?:\/\/\S+){3,}/i, reason: 'link flooding', w: 0.6 },
  { re: /\b(viagra|casino|porn|adult dating)\b/i, reason: 'off-topic spam', w: 0.8 },
]

export function assessSpam(text: string): SpamAssessment {
  const reasons: string[] = []
  let score = 0
  const trimmed = text.trim()
  if (trimmed.length < 12) { reasons.push('too short'); score += 0.5 }
  if (/^(.)\1*$/.test(trimmed)) { reasons.push('single repeated char'); score += 0.6 }
  for (const s of SPAM_SIGNALS) if (s.re.test(text)) { reasons.push(s.reason); score += s.w }
  const linkCount = (text.match(/https?:\/\//g) ?? []).length
  if (linkCount > 5) { reasons.push('excessive links'); score += 0.3 }
  score = Math.min(1, score)
  return { isSpam: score >= 0.6, score, reasons }
}

// ── AI moderation (nuanced) ────────────────────────────────────────
export async function moderate(text: string): Promise<Moderation> {
  const pii = containsPII(text)
  // Obvious abusive content short-circuits without AI.
  if (/\b(kill yourself|kys|n[i1]gg|f[a@]gg)\b/i.test(text)) {
    return { verdict: 'block', toxic: true, containsPII: pii, reasons: ['abusive language'] }
  }
  try {
    const ai = await cached('scam-moderate', { text }, () =>
      generateJSON<Partial<Moderation>>(moderationPrompt(text), { system: MODERATION_SYSTEM, temperature: 0 }),
    )
    return {
      verdict: (ai.verdict as Moderation['verdict']) || (pii ? 'review' : 'allow'),
      toxic: !!ai.toxic,
      containsPII: pii || !!ai.containsPII,
      reasons: ai.reasons || [],
    }
  } catch {
    // Fail safe: if AI down, route anything with PII to human review.
    return { verdict: pii ? 'review' : 'allow', toxic: false, containsPII: pii, reasons: ['ai-moderation-unavailable'] }
  }
}
