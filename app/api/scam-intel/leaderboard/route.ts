// GET /api/scam-intel/leaderboard?days=90   (ADMIN)
// Live scam-intelligence leaderboard (goal 8) from the BigQuery scam_corpus:
// top spoofed brands, scam domains, UPI IDs, phone numbers, campaigns, and
// fastest-growing campaigns (7-day velocity).
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { scamLeaderboard, bigQueryReady } from '@/lib/store/bigquery'
import { jsonRoute } from '@/lib/api/json'

export const dynamic = 'force-dynamic'

export const GET = jsonRoute('scam-intel/leaderboard', async (req) => {
  const auth = requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!bigQueryReady()) return NextResponse.json({ error: 'not_configured', detail: 'BigQuery required' }, { status: 503 })
  const days = Math.max(1, Math.min(365, Number(new URL(req.url).searchParams.get('days')) || 90))
  return NextResponse.json({ windowDays: days, ...(await scamLeaderboard(days)) })
})
