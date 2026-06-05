'use client'
// Lead analytics dashboard (client). Admin-token gated; reads /api/admin/leads
// (leads + newsletter) and writes status/notes via /api/admin/leads/update.
// Sections: LEADS, NEWSLETTER, ATTRIBUTION, EXPORTS. Read/measure only — does
// not touch any site content, SEO, robots, sitemap, canonicals or indexing.
import { useCallback, useEffect, useMemo, useState } from 'react'

type Row = {
  id: string; collection: string; name: string; email: string; service: string;
  message: string; source: string; createdAt: string; status: string; notes: string; spam: boolean
}
type Payload = { leads: Row[]; newsletter: Row[] }
const STATUSES = ['New', 'Contacted', 'Qualified', 'Won', 'Lost'] as const
const STATUS_COLOR: Record<string, string> = {
  New: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  Contacted: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  Qualified: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  Won: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  Lost: 'bg-zinc-700/40 text-zinc-400 border-zinc-600/40',
}
const TOKEN_KEY = 'asq_admin_token'

// ── helpers ───────────────────────────────────────────────────────────────
const fmtDate = (iso: string) => (iso ? iso.slice(0, 10) : '—')
const fmtDateTime = (iso: string) => (iso ? iso.replace('T', ' ').slice(0, 16) : '—')
const dayKey = (iso: string) => (iso || '').slice(0, 10)
const monthKey = (iso: string) => (iso || '').slice(0, 7)
function weekKey(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso); if (isNaN(+d)) return ''
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day + 3)
  const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((+t - +first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}
function countBy<T>(rows: T[], key: (r: T) => string): [string, number][] {
  const m = new Map<string, number>()
  for (const r of rows) { const k = key(r); if (!k) continue; m.set(k, (m.get(k) || 0) + 1) }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}
const within = (iso: string, days: number) => {
  if (!iso) return false
  return (Date.now() - +new Date(iso)) <= days * 86400000
}
const shortSource = (s: string) => {
  if (!s) return '(direct)'
  try { const u = new URL(s); return (u.pathname || '/').replace(/\/$/, '') || '/' } catch { return s.slice(0, 40) }
}
function toCSV(rows: Record<string, unknown>[], cols: string[]): string {
  const esc = (v: unknown) => {
    let s = String(v ?? '')
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}` // neutralise CSV/Excel formula injection from public form input
    return `"${s.replace(/"/g, '""')}"`
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n')
}
function download(name: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}

