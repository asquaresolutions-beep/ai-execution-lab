'use client'
// asq-newsletter-dash-v1 — Newsletter analytics dashboard (client, admin-token
// gated). Reads the existing /api/admin/newsletter-metrics (no new collection,
// no external services). Pure CSS/SVG charts — no chart library. Read-only.
// Sections: over-time · by verdict · by device · conversion by verdict ·
// daily trend · weekly trend · top acquisition source · top pages.
import { useCallback, useEffect, useState } from 'react'

const TOKEN_KEY = 'asq_admin_token'

type Rank = { key: string; count: number }
type Trend = { key: string; count: number }
type Metrics = {
  total: number
  byVerdict: Record<'scam' | 'safe' | 'suspicious' | 'unknown', number>
  byDevice: Record<'mobile' | 'tablet' | 'desktop', number>
  bySource: Record<string, number>
  conversionByVerdict: Record<'scam' | 'safe' | 'suspicious', number>
  scanSourcedTotal: number
  generatedAt: string
  trends: { daily: Trend[]; weekly: Trend[]; cumulative: Trend[]; topSources: Rank[]; windowDays: number }
  recent: { email: string; verdict: string; source: string; device: string; createdAt: string }[]
}

// Friendly label for a source token (scan surface / blog post / other).
function pageLabel(src: string): string {
  if (!src || src === 'unknown') return '(direct / unknown)'
  if (src.startsWith('blog:')) return `Blog · ${src.slice(5)}`
  if (src === 'scan-result-quick') return 'Scan result · quick analyzer'
  if (src === 'scan-result-screenshot') return 'Scan result · screenshot'
  return src
}
const VERDICT_COLOR: Record<string, string> = {
  scam: 'bg-red-500/70', suspicious: 'bg-amber-500/70', safe: 'bg-emerald-500/70', unknown: 'bg-zinc-500/70',
}

