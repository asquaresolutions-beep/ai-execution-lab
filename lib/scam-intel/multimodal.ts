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

import { ocrImage, type OcrResult, type OcrWord } from './ocr'
import { enrich } from '@/lib/intelligence/enrichment'
import { embedQuery, EMBED_DIM } from '@/lib/ai/embeddings'
import { vectorSearch, bigQueryReady } from '@/lib/store/bigquery'
import { vertexConfigured } from '@/lib/ai/provider'
import { getAccessToken, getProjectId } from '@/lib/ai/vertex-auth'
import { confidenceBand } from '@/lib/intelligence/snippets'
import { log } from '@/lib/observability/logger'

const LOCATION = process.env.VERTEX_LOCATION || 'us-central1'
const VISION_MODEL = process.env.VERTEX_VISION_MODEL || 'gemini-2.5-flash'
const SCAM_SOURCES = ['scamcheck', 'trustseal', 'tier_a_post', 'blog_post']

export interface VisualSignal { id: string; label: string; severity: 'info' | 'warn' | 'danger'; evidence: string }
export interface SimilarHit { id: string; title: string; url: string; confidence: number; confidenceBand: string }
export interface MultimodalVerdict {
  verdict: 'likely_scam' | 'suspicious' | 'likely_safe' | 'unclear'
  riskScore: number              // 0..100
  confidence: number             // 0..1
  ocr: { text: string; engine: string; lang: string; wordCount: number }
  regions: OcrWord[]             // suspicious word boxes for highlighting
  classification: ReturnType<typeof enrich>['scam']
  trust: ReturnType<typeof enrich>['trust']
  visualSignals: VisualSignal[]
  similar: SimilarHit[]
  deepAnalysisUsed: boolean
  deepAnalysis?: string
}

// ── Cheap visual / textual heuristics over OCR output ──────────────
const DETECTORS: Array<{ id: string; label: string; severity: VisualSignal['severity']; re: RegExp }> = [
  { id: 'fake_payment', label: 'Fake payment/UPI confirmation', severity: 'danger', re: /\b(payment successful|₹\s?\d|paid to|upi ref|transaction id|money received|credited|debited|cashback)\b/i },
  { id: 'urgency', label: 'Urgency / pressure tactic', severity: 'warn', re: /\b(urgent|immediately|within \d+ (min|hour)|account (will be )?(blocked|suspended|closed)|act now|last chance|expire)\b/i },
  { id: 'otp_request', label: 'OTP / PIN / CVV request', severity: 'danger', re: /\b(otp|one[\s-]?time password|cvv|pin|share .*code|do not share)\b/i },
  { id: 'kyc_phish', label: 'KYC / account-verification phishing', severity: 'danger', re: /\b(kyc|verify your account|update (your )?(kyc|pan|details)|re-?activate)\b/i },
  { id: 'impersonation', label: 'Brand/authority impersonation', severity: 'warn', re: /\b(rbi|sbi|hdfc|icici|paytm|phonepe|google ?pay|amazon|customer care|bank official|income tax)\b/i },
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

export interface AnalyzeOptions { forceDeep?: boolean }

export async function analyzeScreenshot(base64: string, mime = 'image/png', opts: AnalyzeOptions = {}): Promise<MultimodalVerdict> {
  // 1–2. Cheap OCR + deterministic enrichment + visual heuristics.
  const ocr = await ocrImage(base64, mime)
  const enrichment = enrich({ text: ocr.text || '(no text detected)' })
  const signals = visualSignals(ocr)
  const regions = suspiciousRegions(ocr, signals)
  let riskScore = scoreFromSignals(signals, enrichment.scam.confidence)

  // 3. Cheap semantic similarity vs the scam corpus.
  let similar: SimilarHit[] = []
  if (ocr.text.trim().length > 15 && vertexConfigured() && bigQueryReady()) {
    try {
      const { vector, live } = await embedQuery(ocr.text.slice(0, 2000))
      if (live && vector.length === EMBED_DIM) {
        const hits = await vectorSearch(vector, 6, { withText: false, sourceTypes: SCAM_SOURCES })
        similar = hits.map((h) => ({ id: h.id, title: h.title, url: h.url, confidence: 1 - h.distance / 2, confidenceBand: confidenceBand(1 - h.distance / 2) }))
      }
    } catch (e) { log.warn({ event: 'multimodal.similar_failed', detail: String(e).slice(0, 120) }) }
  }

  // 4. GATED deep multimodal: only when the cheap signals are ambiguous
  //    (mid risk) or explicitly forced — avoids unnecessary vision inference.
  const ambiguous = riskScore >= 25 && riskScore <= 70
  let deepAnalysisUsed = false
  let deepAnalysis: string | undefined
  if ((opts.forceDeep || ambiguous) && vertexConfigured()) {
    const deep = await deepVisionVerdict(base64, mime, ocr.text).catch((e) => { log.warn({ event: 'multimodal.deep_failed', detail: String(e).slice(0, 120) }); return null })
    if (deep) {
      deepAnalysisUsed = true
      deepAnalysis = deep.rationale
      riskScore = Math.round((riskScore + deep.riskScore) / 2)
    }
  }

  const verdict: MultimodalVerdict['verdict'] = riskScore >= 70 ? 'likely_scam' : riskScore >= 35 ? 'suspicious' : ocr.text.trim() ? 'likely_safe' : 'unclear'
  const confidence = Math.round(Math.min(1, 0.45 + signals.length * 0.12 + (deepAnalysisUsed ? 0.15 : 0)) * 100) / 100
  return {
    verdict, riskScore, confidence,
    ocr: { text: ocr.text, engine: ocr.engine, lang: ocr.lang, wordCount: ocr.text.split(/\s+/).filter(Boolean).length },
    regions,
    classification: enrichment.scam,
    trust: enrichment.trust,
    visualSignals: signals,
    similar,
    deepAnalysisUsed,
    deepAnalysis,
  }
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
