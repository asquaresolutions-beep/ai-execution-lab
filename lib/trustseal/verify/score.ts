// ─────────────────────────────────────────────────────────────────
// lib/trustseal/verify/score.ts  (asq-trustseal-c1b)
// PURE scoring core — the heart of the engine. Frozen per V2 §2,3,4 + caps.
// No project imports → fully unit-testable under node --experimental-strip-types.
//   • missing/not_applicable → neutral, no penalty
//   • blocked/error/timeout on a HARD category → penalty (≤25) + no coverage (transparency)
//   • confidence = category-coverage-weighted × freshness  (raw count never used)
//   • band gated by confidence; 'verified' needs ≥2 independent hard signals
//   • fraud caps applied post-base
// ─────────────────────────────────────────────────────────────────
import type { Signal, SignalCategory, CategoryScore, FraudCap, ScoreOutput, VerifyBand } from './types'

export const SIGNAL_SCHEMA_VERSION = '1'
export const WEIGHTS_VERSION = '1'

export const CATEGORY_WEIGHTS: Record<SignalCategory, number> = {
  reputation: 25, legitimacy: 20, dns: 6, ssl: 9, whois: 10, web: 15, impersonation: 15,
}
const HARD: SignalCategory[] = ['reputation', 'legitimacy', 'dns', 'ssl', 'whois']
const NEUTRAL = 50
const OPACITY_PENALTY = 25   // score assigned to a blocked/failed hard-category signal
const CAP_VALUES: Record<string, number> = { blocklist: 15, impersonation: 25, intel_graph: 30, unreachable: 40, opacity: 45 }

interface Eff { include: boolean; score: number; coverage: boolean }
function effective(s: Signal): Eff {
  if (s.status === 'ok') return { include: true, score: clamp(s.score), coverage: true }
  if (s.status === 'not_applicable' || s.status === 'missing') return { include: false, score: NEUTRAL, coverage: false }
  // blocked | error | timeout
  if (HARD.includes(s.category)) return { include: true, score: OPACITY_PENALTY, coverage: false } // transparency penalty
  return { include: false, score: NEUTRAL, coverage: false } // soft category failure: ignore, no penalty
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))

export interface ScoreInput { signals: Signal[]; ageSeconds?: number; ttlSeconds?: number }

export function scoreVerification(input: ScoreInput): ScoreOutput {
  const { signals } = input
  const cats: SignalCategory[] = ['reputation', 'legitimacy', 'dns', 'ssl', 'whois', 'web', 'impersonation']
  const categories: CategoryScore[] = []
  let base = 0

  for (const c of cats) {
    const inCat = signals.filter((s) => s.category === c)
    const effs = inCat.map(effective)
    const included = effs.filter((e) => e.include)
    const subScore = included.length ? Math.round(included.reduce((a, e) => a + e.score, 0) / included.length) : NEUTRAL
    const covered = effs.some((e) => e.coverage)
    const weight = CATEGORY_WEIGHTS[c]
    categories.push({ category: c, weight, subScore, covered, signalCount: inCat.length })
    base += (weight / 100) * subScore
  }
  base = Math.round(base)

  // Transparency / opacity: ≥2 hard categories with NO ok signal but at least one blocked/error/timeout.
  const opaqueHard = HARD.filter((c) => {
    const inCat = signals.filter((s) => s.category === c)
    const anyOk = inCat.some((s) => s.status === 'ok')
    const anyBlocked = inCat.some((s) => s.status === 'blocked' || s.status === 'error' || s.status === 'timeout')
    return !anyOk && anyBlocked
  })
  const opacity = opaqueHard.length >= 2

  // Fraud caps (post-base).
  const caps: FraudCap[] = []
  for (const s of signals) {
    if (s.cap && s.status === 'ok' && s.value) caps.push({ rule: s.cap, cappedAt: CAP_VALUES[s.cap], firedBy: s.id })
  }
  if (opacity) caps.push({ rule: 'opacity', cappedAt: CAP_VALUES.opacity, firedBy: opaqueHard.join('+') })
  const score = caps.length ? Math.min(base, ...caps.map((c) => c.cappedAt)) : base

  // Confidence: category-coverage-weighted × freshness.
  const coverWeight = categories.reduce((a, c) => a + (c.covered ? c.weight : 0), 0) / 100
  const ttl = input.ttlSeconds ?? 86400
  const age = input.ageSeconds ?? 0
  const freshness = clamp(1 - age / Math.max(ttl, 1), 0.4, 1) / 1
  const confidence = Math.round(coverWeight * freshness * 100) / 100

  // Band: confidence-gated; 'verified' needs ≥2 independent hard signals.
  const repOk = signals.some((s) => s.category === 'reputation' && s.status === 'ok')
  const trustAnchor = signals.some((s) => (s.category === 'whois' || s.category === 'legitimacy') && s.status === 'ok')
  const band = bandFor(score, confidence, repOk && trustAnchor)

  return { score, baseScore: base, band, confidence, categories, caps, opacity, badges: badgesFor(signals) }
}

function bandFor(score: number, confidence: number, twoHardSignals: boolean): VerifyBand {
  let cap: VerifyBand = 'verified'
  if (confidence < 0.35) cap = 'caution'
  else if (confidence < 0.55) cap = 'limited'
  let band: VerifyBand =
    score >= 80 ? 'verified' : score >= 60 ? 'established' : score >= 40 ? 'limited' : score >= 20 ? 'caution' : 'high_risk'
  if (band === 'verified' && !twoHardSignals) band = 'established' // verified needs corroboration
  return minBand(band, cap)
}

const ORDER: VerifyBand[] = ['high_risk', 'caution', 'limited', 'established', 'verified']
function minBand(a: VerifyBand, b: VerifyBand): VerifyBand { return ORDER[Math.min(ORDER.indexOf(a), ORDER.indexOf(b))] }

function badgesFor(signals: Signal[]): string[] {
  const ok = (id: string) => signals.some((s) => s.id === id && s.status === 'ok' && s.value)
  const badges: string[] = []
  if (ok('ssl.validation_level')) badges.push('ssl_verified')
  if (ok('whois.domain_age')) badges.push('established_domain')
  if (signals.some((s) => s.category === 'reputation' && s.status === 'ok' && !signals.some((b) => b.cap === 'blocklist' && b.value))) badges.push('no_blocklist')
  return badges
}