// ── atoms ───────────────────────────────────────────────────────────────────
function Card({ title, children, sub }: { title: string; children: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wide">{title}</div>
      {sub && <div className="-mt-2 mb-2 text-[11px] text-zinc-600">{sub}</div>}
      {children}
    </div>
  )
}
function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      {sub && <div className="text-xs text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  )
}
function BarList({ data, total, color = 'bg-sky-500/70', label }: { data: Rank[]; total: number; color?: string; label?: (k: string) => string }) {
  const max = data[0]?.count || 1
  if (data.length === 0) return <div className="text-xs text-zinc-600">No data yet</div>
  return (
    <div className="space-y-2">
      {data.slice(0, 12).map((d) => (
        <div key={d.key} className="flex items-center gap-2 text-xs">
          <div className="w-36 shrink-0 truncate text-zinc-300" title={label ? label(d.key) : d.key}>{label ? label(d.key) : d.key}</div>
          <div className="flex-1 h-2 bg-zinc-800 rounded overflow-hidden"><div className={`h-full ${color} rounded`} style={{ width: `${(d.count / max) * 100}%` }} /></div>
          <div className="w-16 text-right tabular-nums text-zinc-400">{d.count}{total ? <span className="text-zinc-600"> · {Math.round((d.count / total) * 100)}%</span> : null}</div>
        </div>
      ))}
    </div>
  )
}
function ConvBars({ conv }: { conv: Record<'scam' | 'safe' | 'suspicious', number> }) {
  const rows: ['scam' | 'safe' | 'suspicious', number][] = [['scam', conv.scam], ['suspicious', conv.suspicious], ['safe', conv.safe]]
  return (
    <div className="space-y-3">
      {rows.map(([k, v]) => (
        <div key={k}>
          <div className="flex justify-between text-xs mb-0.5"><span className="capitalize text-zinc-300">{k}</span><span className="tabular-nums text-zinc-400">{v}%</span></div>
          <div className="h-3 bg-zinc-800 rounded overflow-hidden"><div className={`h-full ${VERDICT_COLOR[k]}`} style={{ width: `${Math.min(100, v)}%` }} /></div>
        </div>
      ))}
      <p className="text-[11px] text-zinc-600">Share of scan-sourced subscribers (scam + suspicious + safe = 100%).</p>
    </div>
  )
}
// Vertical bar chart (daily/weekly trend), horizontally scrollable on small screens.
function VBars({ data, color = 'bg-sky-500/70' }: { data: Trend[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  if (data.every((d) => d.count === 0)) return <div className="text-xs text-zinc-600">No signups in this window yet</div>
  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1 h-28 min-w-full">
        {data.map((d) => (
          <div key={d.key} className="flex-1 min-w-[6px] flex flex-col justify-end group relative" title={`${d.key}: ${d.count}`}>
            <div className={`${color} rounded-t`} style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-zinc-600 mt-1"><span>{data[0]?.key}</span><span>{data[data.length - 1]?.key}</span></div>
    </div>
  )
}
// SVG cumulative area (subscribers over time).
function Sparkline({ data }: { data: Trend[] }) {
  if (data.length < 2) return <div className="text-xs text-zinc-600">Not enough data</div>
  const W = 600, H = 120, pad = 4
  const max = Math.max(1, ...data.map((d) => d.count))
  const min = Math.min(...data.map((d) => d.count))
  const x = (i: number) => pad + (i / (data.length - 1)) * (W - 2 * pad)
  const y = (v: number) => H - pad - ((v - min) / Math.max(1, max - min)) * (H - 2 * pad)
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.count).toFixed(1)}`).join(' ')
  const area = `${line} L${x(data.length - 1).toFixed(1)},${H - pad} L${x(0).toFixed(1)},${H - pad} Z`
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-28">
        <path d={area} fill="rgba(14,165,233,0.15)" />
        <path d={line} fill="none" stroke="#38bdf8" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
        <span>{data[0]?.key} · {data[0]?.count}</span>
        <span>{data[data.length - 1]?.key} · {data[data.length - 1]?.count}</span>
      </div>
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────
export default function NewsletterDashboard() {
  const [token, setToken] = useState('')
  const [data, setData] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { try { setToken(localStorage.getItem(TOKEN_KEY) || '') } catch {} }, [])

  const load = useCallback(async (tok: string) => {
    if (!tok) { setError('Enter the admin token.'); return }
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/admin/newsletter-metrics', { headers: { Authorization: `Bearer ${tok}` }, cache: 'no-store' })
      if (r.status === 401) { setError('Unauthorized — token is wrong or ADMIN_API_TOKEN is not set on the server.'); setData(null); return }
      if (!r.ok) { setError(`Request failed (${r.status}).`); setData(null); return }
      const j = await r.json() as Metrics
      setData(j)
      try { localStorage.setItem(TOKEN_KEY, tok) } catch {}
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (token) load(token) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-1">Newsletter analytics</h2>
        <p className="text-sm text-zinc-500 mb-4">Enter the admin API token (server env <code className="text-zinc-400">ADMIN_API_TOKEN</code>) to load subscriber analytics.</p>
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Admin token" onKeyDown={(e) => { if (e.key === 'Enter') load(token) }}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white mb-3" />
        <button onClick={() => load(token)} disabled={loading}
          className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg px-4 py-2">
          {loading ? 'Loading…' : 'Load dashboard'}
        </button>
        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
      </div>
    )
  }

  const v = data.byVerdict, dev = data.byDevice, t = data.trends
  const verdictRanks: Rank[] = [
    { key: 'scam', count: v.scam }, { key: 'suspicious', count: v.suspicious },
    { key: 'safe', count: v.safe }, { key: 'unknown', count: v.unknown },
  ].filter((r) => r.count > 0).sort((a, b) => b.count - a.count)
  const deviceRanks: Rank[] = (['mobile', 'desktop', 'tablet'] as const).map((k) => ({ key: k, count: dev[k] })).filter((r) => r.count > 0)
  const newest = t.daily.slice(-7).reduce((n, d) => n + d.count, 0)
  const prev7 = t.daily.slice(-14, -7).reduce((n, d) => n + d.count, 0)

  return (
    <div className="space-y-6">
      {/* refresh */}
      <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
        <span>Updated {data.generatedAt.replace('T', ' ').slice(0, 16)} UTC</span>
        <button onClick={() => load(token)} className="text-sky-400 hover:text-sky-300 underline">↻ Refresh</button>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total subscribers" value={data.total} />
        <Kpi label="Last 7 days" value={newest} sub={prev7 ? `${newest >= prev7 ? '▲' : '▼'} vs ${prev7} prior 7d` : 'new'} />
        <Kpi label="Scan-sourced" value={data.scanSourcedTotal} sub={data.total ? `${Math.round((data.scanSourcedTotal / data.total) * 100)}% of total` : ''} />
        <Kpi label="Top verdict" value={verdictRanks[0]?.key ?? '—'} sub={verdictRanks[0] ? `${verdictRanks[0].count} subs` : ''} />
      </section>

      {/* 1. Subscribers over time */}
      <Card title="1 · Subscribers over time" sub={`Cumulative total, last ${t.windowDays} days`}><Sparkline data={t.cumulative} /></Card>

      {/* 2,3,4 */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="2 · Subscribers by verdict"><BarList data={verdictRanks} total={data.total} color="bg-violet-500/70" /></Card>
        <Card title="3 · Subscribers by device"><BarList data={deviceRanks} total={data.total} color="bg-cyan-500/70" /></Card>
        <Card title="4 · Conversion rate by verdict"><ConvBars conv={data.conversionByVerdict} /></Card>
      </section>

      {/* 5,6 trends */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="5 · Daily trend" sub={`Signups per day, last ${t.windowDays} days`}><VBars data={t.daily} /></Card>
        <Card title="6 · Weekly trend" sub="Signups per ISO week, last 12 weeks"><VBars data={t.weekly} color="bg-emerald-500/70" /></Card>
      </section>

      {/* 7,8 acquisition */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="7 · Top acquisition source"><BarList data={t.topSources} total={data.total} /></Card>
        <Card title="8 · Top converting pages" sub="By signups. Per-checker attribution needs a page field on capture (see notes).">
          <BarList data={t.topSources} total={data.total} color="bg-amber-500/70" label={pageLabel} />
        </Card>
      </section>
    </div>
  )
}
