// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/multimodal.ts
// Multimodal scam analysis for screenshots (WhatsApp/Telegram/IG DMs, fake
// UPI/payment confirmations, phishing UI). Cost-gated pipeline:
//   1. CHEAP: OCR (Vision/Gemini) → text + word boxes.
//   2. CHEAP: deterministic enrich() on text → scam category/severity/tactics,
//      trust signals; visual-heuristic detectors over OCR layout/keywords.
//   3. CHEAP: semantic similarity vs the scam corpus (VECTOR_SEARCH).
//   4. GATED: deep Gemini-vision verdict ONLY when cheap signals are ambiguous
//      (preserves scale-to-zero + minimises expensive multimodal inference).
// Reuses Vertex + BigQuery + the semantic enrichment pipeline. (Part 2)
// ─────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto'
import { ocrImage, type OcrResult, type OcrWord } from './ocr'
import { enrich } from '@/lib/intelligence/enrichment'
import { extractEntities, entityRiskCount, type ExtractedEntities } from './extract-entities'
import { computeTrustScore } from './trustscore'
import { embedQuery, EMBED_DIM } from '@/lib/ai/embeddings'
import { vectorSearch, bigQueryReady, logImageAnalysis } from '@/lib/store/bigquery'
import { vertexConfigured } from '@/lib/ai/provider'
import { getAccessToken, getProjectId } from '@/lib/ai/vertex-auth'
import { confidenceBand } from '@/lib/intelligence/snippets'
import { getCached, setCached } from '@/lib/ai/cache'
import { log } from '@/lib/observability/logger'

const LOCATION = process.env.VERTEX_LOCATION || 'us-central1'
const VISION_MODEL = process.env.VERTEX_VISION_MODEL || 'gemini-2.5-flash'
const SCAM_SOURCES = ['scamcheck', 'trustseal', 'tier_a_post', 'blog_post']
const CACHE_TTL = 24 * 60 * 60_000

export interface VisualSignal { id: string; label: string; severity: 'info' | 'warn' | 'danger'; evidence: string }
export interface SimilarHit { id: string; title: string; url: string; confidence: number; confidenceBand: string }
export interface MultimodalVerdict {
  verdict: 'likely_scam' | 'suspicious' | 'likely_safe' | 'unclear'
  riskScore: number              // 0..100
  scamProbability: number        // 0..1
  trustScore: number             // 0..100 (higher = safer)
  confidence: number             // 0..1
  explanation: string
  safetyAdvice: string[]
  ocr: { text: string; engine: string; lang: string; wordCount: number }
  entities: ExtractedEntities
  regions: OcrWord[]             // suspicious word boxes for highlighting
  classification: ReturnType<typeof enrich>['scam']
  trust: ReturnType<typeof enrich>['trust']
  visualSignals: VisualSignal[]
  similar: SimilarHit[]
  deepAnalysisUsed: boolean
  deepAnalysis?: string
  cached?: boolean
}