// ── UI atoms ──────────────────────────────────────────────────────────────
function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      {sub && <div className="text-xs text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  )
}
function BarList({ title, data, total }: { title: string; data: [string, number][]; total: number }) {
  const max = data[0]?.[1] || 1
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wide">{title}</div>
      {data.length === 0 && <div className="text-xs text-zinc-600">No data</div>}
      <div className="space-y-2">
        {data.slice(0, 12).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <div className="w-40 shrink-0 truncate text-zinc-300" title={k}>{k || '(none)'}</div>
            <div className="flex-1 h-2 bg-zinc-800 rounded overflow-hidden">
              <div className="h-full bg-sky-500/70 rounded" style={{ width: `${(v / max) * 100}%` }} />
            </div>
            <div className="w-14 text-right tabular-nums text-zinc-400">
              {v}{total ? <span className="text-zinc-600"> · {Math.round((v / total) * 100)}%</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────
export default function LeadsDashboard() {
  const [token, setToken] = useState('')
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [hideSpam, setHideSpam] = useState(false)

  useEffect(() => { try { setToken(localStorage.getItem(TOKEN_KEY) || '') } catch {} }, [])

  const load = useCallback(async (tok: string) => {
    if (!tok) { setError('Enter the admin token.'); return }
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/admin/leads', { headers: { Authorization: `Bearer ${tok}` }, cache: 'no-store' })
      if (r.status === 401) { setError('Unauthorized — token is wrong or ADMIN_API_TOKEN is not set on the server.'); setData(null); return }
      if (!r.ok) { setError(`Request failed (${r.status}).`); setData(null); return }
      const j = await r.json() as Payload
      setData(j)
      try { localStorage.setItem(TOKEN_KEY, tok) } catch {}
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (token) load(token) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateRow = useCallback(async (row: Row, patch: { status?: string; notes?: string }) => {
    setData((d) => d && ({
      leads: d.leads.map((x) => x.id === row.id && x.collection === row.collection ? { ...x, ...patch } : x),
      newsletter: d.newsletter.map((x) => x.id === row.id && x.collection === row.collection ? { ...x, ...patch } : x),
    }))
    try {
      await fetch('/api/admin/leads/update', {
        method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ collection: row.collection, id: row.id, ...patch }),
      })
    } catch {}
  }, [token])

  // date + search + status + spam filtering
  const inRange = useCallback((iso: string) => {
    const d = dayKey(iso)
    if (from && d < from) return false
    if (to && d > to) return false
    return true
  }, [from, to])

  const allLeads = data?.leads ?? []
  const allNews = data?.newsletter ?? []

  const leads = useMemo(() => allLeads.filter((r) => {
    if (!inRange(r.createdAt)) return false
    if (hideSpam && r.spam) return false
    if (statusFilter && (r.status || 'New') !== statusFilter) return false
    if (q) { const s = `${r.name} ${r.email} ${r.service} ${r.source} ${r.message}`.toLowerCase(); if (!s.includes(q.toLowerCase())) return false }
    return true
  }), [allLeads, inRange, hideSpam, statusFilter, q])

  const news = useMemo(() => allNews.filter((r) => {
    if (!inRange(r.createdAt)) return false
    if (q) { const s = `${r.name} ${r.email} ${r.source}`.toLowerCase(); if (!s.includes(q.toLowerCase())) return false }
    return true
  }), [allNews, inRange, q])

  // attribution / funnel
  const wonCount = leads.filter((r) => r.status === 'Won').length
  const qualifiedCount = leads.filter((r) => ['Qualified', 'Won'].includes(r.status)).length
  const spamCount = leads.filter((r) => r.spam).length

  if (!data) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-1">Lead analytics</h2>
        <p className="text-sm text-zinc-500 mb-4">Enter the admin API token (server env <code className="text-zinc-400">ADMIN_API_TOKEN</code>) to load leads &amp; subscribers.</p>
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Admin token"
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white mb-3" />
        <button onClick={() => load(token)} disabled={loading}
          className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg px-4 py-2">
          {loading ? 'Loading…' : 'Load dashboard'}
        </button>
        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm sticky top-0 z-10">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / email / source…"
          className="flex-1 min-w-[180px] bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-white" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200">
          <option value="">All status</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-1 text-zinc-400">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200" /></label>
        <label className="flex items-center gap-1 text-zinc-400">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200" /></label>
        <label className="flex items-center gap-1 text-zinc-400"><input type="checkbox" checked={hideSpam} onChange={(e) => setHideSpam(e.target.checked)} />Hide spam</label>
        <button onClick={() => { setQ(''); setStatusFilter(''); setFrom(''); setTo(''); setHideSpam(false) }} className="text-zinc-500 hover:text-zinc-300 underline">Reset</button>
        <button onClick={() => load(token)} className="text-sky-400 hover:text-sky-300 underline">↻ Refresh</button>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Kpi label="Total leads" value={leads.length} sub={`${spamCount} flagged spam`} />
        <Kpi label="Leads · 7d" value={leads.filter((r) => within(r.createdAt, 7)).length} />
        <Kpi label="Leads · 30d" value={leads.filter((r) => within(r.createdAt, 30)).length} />
        <Kpi label="Subscribers" value={news.length} sub={`${news.filter((r) => within(r.createdAt, 30)).length} in 30d`} />
        <Kpi label="Qualified+" value={qualifiedCount} />
        <Kpi label="Won" value={wonCount} sub={leads.length ? `${Math.round((wonCount / leads.length) * 100)}% of leads` : ''} />
      </section>

      {/* LEADS analytics */}
      <section>
        <h2 className="text-sm font-bold text-sky-400 uppercase tracking-wider mb-3">Leads</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <BarList title="By day" data={countBy(leads, (r) => dayKey(r.createdAt))} total={leads.length} />
          <BarList title="By week" data={countBy(leads, (r) => weekKey(r.createdAt))} total={leads.length} />
          <BarList title="By source page" data={countBy(leads, (r) => shortSource(r.source))} total={leads.length} />
          <BarList title="By service" data={countBy(leads, (r) => r.service || '(none)')} total={leads.length} />
        </div>
        <LeadTable rows={leads} onUpdate={updateRow} />
      </section>

      {/* NEWSLETTER */}
      <section>
        <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-3">Newsletter</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <Kpi label="Total subscribers" value={news.length} />
          <BarList title="By day" data={countBy(news, (r) => dayKey(r.createdAt))} total={news.length} />
          <BarList title="By month" data={countBy(news, (r) => monthKey(r.createdAt))} total={news.length} />
          <BarList title="By source page" data={countBy(news, (r) => shortSource(r.source))} total={news.length} />
        </div>
        <SubTable rows={news.slice(0, 100)} />
      </section>

      {/* ATTRIBUTION */}
      <section>
        <h2 className="text-sm font-bold text-violet-400 uppercase tracking-wider mb-3">Attribution</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <BarList title="Top converting pages" data={countBy(leads, (r) => shortSource(r.source))} total={leads.length} />
          <BarList title="Top converting services" data={countBy(leads, (r) => r.service || '(none)')} total={leads.length} />
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wide">Conversion funnel</div>
            {([
              ['Subscribers', news.length, 'bg-emerald-500/70'],
              ['Leads', leads.length, 'bg-sky-500/70'],
              ['Qualified+', qualifiedCount, 'bg-violet-500/70'],
              ['Won', wonCount, 'bg-amber-500/70'],
            ] as [string, number, string][]).map(([label, val, color], i, arr) => {
              const top = Math.max(...arr.map((a) => a[1] as number), 1)
              return (
                <div key={label} className="mb-2">
                  <div className="flex justify-between text-xs text-zinc-300 mb-0.5"><span>{label}</span><span className="tabular-nums">{val}</span></div>
                  <div className="h-3 bg-zinc-800 rounded overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${(val / top) * 100}%` }} /></div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* EXPORTS */}
      <section>
        <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-3">Exports</h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => download(`leads_${new Date().toISOString().slice(0, 10)}.csv`,
            toCSV(leads as unknown as Record<string, unknown>[], ['createdAt', 'name', 'email', 'service', 'source', 'status', 'spam', 'notes', 'message', 'id']))}
            className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-sm rounded-lg px-4 py-2">⬇ Export leads CSV ({leads.length})</button>
          <button onClick={() => download(`newsletter_${new Date().toISOString().slice(0, 10)}.csv`,
            toCSV(news as unknown as Record<string, unknown>[], ['createdAt', 'name', 'email', 'source', 'id']))}
            className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-sm rounded-lg px-4 py-2">⬇ Export subscribers CSV ({news.length})</button>
        </div>
        <p className="text-xs text-zinc-600 mt-2">Exports respect the current search, status, date and spam filters.</p>
      </section>
    </div>
  )
}

// ── tables ────────────────────────────────────────────────────────────────
function LeadTable({ rows, onUpdate }: { rows: Row[]; onUpdate: (r: Row, p: { status?: string; notes?: string }) => void }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-x-auto">
      <table className="w-full text-xs min-w-[820px]">
        <thead className="text-zinc-500 border-b border-zinc-800">
          <tr>{['Date', 'Name', 'Email', 'Service', 'Source', 'Status', 'Notes', ''].map((h) => <th key={h} className="text-left font-medium px-3 py-2">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-zinc-600">No leads match the filters.</td></tr>}
          {rows.slice(0, 300).map((r) => (
            <tr key={`${r.collection}/${r.id}`} className="border-b border-zinc-800/60 hover:bg-zinc-800/30 align-top">
              <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
              <td className="px-3 py-2 text-zinc-200">{r.spam && <span title="Possible spam" className="mr-1 text-red-400">⚠</span>}{r.name || '—'}</td>
              <td className="px-3 py-2 text-zinc-300"><a className="hover:text-sky-400" href={`mailto:${r.email}`}>{r.email}</a></td>
              <td className="px-3 py-2 text-zinc-400">{r.service || '—'}</td>
              <td className="px-3 py-2 text-zinc-500 max-w-[160px] truncate" title={r.source}>{shortSource(r.source)}</td>
              <td className="px-3 py-2">
                <select value={r.status || 'New'} onChange={(e) => onUpdate(r, { status: e.target.value })}
                  className={`rounded border px-1.5 py-1 ${STATUS_COLOR[r.status || 'New']}`}>
                  {STATUSES.map((s) => <option key={s} value={s} className="bg-zinc-900 text-white">{s}</option>)}
                </select>
              </td>
              <td className="px-3 py-2 min-w-[160px]">
                <input defaultValue={r.notes} placeholder="Add note…" onBlur={(e) => { if (e.target.value !== r.notes) onUpdate(r, { notes: e.target.value }) }}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-200" />
              </td>
              <td className="px-3 py-2 text-zinc-600 whitespace-nowrap">{r.collection === '_contact' ? 'contact' : 'lead'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 300 && <div className="text-xs text-zinc-600 px-3 py-2">Showing first 300 of {rows.length}. Narrow with filters or export CSV.</div>}
    </div>
  )
}
function SubTable({ rows }: { rows: Row[] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-x-auto">
      <table className="w-full text-xs min-w-[520px]">
        <thead className="text-zinc-500 border-b border-zinc-800"><tr>{['Date', 'Name', 'Email', 'Source'].map((h) => <th key={h} className="text-left font-medium px-3 py-2">{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-zinc-600">No subscribers match the filters.</td></tr>}
          {rows.map((r) => (
            <tr key={`${r.collection}/${r.id}`} className="border-b border-zinc-800/60 hover:bg-zinc-800/30">
              <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
              <td className="px-3 py-2 text-zinc-200">{r.name || '—'}</td>
              <td className="px-3 py-2 text-zinc-300">{r.email}</td>
              <td className="px-3 py-2 text-zinc-500 max-w-[200px] truncate" title={r.source}>{shortSource(r.source)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
