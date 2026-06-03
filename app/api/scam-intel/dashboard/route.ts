// GET /api/scam-intel/dashboard?days=30   (ADMIN)
// Evaluation dashboard for multimodal ScamCheck (goal 10): totals, verdict +
// category distribution, OCR failures, deep-vision usage, avg risk/scam
// probability, entity totals, daily trend — from BigQuery scam_image_analysis.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { imageDashboard, bigQueryReady } from '@/lib/store/bigquery'
import { retrievalSummary } from '@/lib/intelligence/metrics'
import { costToday } from '@/lib/ai/usage'
import { jsonRoute } from '@/lib/api/json'

export const dynamic = 'force-dynamic'

export const GET = jsonRoute('scam-intel/dashboard', async (req) => {
  const auth = requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!bigQueryReady()) return NextResponse.json({ error: 'not_configured', detail: 'BigQuery required' }, { status: 503 })
  const days = Math.max(1, Math.min(365, Number(new URL(req.url).searchParams.get('days')) || 30))
  const [images, spend] = await Promise.all([
    imageDashboard(days),
    costToday().catch(() => ({ totalUsd: 0, byTier: {} })),
  ])
  return NextResponse.json({
    windowDays: days,
    images,
    retrieval: retrievalSummary(24 * 60),
    spend: { ...spend, estimatedInr: Math.round(spend.totalUsd * 83 * 100) / 100 },
  })
})
