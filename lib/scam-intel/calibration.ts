// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/calibration.ts
// Confidence calibration for multimodal verdicts. Raw model/heuristic risk is
// often over-confident, so we down-weight verdicts with thin evidence, apply an
// uncertainty penalty, weight by evidence + source reliability, and fall back
// to a "needs_review" state when there isn't enough signal. Pure. (goal 3)
// ─────────────────────────────────────────────────────────────────

export interface CalibrationInput {
  rawRisk: number             // 0..100 from heuristics + (optional) deep vision
  signalCount: number         // visual/text detectors that fired
  dangerSignals: number       // subset that are high-severity
  entityRisk: number          // risk-bearing entity classes present
  urlDanger: number           // dangerous URL findings
  similarTopConfidence: number // 0..1 best scam-corpus match (retrieval grounding)
  similarFromTrustedSource: boolean
  deepUsed: boolean           // deep Gemini vision corroborated
  ocrChars: number            // extracted text length (low → unreliable)
}

export interface Calibrated {
  riskScore: number           // calibrated 0..100
  confidence: number          // calibrated 0..1
  band: 'high' | 'medium' | 'low'
  needsReview: boolean        // low-confidence fallback (don't assert a verdict)
  reasons: string[]           // confidence reasoning (explainability)
}

export function calibrate(i: CalibrationInput): Calibrated {
  const reasons: string[] = []
  const evidence = i.signalCount + i.entityRisk + i.urlDanger + (i.deepUsed ? 2 : 0) + (i.similarTopConfidence >= 0.7 ? 1 : 0)

  // Base confidence grows with corroborating evidence, saturating.
  let confidence = Math.min(0.95, 0.35 + evidence * 0.09)
  if (i.dangerSignals >= 2) { confidence += 0.05; reasons.push(`${i.dangerSignals} high-severity signals`) }
  if (i.deepUsed) reasons.push('deep vision corroborated')
  if (i.similarTopConfidence >= 0.7) reasons.push(`matched a known scam pattern (${Math.round(i.similarTopConfidence * 100)}%)${i.similarFromTrustedSource ? ', trusted source' : ''}`)

  let riskScore = i.rawRisk

  // Uncertainty penalty: high raw risk with little evidence is pulled toward
  // the neutral midpoint and confidence is cut (anti over-confidence).
  if (i.rawRisk >= 65 && evidence <= 1) {
    riskScore = Math.round(i.rawRisk * 0.6 + 50 * 0.4)
    confidence -= 0.2
    reasons.push('uncertainty penalty: strong claim on thin evidence')
  }

  // Evidence-weighted boost: lots of corroboration sharpens a high verdict.
  if (i.rawRisk >= 50 && evidence >= 4) {
    riskScore = Math.min(100, riskScore + 6)
    reasons.push('evidence-weighted: multiple independent indicators')
  }

  // Low-confidence fallback: too little text to trust OCR-derived signals.
  let needsReview = false
  if (i.ocrChars < 25) {
    confidence = Math.min(confidence, 0.4)
    needsReview = true
    reasons.push('low OCR text — manual review recommended')
  }
  // Retrieval grounding: NO similar scam + few signals → temper the risk.
  if (i.similarTopConfidence < 0.45 && i.signalCount <= 1 && i.rawRisk >= 50) {
    riskScore = Math.round(riskScore * 0.8)
    reasons.push('no corroborating scam-corpus match')
  }

  confidence = Math.max(0.1, Math.min(0.97, Math.round(confidence * 100) / 100))
  riskScore = Math.max(0, Math.min(100, Math.round(riskScore)))
  const band = confidence >= 0.75 ? 'high' : confidence >= 0.55 ? 'medium' : 'low'
  if (band === 'low' && riskScore >= 35) needsReview = true
  return { riskScore, confidence, band, needsReview, reasons }
}
