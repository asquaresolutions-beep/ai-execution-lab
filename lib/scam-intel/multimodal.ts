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
import { analyzeUrls, type UrlFinding } from './url-intel'
import { fingerprint as scamFingerprint } from './fingerprint'
import { calibrate } from './calibration'
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
export interface Explainability {
  whyFlagged: string
  evidence: string[]
  matchingPatterns: string[]
  confidenceReasoning: string[]
}
export interface Timings { ocrMs: number; embedMs: number; vectorMs: number; deepMs: number; totalMs: number }
export interface MultimodalVerdict {
  verdict: 'likely_scam' | 'suspicious' | 'likely_safe' | 'unclear' | 'needs_review'
  riskScore: number              // 0..100 (calibrated)
  scamProbability: number        // 0..1
  trustScore: number             // 0..100 (higher = safer)
  confidence: number             // 0..1 (calibrated)
  confidenceBand: 'high' | 'medium' | 'low'
  explanation: string
  fingerprint: string            // stable campaign id
  campaignLabel: string          // human-readable scam fingerprint label
  safetyAdvice: string[]
  explainability: Explainability
  ocr: { text: string; engine: string; lang: string; wordCount: number }
  entities: ExtractedEntities
  urlFindings: UrlFinding[]
  regions: OcrWord[]             // suspicious word boxes for highlighting
  classification: ReturnType<typeof enrich>['scam']
  trust: ReturnType<typeof enrich>['trust']
  visualSignals: VisualSignal[]
  similar: SimilarHit[]
  deepAnalysisUsed: boolean
  deepAnalysis?: string
  timings: Timings
  estCostUsd: number
  cached?: boolean
}