// ── Cheap visual / textual heuristics over OCR output ──────────────
const DETECTORS: Array<{ id: string; label: string; severity: VisualSignal['severity']; re: RegExp }> = [
  { id: 'fake_payment', label: 'Fake payment/UPI confirmation', severity: 'danger', re: /\b(payment successful|₹\s?\d|paid to|upi ref|transaction id|money received|credited|debited|cashback)\b/i },
  { id: 'urgency', label: 'Urgency / pressure tactic', severity: 'warn', re: /\b(urgent|immediately|within \d+\s?(min|hour|day)s?|account (will be )?(blocked|suspended|closed)|act now|last chance|expir(?:e|es|ing|ed)|failure to|do not ignore)\b/i },
  { id: 'otp_request', label: 'OTP / PIN / CVV request', severity: 'danger', re: /\b(otp|one[\s-]?time password|cvv|pin|share .*code|do not share)\b/i },
  { id: 'kyc_phish', label: 'KYC / account-verification phishing', severity: 'danger', re: /\b(kyc|verify your account|update (your )?(kyc|pan|details)|re-?activate)\b/i },
  { id: 'impersonation', label: 'Brand/authority impersonation', severity: 'warn', re: /\b(rbi|sbi|hdfc|icici|axis|kotak|pnb|paytm|phonepe|google ?pay|gpay|amazon|flipkart|netflix|india ?post|blue ?dart|dtdc|fedex|delhivery|courier|customs|customer care|bank official|income tax|uidai|aadhaar|npci|gst)\b/i },
  { id: 'reward_bait', label: 'Lottery / reward / job bait', severity: 'warn', re: /\b(congratulations|you (have )?won|lottery|prize|reward|work from home|earn \d|part[\s-]?time job)\b/i },
  { id: 'suspicious_link', label: 'Suspicious link / shortener', severity: 'danger', re: /\b(bit\.ly|tinyurl|t\.me|wa\.me|http:\/\/|[a-z0-9-]+\.(xyz|top|click|info)\b)/i },
  { id: 'contact_handoff', label: 'Move-to-WhatsApp / call-this-number', severity: 'warn', re: /\b(whatsapp|call (us|this number)|\+?\d{10,}|message me on)\b/i },
]

function visualSignals(ocr: OcrResult): VisualSignal[] {
  const out: VisualSignal[] = []
  for (const d of DETECTORS) {
    const m = ocr.text.match(d.re)
    if (m) out.push({ id: d.id, label: d.label, severity: d.severity, evidence: m[0].slice(0, 60) })
  }
  return out
}

function suspiciousRegions(ocr: OcrResult, signals: VisualSignal[]): OcrWord[] {
  if (!ocr.words.length) return []
  const terms = signals.map((s) => s.evidence.toLowerCase()).join(' ')
  return ocr.words.filter((w) => terms.includes(w.text.toLowerCase()) && w.text.length > 1).slice(0, 40)
}

function scoreFromSignals(signals: VisualSignal[], scamConfidence: number): number {
  const danger = signals.filter((s) => s.severity === 'danger').length
  const warn = signals.filter((s) => s.severity === 'warn').length
  return Math.min(100, Math.round(danger * 28 + warn * 12 + scamConfidence * 30))
}

// Category/signal-driven safety advice (deterministic).
function safetyAdvice(category: string, entities: ExtractedEntities, signals: VisualSignal[]): string[] {
  const tips: string[] = []
  const has = (id: string) => signals.some((s) => s.id === id)
  if (has('otp_request') || /otp/i.test(category)) tips.push('Never share an OTP, PIN, or CVV — no bank or company ever asks for them.')
  if (has('fake_payment') || entities.upiIds.length || entities.qrPaymentRefs.length) tips.push('A real credit never requires you to SCAN a QR or approve a "collect request" — scanning/approving SENDS money. Verify in your own bank app.')
  if (has('kyc_phish') || /kyc/i.test(category)) tips.push('Banks do not suspend accounts over WhatsApp/SMS links. Update KYC only at a branch or the official app.')
  if (entities.shorteners.length) tips.push('Do not open shortened/unknown links — they hide the real destination.')
  if (has('impersonation') || entities.impersonationMarkers.length) tips.push('Verify the sender independently using the number on the official website/card — not the number in the message.')
  if (entities.phones.length) tips.push('Do not call back numbers sent in unsolicited messages.')
  tips.push('If money was lost or shared, call the cybercrime helpline 1930 or report at cybercrime.gov.in immediately.')
  return Array.from(new Set(tips)).slice(0, 6)
}

/**
 * Deterministic, OCR/Vertex-free analysis of already-extracted text. Exposed
 * for tests + callers that already have the text. Returns entities, visual
 * signals, scam category and tactics.
 */
