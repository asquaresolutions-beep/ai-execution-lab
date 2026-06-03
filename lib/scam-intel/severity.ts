// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/severity.ts
// Deterministic, explainable severity scoring (0-100 -> band).
// Factors are transparent so moderators can see WHY something scored high.
// ─────────────────────────────────────────────────────────────────

import type { Classification, Severity, SeverityScore } from './types'

// Base risk by category (financial-loss potential + prevalence).
const CATEGORY_BASE: Record<string, number> = {
  otp_fraud: 35, phishing: 35, upi_fraud: 35, investment_fraud: 30,
  fake_job: 25, loan_scam: 25, tech_support: 25, courier_customs: 20,
  whatsapp_scam: 20, lottery_prize: 18, romance: 22, other: 12,
}

export function scoreSeverity(
  classification: Classification,
  ctx: { reportCount?: number; velocity?: number } = {},
): SeverityScore {
  const factors: Record<string, number> = {}

  factors.category = CATEGORY_BASE[classification.category] ?? 12
  factors.confidence = Math.round(classification.confidence * 10)

  // More distinct indicators = more credible / dangerous.
  factors.indicators = Math.min(15, classification.indicators.length * 3)
  factors.tactics = Math.min(10, classification.tactics.length * 2)

  // Spread / virality: how many de-duplicated reports + recent velocity.
  const reportCount = ctx.reportCount ?? 1
  factors.spread = Math.min(20, Math.round(Math.log2(reportCount + 1) * 6))
  factors.velocity = Math.min(15, Math.round((ctx.velocity ?? 0) * 1.5))

  // Money mention bumps financial risk.
  if (classification.indicators.some((i) => /money|₹|rs|amount|lakh|crore/i.test(i))) {
    factors.financial = 8
  }

  const score = Math.min(100, Object.values(factors).reduce((a, b) => a + b, 0))
  return { severity: band(score), score, factors }
}

function band(score: number): Severity {
  if (score >= 75) return 'critical'
  if (score >= 55) return 'high'
  if (score >= 35) return 'medium'
  return 'low'
}

export const SEVERITY_RANK: Record<Severity, number> = {
  low: 1, medium: 2, high: 3, critical: 4,
}