// ── Cheap visual / textual heuristics over OCR output ──────────────
// Patterns cover English + Hindi (Devanagari) + Hinglish/transliterated scam
// language ("KYC update karo", "account block ho jayega", "OTP bhejo"). (goal 4)
const DETECTORS: Array<{ id: string; label: string; severity: VisualSignal['severity']; re: RegExp }> = [
  // Unsolicited credit/refund/QR-collect bait — NOT routine debit/receipt alerts.
  { id: 'fake_payment', label: 'Fake payment/refund/QR bait', severity: 'danger', re: /\b(refund (of|credited|received|amount|ke liye)|you (have )?received (rs|₹|inr|money|a refund)|money received|cashback (of|credited)|scan (the |this )?qr|collect request|claim (your|rs|₹)|received a refund|paise? (aa gaye|wapas|milenge)|रिफंड)\b|congratulations[^.\n]{0,40}(refund|cashback|won|prize)/i },
  { id: 'urgency', label: 'Urgency / pressure tactic', severity: 'warn', re: /\b(urgent|immediately|within \d+\s?(min|hour|day)s?|account (will be )?(blocked|suspended|closed)|act now|last chance|expir(?:e|es|ing|ed)|failure to|do not ignore|turant|abhi|jaldi|aaj hi|warna|band ho ?jayega|block ho ?jayega|बंद हो|तुरंत|जल्दी)\b/i },
  // Solicitation to SHARE an OTP/PIN/CVV (the scam) — NOT legit "do not share your OTP".
  { id: 'otp_request', label: 'OTP / PIN / CVV sharing request', severity: 'danger', re: /(?<!do not )(?<!don'?t )(?<!never )\b(share|send|tell|give|enter|forward)\b[^.\n]{0,15}\b(otp|one[\s-]?time password|cvv|pin|code)\b|\b(otp|cvv|pin|code)\b[^.\n]{0,14}\b(bhejo|batao|bhej do|share karo|chahiye)\b|ओटीपी[^।\n]{0,12}(भेजो|बताओ)/i },
  { id: 'kyc_phish', label: 'KYC / account-verification request', severity: 'warn', re: /\b(kyc|verify your account|update (your )?(kyc|pan|details)|re-?activate|kyc (update|karo|karein|karna)|verify karo|account (verify|update) karo|केवाईसी|सत्यापित)\b/i },
  { id: 'impersonation', label: 'Brand/authority impersonation', severity: 'warn', re: /\b(rbi|sbi|hdfc|icici|axis|kotak|pnb|paytm|phonepe|google ?pay|gpay|amazon|flipkart|netflix|india ?post|blue ?dart|dtdc|fedex|delhivery|courier|customs|customer care|bank official|income tax|uidai|aadhaar|npci|gst|बैंक|कस्टम)\b/i },
  { id: 'reward_bait', label: 'Lottery / reward / job / investment bait', severity: 'warn', re: /\b(congratulations|you (have )?won|lottery|prize|reward|work from home|earn \d|part[\s-]?time job|lucky draw|inaam|inam|jeeta|prize jeeta|ghar baithe|guaranteed return|airdrop|kamao|invest)\b|बधाई|इनाम|लॉटरी|गारंटीड|रिटर्न|निवेश|कमाएँ|जीता/i },
  { id: 'suspicious_link', label: 'Suspicious link / shortener', severity: 'danger', re: /\b(bit\.ly|tinyurl|t\.me|wa\.me|http:\/\/|[a-z0-9-]+\.(xyz|top|click|info)\b)/i },
  { id: 'contact_handoff', label: 'Move-to-WhatsApp / call-this-number', severity: 'warn', re: /\b(whatsapp|call (us|this number)|\+?\d{10,}|message me on|whatsapp (karo|par)|call karo)\b/i },
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

  const t0 = Date.now()
  const timings: Timings = { ocrMs: 0, embedMs: 0, vectorMs: 0, deepMs: 0, totalMs: 0 }

  // 1. OCR (cached by image hash so re-analysis never re-OCRs). (task 10)
  let ocr = await getCached<OcrResult>(`ocr:${imgHash}`)
  if (!ocr) { const s = Date.now(); ocr = await ocrImage(clean, mime); timings.ocrMs = Date.now() - s; if (ocr.text) await setCached(`ocr:${imgHash}`, 'ocr', ocr, CACHE_TTL) }

  // 2. Deterministic enrichment + visual heuristics + entity + URL intel.
  const text = ocr.text || ''
  const enrichment = enrich({ text: text || '(no text detected)' })
  const entities = extractEntities(text)
  const signals = visualSignals(ocr)
  const urlFindings = analyzeUrls(entities.urls)                       // (goal 6)
  const urlDanger = urlFindings.filter((f) => f.severity === 'danger').length
  const regions = suspiciousRegions(ocr, signals)
  let rawRisk = Math.min(100, scoreFromSignals(signals, enrichment.scam.confidence) + entityRiskCount(entities) * 6 + urlDanger * 10)
  // Soliciting an OTP/PIN/seed-phrase is inherently high-risk (legit messages
  // say "do NOT share") — floor the risk so lone-OTP scams aren't under-scored.
  if (signals.some((s) => s.id === 'otp_request')) rawRisk = Math.max(rawRisk, 55)

  // 3. trustscore + retrieval grounding (semantic-search/scam-intel). (task 5, goal 8)
  let trustScore = 50, scamProbability = rawRisk / 100, baseExplanation = enrichment.scam.tactics.length ? `Detected ${enrichment.scam.category.replace(/_/g, ' ')} with tactics: ${enrichment.scam.tactics.join(', ')}.` : 'Heuristic assessment from extracted text.'
  if (text.trim().length > 10) {
    try {
      const ts = await computeTrustScore(text.slice(0, 4000))
      trustScore = ts.trustScore; scamProbability = ts.scamProbability; baseExplanation = ts.explanation
      rawRisk = Math.round(Math.min(100, rawRisk * 0.5 + ts.scamProbability * 100 * 0.5))
    } catch (e) { log.warn({ event: 'multimodal.trustscore_failed', detail: String(e).slice(0, 120) }) }
  }

  let similar: SimilarHit[] = []
  let embedTokens = 0
  if (text.trim().length > 15 && vertexConfigured() && bigQueryReady()) {
    try {
      let vector = await getCached<number[]>(`imgembed:${imgHash}`)
      if (!vector) { const s = Date.now(); const r = await embedQuery(text.slice(0, 2000)); timings.embedMs = Date.now() - s; embedTokens = Math.ceil(text.length / 4); if (r.live && r.vector.length === EMBED_DIM) { vector = r.vector; await setCached(`imgembed:${imgHash}`, 'imgembed', vector, CACHE_TTL) } }
      if (vector && vector.length === EMBED_DIM) {
        const s = Date.now()
        const hits = await vectorSearch(vector, 6, { withText: false, sourceTypes: SCAM_SOURCES })
        timings.vectorMs = Date.now() - s
        similar = hits.map((h) => ({ id: h.id, title: h.title, url: h.url, confidence: 1 - h.distance / 2, confidenceBand: confidenceBand(1 - h.distance / 2) }))
      }
    } catch (e) { log.warn({ event: 'multimodal.similar_failed', detail: String(e).slice(0, 120) }) }
  }
  const similarTop = similar[0]?.confidence ?? 0

  // 4. GATED deep multimodal (visual spoof detection), grounded by retrieval. (goal 7, 8)
  const ambiguous = rawRisk >= 25 && rawRisk <= 70
  let deepAnalysisUsed = false
  let deepAnalysis: string | undefined
  let deepTokens = 0
  if ((opts.forceDeep || ambiguous) && vertexConfigured()) {
    const s = Date.now()
    const deep = await deepVisionVerdict(clean, mime, text, similar).catch((e) => { log.warn({ event: 'multimodal.deep_failed', detail: String(e).slice(0, 120) }); return null })
    timings.deepMs = Date.now() - s
    if (deep) { deepAnalysisUsed = true; deepAnalysis = deep.rationale; deepTokens = deep.tokens; rawRisk = Math.round((rawRisk + deep.riskScore) / 2) }
  }

  // 5. Calibrate (anti over-confidence, evidence + source weighting). (goal 3)
  const cal = calibrate({
    rawRisk, signalCount: signals.length, dangerSignals: signals.filter((x) => x.severity === 'danger').length,
    entityRisk: entityRiskCount(entities), urlDanger, similarTopConfidence: similarTop,
    similarFromTrustedSource: (similar[0]?.confidence ?? 0) >= 0.7, deepUsed: deepAnalysisUsed, ocrChars: text.length,
  })
  const riskScore = cal.riskScore

  const verdict: MultimodalVerdict['verdict'] = cal.needsReview && riskScore < 70 ? 'needs_review'
    : riskScore >= 70 ? 'likely_scam' : riskScore >= 35 ? 'suspicious' : text.trim() ? 'likely_safe' : 'unclear'

  // 6. Explainability (goal 9).
  const matchingPatterns = [...signals.map((s) => s.label), ...urlFindings.flatMap((f) => f.risks.map((r) => `${f.host}: ${r}`))]
  const evidence = [
    ...signals.map((s) => `${s.label}: “${s.evidence}”`),
    ...urlFindings.map((f) => `Risky URL ${f.host} (${f.risks.join(', ')})`),
    ...(entities.upiIds.length ? [`UPI IDs: ${entities.upiIds.join(', ')}`] : []),
    ...(entities.qrPaymentRefs.length ? ['QR / collect-request present'] : []),
    ...(similarTop >= 0.6 ? [`Matches known scam pattern “${similar[0].title}” (${Math.round(similarTop * 100)}%)`] : []),
  ]
  const explainability: Explainability = {
    whyFlagged: verdict === 'likely_scam' ? 'Multiple fraud indicators with corroborating evidence.' : verdict === 'suspicious' ? 'Some fraud indicators detected; treat with caution.' : verdict === 'needs_review' ? 'Insufficient/low-confidence evidence — manual review recommended.' : 'No strong fraud indicators detected.',
    evidence,
    matchingPatterns,
    confidenceReasoning: cal.reasons,
  }

  timings.totalMs = Date.now() - t0
  // Cost estimate: embeddings ~$0.000025/1k tok; flash vision ~$0.075/1M in.
  const estCostUsd = Math.round(((embedTokens / 1000) * 0.000025 + (deepTokens / 1_000_000) * 0.3) * 1e6) / 1e6

  const fp = scamFingerprint({ category: enrichment.scam.category, text, entities, signals: signals.map((s) => s.id) })
  const result: MultimodalVerdict = {
    verdict, riskScore, scamProbability: Math.round(scamProbability * 1000) / 1000, trustScore,
    confidence: cal.confidence, confidenceBand: cal.band,
    explanation: baseExplanation,
    fingerprint: fp.fingerprint,
    campaignLabel: fp.label,
    safetyAdvice: safetyAdvice(enrichment.scam.category, entities, signals),
    explainability,
    ocr: { text, engine: ocr.engine, lang: ocr.lang, wordCount: text.split(/\s+/).filter(Boolean).length },
    entities,
    urlFindings,
    regions,
    classification: enrichment.scam,
    trust: enrichment.trust,
    visualSignals: signals,
    similar,
    deepAnalysisUsed,
    deepAnalysis,
    timings,
    estCostUsd,
  }

  // Observability (goal 12) + cache + BigQuery telemetry (never blocks/throws).
  log.info({ event: 'multimodal.analyzed', verdict, riskScore, confidence: cal.confidence, ...timings, estCostUsd, ocrEngine: ocr.engine, deepUsed: deepAnalysisUsed })
  await setCached(verdictKey, 'screenshot', result, CACHE_TTL).catch(() => {})
  void logImageAnalysis({
    id: imgHash, verdict, risk_score: riskScore, scam_probability: result.scamProbability, trust_score: trustScore,
    category: enrichment.scam.category, ocr_chars: text.length, ocr_engine: ocr.engine, lang: ocr.lang,
    phones: entities.phones.length, urls: entities.urls.length, shorteners: entities.shorteners.length, upi_ids: entities.upiIds.length,
    signals: signals.length, deep_used: deepAnalysisUsed, created_at: new Date().toISOString(),
  })
  return result
}

// ── Deep Gemini-vision verdict (expensive; gated, retrieval-grounded) ──────
async function deepVisionVerdict(base64: string, mime: string, ocrText: string, similar: SimilarHit[]): Promise<{ riskScore: number; rationale: string; tokens: number } | null> {
  const project = await getProjectId()
  if (!project) return null
  const token = await getAccessToken()
  const base = LOCATION === 'global' ? 'https://aiplatform.googleapis.com' : `https://${LOCATION}-aiplatform.googleapis.com`
  const url = `${base}/v1/projects/${project}/locations/${LOCATION}/publishers/google/models/${VISION_MODEL}:generateContent`
  const clean = base64.replace(/^data:[^;]+;base64,/, '')
  // Retrieval grounding: give the model known similar scams to reduce
  // hallucination + anchor the verdict in real patterns. (goal 8)
  const grounding = similar.length ? `\n\nKnown similar scam patterns from our database (for grounding — do not invent others):\n${similar.slice(0, 4).map((s) => `- ${s.title} (${Math.round(s.confidence * 100)}% similar)`).join('\n')}` : ''
  const prompt = `You are an Indian fraud analyst. Examine the screenshot AND the extracted text and decide if it is a scam. Check specifically for VISUAL SPOOFING: fake SBI/HDFC/ICICI bank logos, fake courier branding (India Post/BlueDart/FedEx), fake WhatsApp/UPI system screens, and fake "payment successful"/"refund credited" screens. Also weigh phishing, OTP theft, impersonation, KYC fraud, reward/job bait, and suspicious links. Be CALIBRATED — only assign high risk when visual + textual evidence agree; if unsure, say so and give a mid risk.${grounding}\n\nExtracted text:\n${ocrText.slice(0, 1500)}\n\nRespond ONLY as JSON: {"riskScore": 0-100, "rationale": "1-2 sentences citing the specific visual/textual evidence"}.`
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: mime, data: clean } }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 512, responseMimeType: 'application/json' },
    }),
  })
  if (!res.ok) throw new Error(`vision-verdict ${res.status}`)
  const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: { totalTokenCount?: number } }
  const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? ''
  const tokens = data.usageMetadata?.totalTokenCount ?? 0
  try {
    const j = JSON.parse(raw.replace(/```json|```/g, '').trim()) as { riskScore?: number; rationale?: string }
    return { riskScore: Math.max(0, Math.min(100, Number(j.riskScore) || 0)), rationale: j.rationale || 'No rationale.', tokens }
  } catch { return null }
}
