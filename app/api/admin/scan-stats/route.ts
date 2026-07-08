// GET /api/admin/scan-stats?from=YYYY-MM-DD&to=YYYY-MM-DD[&source=slug]   (ADMIN)
//
// Reads the `scan_metrics` counter docs and returns the per-source funnel:
//   embed_view → scan_start → scan_complete  (+ view→start / start→complete rates,
//   verdict mix, and avg risk score). Auth: Bearer ADMIN_API_TOKEN.
//
// This is the GA4-independent, on-demand funnel read the logging layer exists for.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getStore } from '@/lib/store/adapter'
import { SCAN_METRICS, metricDay } from '@/lib/scam-intel/scan-log'

export const dynamic = 'force-dynamic'

interface MetricDoc {
  date?: string
  source?: string
  event?: string
  kind?: string
  verdict?: string
  count?: number
  sum?: number
  n?: number
}

interface Agg {
  embed_view: number
  scan_start: number
  scan_complete: number
  verdicts: Record<string, number>
  risk_sum: number
  risk_n: number
}

export async function GET(req: Request) {
  if (!requireAdmin(req).ok) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const today = metricDay()
  // Default window: last 7 days (inclusive of today).
  const from = (url.searchParams.get('from') || metricDay(new Date(Date.now() - 6 * 86_400_000))).slice(0, 10)
  const to = (url.searchParams.get('to') || today).slice(0, 10)
  const sourceFilter = url.searchParams.get('source')

  let rows: { data: MetricDoc }[] = []
  try {
    rows = await getStore().query<MetricDoc>(SCAN_METRICS, {
      where: [
        { field: 'date', op: '>=', value: from },
        { field: 'date', op: '<=', value: to },
      ],
      limit: 5000,
    })
  } catch (err) {
    return NextResponse.json({ error: 'query_failed', detail: (err as Error).message }, { status: 500 })
  }

  const bySource: Record<string, Agg> = {}
  const ensure = (s: string): Agg => {
    if (!bySource[s]) bySource[s] = { embed_view: 0, scan_start: 0, scan_complete: 0, verdicts: {}, risk_sum: 0, risk_n: 0 }
    return bySource[s]
  }

  for (const { data: d } of rows) {
    const src = d.source || 'unknown'
    if (sourceFilter && src !== sourceFilter) continue
    const a = ensure(src)
    if (d.kind === 'verdict' && d.verdict) {
      a.verdicts[d.verdict] = (a.verdicts[d.verdict] || 0) + (d.count || 0)
    } else if (d.kind === 'risk') {
      a.risk_sum += d.sum || 0
      a.risk_n += d.n || 0
    } else if (d.event === 'embed_view') {
      a.embed_view += d.count || 0
    } else if (d.event === 'scan_start') {
      a.scan_start += d.count || 0
    } else if (d.event === 'scan_complete') {
      a.scan_complete += d.count || 0
    }
  }

  const pct = (num: number, den: number): number | null => (den > 0 ? Math.round((num / den) * 1000) / 10 : null)

  const sources = Object.entries(bySource)
    .map(([source, a]) => ({
      source,
      embed_view: a.embed_view,
      scan_start: a.scan_start,
      scan_complete: a.scan_complete,
      view_to_start_pct: pct(a.scan_start, a.embed_view),
      start_to_complete_pct: pct(a.scan_complete, a.scan_start),
      verdicts: a.verdicts,
      avg_risk: a.risk_n > 0 ? Math.round((a.risk_sum / a.risk_n) * 10) / 10 : null,
    }))
    .sort((x, y) => y.embed_view + y.scan_start - (x.embed_view + x.scan_start))

  const totals = sources.reduce(
    (t, f) => ({
      embed_view: t.embed_view + f.embed_view,
      scan_start: t.scan_start + f.scan_start,
      scan_complete: t.scan_complete + f.scan_complete,
    }),
    { embed_view: 0, scan_start: 0, scan_complete: 0 },
  )

  return NextResponse.json(
    { range: { from, to }, totals, sources },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
