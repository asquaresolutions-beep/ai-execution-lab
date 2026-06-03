// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/ocr.ts
// Lightweight OCR for screenshot scam analysis. Primary: Google Cloud Vision
// TEXT_DETECTION (cheap ~$1.5/1k, returns word bounding boxes for highlighting
// suspicious regions). Fallback: Gemini multimodal text extraction (no extra
// API to enable). Multilingual (en + hi + more). Auth via the same ADC token.
// This is the CHEAP first pass; deep multimodal analysis is gated downstream.
// ─────────────────────────────────────────────────────────────────

import { getAccessToken, getProjectId } from '@/lib/ai/vertex-auth'
import { log } from '@/lib/observability/logger'

const LOCATION = process.env.VERTEX_LOCATION || 'us-central1'
const VISION_MODEL = process.env.VERTEX_OCR_VISION_MODEL || 'gemini-2.5-flash'

export interface OcrWord { text: string; x: number; y: number; w: number; h: number }
export interface OcrResult {
  text: string
  words: OcrWord[]          // normalized 0..1 boxes for region highlighting
  engine: 'cloud-vision' | 'gemini' | 'none'
  lang: string
}

/** Extract text (+ word boxes) from an image. Tries Cloud Vision, then Gemini. */
export async function ocrImage(base64: string, _mime = 'image/png'): Promise<OcrResult> {
  const clean = base64.replace(/^data:[^;]+;base64,/, '')
  const vision = await visionOcr(clean).catch((e) => { log.warn({ event: 'ocr.vision_failed', detail: String(e).slice(0, 120) }); return null })
  if (vision && vision.text.trim()) return vision
  const gemini = await geminiOcr(clean, _mime).catch((e) => { log.warn({ event: 'ocr.gemini_failed', detail: String(e).slice(0, 120) }); return null })
  if (gemini && gemini.text.trim()) return gemini
  return { text: '', words: [], engine: 'none', lang: 'unknown' }
}

// ── Cloud Vision TEXT_DETECTION (cheap, gives boxes) ───────────────
async function visionOcr(b64: string): Promise<OcrResult | null> {
  const token = await getAccessToken()
  const res = await fetch('https://vision.googleapis.com/v1/images:annotate', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ requests: [{ image: { content: b64 }, features: [{ type: 'TEXT_DETECTION' }], imageContext: { languageHints: ['en', 'hi'] } }] }),
  })
  if (!res.ok) throw new Error(`vision ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const data = (await res.json()) as VisionResponse
  const ann = data.responses?.[0]
  const full = ann?.fullTextAnnotation?.text ?? ann?.textAnnotations?.[0]?.description ?? ''
  if (!full) return null
  // Word boxes (skip [0] which is the whole-image annotation).
  const words: OcrWord[] = (ann?.textAnnotations ?? []).slice(1).map((t) => {
    const xs = (t.boundingPoly?.vertices ?? []).map((v) => v.x ?? 0)
    const ys = (t.boundingPoly?.vertices ?? []).map((v) => v.y ?? 0)
    const x = Math.min(...xs, 0), y = Math.min(...ys, 0)
    return { text: t.description ?? '', x, y, w: Math.max(...xs, 0) - x, h: Math.max(...ys, 0) - y }
  }).filter((w) => w.text)
  return { text: full, words, engine: 'cloud-vision', lang: /[ऀ-ॿ]/.test(full) ? 'hi' : 'en' }
}

// ── Gemini multimodal OCR fallback ─────────────────────────────────
async function geminiOcr(b64: string, mime: string): Promise<OcrResult | null> {
  const project = await getProjectId()
  if (!project) return null
  const token = await getAccessToken()
  const base = LOCATION === 'global' ? 'https://aiplatform.googleapis.com' : `https://${LOCATION}-aiplatform.googleapis.com`
  const url = `${base}/v1/projects/${project}/locations/${LOCATION}/publishers/google/models/${VISION_MODEL}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [
        { text: 'Transcribe ALL visible text in this screenshot verbatim, preserving line breaks and order. Output only the text, no commentary.' },
        { inlineData: { mimeType: mime, data: b64 } },
      ] }],
      generationConfig: { temperature: 0, maxOutputTokens: 1024 },
    }),
  })
  if (!res.ok) throw new Error(`gemini-ocr ${res.status}`)
  const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? ''
  if (!text.trim()) return null
  return { text: text.trim(), words: [], engine: 'gemini', lang: /[ऀ-ॿ]/.test(text) ? 'hi' : 'en' }
}

interface VisionVertex { x?: number; y?: number }
interface VisionResponse {
  responses?: Array<{
    fullTextAnnotation?: { text?: string }
    textAnnotations?: Array<{ description?: string; boundingPoly?: { vertices?: VisionVertex[] } }>
  }>
}
