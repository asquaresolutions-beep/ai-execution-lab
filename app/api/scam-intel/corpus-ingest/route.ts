// POST /api/scam-intel/corpus-ingest   (ADMIN)  { imageBase64, mime? }
// Real-image corpus builder: analyze a scam screenshot, fingerprint it, embed
// the OCR text, store it in the BigQuery scam_corpus vector table, and return
// the nearest known campaigns. Used by scripts/build-scam-corpus.mjs to ingest
// a directory of real images at scale. Admin-gated; server-side GCP writes only.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { analyzeScreenshot } from '@/lib/scam-intel/multimodal'
import { embedQuery, EMBED_DIM } from '@/lib/ai/embeddings'
import { insertScamCorpusRows, scamCorpusNearest, bigQueryReady } from '@/lib/store/bigquery'
import { jsonRoute, ApiError } from '@/lib/api/json'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_BYTES = 6 * 1024 * 1024
function sniff(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png'
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

export const POST = jsonRoute('scam-intel/corpus-ingest', async (req) => {
  const auth = requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!bigQueryReady()) return NextResponse.json({ error: 'not_configured', detail: 'BigQuery required' }, { status: 503 })

  const body = await req.json().catch(() => ({})) as { imageBase64?: string; mime?: string }
  const base64 = (body.imageBase64 || '').replace(/^data:[^;]+;base64,/, '')
  if (!base64) throw new ApiError('no_image', 'provide imageBase64', 400)
  const buf = Buffer.from(base64, 'base64')
  if (buf.length > MAX_BYTES) throw new ApiError('too_large', `image exceeds ${MAX_BYTES} bytes`, 413)
  const mime = sniff(buf)
  if (!mime) throw new ApiError('invalid_payload', 'not a valid PNG/JPEG/WebP image', 415)

  const v = await analyzeScreenshot(base64, mime)
  let nearest = v.similar
  if (v.ocr.text.trim().length > 15) {
    const { vector, live } = await embedQuery(v.ocr.text.slice(0, 2000))
    if (live && vector.length === EMBED_DIM) {
      await insertScamCorpusRows([{
        id: `${v.fingerprint}-${Buffer.from(v.ocr.text.slice(0, 40)).toString('hex').slice(0, 8)}`,
        fingerprint: v.fingerprint, label: v.campaignLabel, category: v.classification.category,
        brand: (v.explainability.matchingPatterns.find((p) => /sbi|hdfc|icici|paytm|phonepe|amazon/i.test(p)) || '').slice(0, 40),
        domain_core: v.urlFindings[0]?.host || '', lang: v.ocr.lang, ocr_text: v.ocr.text.slice(0, 2000),
        embedding: vector, upi_ids: v.entities.upiIds, phones: v.entities.phones,
        risk_score: v.riskScore, created_at: new Date().toISOString(),
      }]).catch(() => {})
      nearest = (await scamCorpusNearest(vector, 6).catch(() => [])).map((n) => ({ id: n.id, title: n.label, url: '', confidence: 1 - n.distance / 2, confidenceBand: n.distance < 0.4 ? 'high' : n.distance < 0.7 ? 'medium' : 'low' }))
    }
  }
  return NextResponse.json({ fingerprint: v.fingerprint, campaignLabel: v.campaignLabel, verdict: v.verdict, riskScore: v.riskScore, category: v.classification.category, nearest, estCostUsd: v.estCostUsd }, { headers: { 'Cache-Control': 'no-store' } })
})