export function analyzeTextSignals(text: string): { entities: ExtractedEntities; signals: VisualSignal[]; category: string; tactics: string[] } {
  const ocrLike: OcrResult = { text, words: [], engine: 'none', lang: /[ऀ-ॿ]/.test(text) ? 'hi' : 'en' }
  const enrichment = enrich({ text: text || '(none)' })
  return { entities: extractEntities(text), signals: visualSignals(ocrLike), category: enrichment.scam.category, tactics: enrichment.scam.tactics }
}

export interface AnalyzeOptions { forceDeep?: boolean }

export async function analyzeScreenshot(base64: string, mime = 'image/png', opts: AnalyzeOptions = {}): Promise<MultimodalVerdict> {
  const clean = base64.replace(/^data:[^;]+;base64,/, '')
  const imgHash = createHash('sha256').update(clean).digest('hex').slice(0, 32)

  // Cost optimization: return a cached verdict for an identical image — zero
  // OCR / embedding / vision cost on duplicate uploads. (task 10)
  const verdictKey = `screenshot:v2:${imgHash}:${opts.forceDeep ? 'deep' : 'std'}`
  const cachedVerdict = await getCached<MultimodalVerdict>(verdictKey)
  if (cachedVerdict) return { ...cachedVerdict, cached: true }

  // 1. OCR (cached by image hash so re-analysis never re-OCRs). (task 10)
  let ocr = await getCached<OcrResult>(`ocr:${imgHash}`)
  if (!ocr) { ocr = await ocrImage(clean, mime); if (ocr.text) await setCached(`ocr:${imgHash}`, 'ocr', ocr, CACHE_TTL) }

  // 2. Deterministic enrichment + visual heuristics + entity extraction.
  const text = ocr.text || ''
  const enrichment = enrich({ text: text || '(no text detected)' })
  const entities = extractEntities(text)
  const signals = visualSignals(ocr)
  const regions = suspiciousRegions(ocr, signals)
  let riskScore = Math.min(100, scoreFromSignals(signals, enrichment.scam.confidence) + entityRiskCount(entities) * 6)

  // 3. Feed extracted text into trustscore + semantic-search/scam-intel
  //    similarity. trustscore yields scamProbability + explanation. (task 5)
  let trustScore = 50, scamProbability = riskScore / 100, explanation = enrichment.scam.tactics.length ? `Detected ${enrichment.scam.category.replace(/_/g, ' ')} with tactics: ${enrichment.scam.tactics.join(', ')}.` : 'Heuristic assessment from extracted text.'
  if (text.trim().length > 10) {
    try {
      const ts = await computeTrustScore(text.slice(0, 4000))
      trustScore = ts.trustScore; scamProbability = ts.scamProbability; explanation = ts.explanation
      riskScore = Math.round(Math.min(100, riskScore * 0.5 + ts.scamProbability * 100 * 0.5))
    } catch (e) { log.warn({ event: 'multimodal.trustscore_failed', detail: String(e).slice(0, 120) }) }
  }

  let similar: SimilarHit[] = []
  if (text.trim().length > 15 && vertexConfigured() && bigQueryReady()) {
    try {
      // Embedding cached by image hash → no duplicate image embeddings. (task 10)
      let vector = await getCached<number[]>(`imgembed:${imgHash}`)
      if (!vector) { const r = await embedQuery(text.slice(0, 2000)); if (r.live && r.vector.length === EMBED_DIM) { vector = r.vector; await setCached(`imgembed:${imgHash}`, 'imgembed', vector, CACHE_TTL) } }
      if (vector && vector.length === EMBED_DIM) {
        const hits = await vectorSearch(vector, 6, { withText: false, sourceTypes: SCAM_SOURCES })
        similar = hits.map((h) => ({ id: h.id, title: h.title, url: h.url, confidence: 1 - h.distance / 2, confidenceBand: confidenceBand(1 - h.distance / 2) }))
      }
    } catch (e) { log.warn({ event: 'multimodal.similar_failed', detail: String(e).slice(0, 120) }) }
  }

  // 4. GATED deep multimodal: only when ambiguous or forced. (task 3, cost-aware)
  const ambiguous = riskScore >= 25 && riskScore <= 70
  let deepAnalysisUsed = false
  let deepAnalysis: string | undefined
  if ((opts.forceDeep || ambiguous) && vertexConfigured()) {
    const deep = await deepVisionVerdict(clean, mime, text).catch((e) => { log.warn({ event: 'multimodal.deep_failed', detail: String(e).slice(0, 120) }); return null })
    if (deep) { deepAnalysisUsed = true; deepAnalysis = deep.rationale; riskScore = Math.round((riskScore + deep.riskScore) / 2) }
  }

  const verdict: MultimodalVerdict['verdict'] = riskScore >= 70 ? 'likely_scam' : riskScore >= 35 ? 'suspicious' : text.trim() ? 'likely_safe' : 'unclear'
  const confidence = Math.round(Math.min(1, 0.45 + signals.length * 0.1 + entityRiskCount(entities) * 0.05 + (deepAnalysisUsed ? 0.15 : 0)) * 100) / 100
  const result: MultimodalVerdict = {
    verdict, riskScore, scamProbability: Math.round(scamProbability * 1000) / 1000, trustScore, confidence,
    explanation,
    safetyAdvice: safetyAdvice(enrichment.scam.category, entities, signals),
    ocr: { text, engine: ocr.engine, lang: ocr.lang, wordCount: text.split(/\s+/).filter(Boolean).length },
    entities,
    regions,
    classification: enrichment.scam,
    trust: enrichment.trust,
    visualSignals: signals,
    similar,
    deepAnalysisUsed,
    deepAnalysis,
  }

  // Cache verdict + best-effort BigQuery telemetry (never blocks/throws). (task 8)
  await setCached(verdictKey, 'screenshot', result, CACHE_TTL).catch(() => {})
  void logImageAnalysis({
    id: imgHash, verdict, risk_score: riskScore, scam_probability: result.scamProbability, trust_score: trustScore,
    category: enrichment.scam.category, ocr_chars: text.length, ocr_engine: ocr.engine, lang: ocr.lang,
    phones: entities.phones.length, urls: entities.urls.length, shorteners: entities.shorteners.length, upi_ids: entities.upiIds.length,
    signals: signals.length, deep_used: deepAnalysisUsed, created_at: new Date().toISOString(),
  })
  return result
}

