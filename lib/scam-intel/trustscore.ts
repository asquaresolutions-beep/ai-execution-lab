// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/trustscore.ts
// TrustScore pipeline: URL / scam text / suspicious content →
//   { trustScore (0-100, higher = safer), scamProbability (0-1),
//     verdict, category, signals, explanation }.
//
// Composes the existing engine (rule+AI classify → severity scoring →
// Vertex explanation). Deterministic detectors give a result even with
// AI/Vertex disabled (mock), so it always returns something useful.
// Cache-backed + budget-guarded; safe to expose as a public API.
// ─────────────────────────────────────────────────────────────────

import { classify } from './classify'
import { scoreSeverity } from './severity'
import { getProvider } from '@/lib/ai/provider'
import { cached } from '@/lib/ai/cache'
import type { Classification } from './types'

export interface TrustScoreResult {
  input: string
  inputType: 'url' | 'text'
  trustScore: number          // 0-100, higher = safer
  scamProbability: number     // 0-1
  verdict: 'safe' | 'caution' | 'likely_scam' | 'high_risk'
  category: string
  confidence: number
  signals: string[]           // observable indicators
  tactics: string[]
  explanation: string         // human-readable, AI when available
  model: string
}

const URL_RE = /\bhttps?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,}(\/|$)/i

function detectType(input: string): 'url' | 'text' {
  return URL_RE.test(input.trim()) && input.trim().split(/\s+/).length <= 3 ? 'url' : 'text'
}

// scamProbability blends classifier confidence + severity + indicator weight.
function scamProbability(c: Classification, severityScore: number): number {
  if (c.category === 'other' && c.confidence < 0.3) return clamp01(severityScore / 200)
  const base = c.confidence * 0.6 + (severityScore / 100) * 0.3 + Math.min(0.1, c.indicators.length * 0.025)
  return clamp01(base)
}

function verdictFor(p: number): TrustScoreResult['verdict'] {
  if (p >= 0.8) return 'high_risk'
  if (p >= 0.55) return 'likely_scam'
  if (p >= 0.3) return 'caution'
  return 'safe'
}

export async function computeTrustScore(input: string, opts: { platform?: string; region?: string } = {}): Promise<TrustScoreResult> {
  const text = (input || '').trim()
  const inputType = detectType(text)

  return cached('trustscore', { text, ...opts }, async () => {
    const classification = await classify(text, opts.platform, opts.region)
    const severity = scoreSeverity(classification)
    const p = scamProbability(classification, severity.score)
    const trustScore = Math.round((1 - p) * 100)
    const explanation = await explain(text, classification, p)
    return {
      input: text.slice(0, 500),
      inputType,
      trustScore,
      scamProbability: +p.toFixed(3),
      verdict: verdictFor(p),
      category: classification.category,
      confidence: classification.confidence,
      signals: classification.indicators,
      tactics: classification.tactics,
      explanation,
      model: getProvider().name,
    }
  })
}

// AI explanation (Vertex when live). Falls back to a deterministic,
// accurate explanation from the detectors when AI is unavailable.
async function explain(text: string, c: Classification, p: number): Promise<string> {
  const provider = getProvider()
  const deterministic = `${verdictFor(p) === 'safe' ? 'No strong scam signals detected.' : `Likely ${c.category.replace(/_/g, ' ')}.`}` +
    (c.indicators.length ? ` Signals: ${c.indicators.join('; ')}.` : '') +
    ` Never share OTP, UPI PIN, or card details; report fraud to 1930 / cybercrime.gov.in.`
  if (!provider.live) return deterministic
  try {
    return await provider.generate(
      `A scam-check classified this message as "${c.category}" (scam probability ${(p * 100) | 0}%). In 2-3 plain sentences, explain to a non-technical user why it is or isn't likely a scam and what to do. Do not invent facts. Message: """${text.slice(0, 1500)}"""`,
      { system: 'You are a calm, factual scam-safety assistant. No fear-mongering, no fabricated stats.', temperature: 0.3, maxTokens: 220, tier: 'flash' },
    )
  } catch {
    return deterministic
  }
}

function clamp01(n: number): number { return Math.max(0, Math.min(1, n)) }