// ── Deep Gemini-vision verdict (expensive; gated) ──────────────────
async function deepVisionVerdict(base64: string, mime: string, ocrText: string): Promise<{ riskScore: number; rationale: string } | null> {
  const project = await getProjectId()
  if (!project) return null
  const token = await getAccessToken()
  const base = LOCATION === 'global' ? 'https://aiplatform.googleapis.com' : `https://${LOCATION}-aiplatform.googleapis.com`
  const url = `${base}/v1/projects/${project}/locations/${LOCATION}/publishers/google/models/${VISION_MODEL}:generateContent`
  const clean = base64.replace(/^data:[^;]+;base64,/, '')
  const prompt = `You are a fraud analyst. Examine this screenshot and the extracted text. Assess if it is a scam (fake payment/UPI confirmation, phishing, impersonation, OTP theft, reward/job bait). Consider visual cues (fake UI, spoofed logos, mismatched fonts). Respond ONLY as JSON: {"riskScore": 0-100, "rationale": "one or two sentences"}.\n\nExtracted text:\n${ocrText.slice(0, 1500)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: mime, data: clean } }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 512, responseMimeType: 'application/json' },
    }),
  })
  if (!res.ok) throw new Error(`vision-verdict ${res.status}`)
  const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? ''
  try {
    const j = JSON.parse(raw.replace(/```json|```/g, '').trim()) as { riskScore?: number; rationale?: string }
    return { riskScore: Math.max(0, Math.min(100, Number(j.riskScore) || 0)), rationale: j.rationale || 'No rationale.' }
  } catch { return null }
}
