'use client'
// SEO opportunity dashboard (client, reporting-only). Upload Google Search
// Console "Pages" CSV exports (Current, and optionally a Previous period for
// trend comparison). Computes CTR opportunities (impressions>100, CTR<1%,
// position 5–20) ranked by estimated traffic gain, plus rising / declining /
// gaining-impressions / losing-impressions movers. NOTHING is written or
// published — this never touches titles, meta, content, robots or indexing.
import { useMemo, useState } from 'react'

type Page = { url: string; clicks: number; impressions: number; ctr: number; position: number }
type Opp = Page & { expectedCtr: number; gain: number }

// Organic CTR-by-position benchmark (approx, desktop+mobile blended).
function expectedCtr(pos: number): number {
  const p = Math.round(pos)
  const table: Record<number, number> = { 1: .28, 2: .15, 3: .10, 4: .07, 5: .055, 6: .045, 7: .037, 8: .031, 9: .027, 10: .024 }
  if (p <= 10) return table[Math.max(1, p)] ?? .024
  if (p <= 15) return .018
  if (p <= 20) return .012
  return .008
}

function parseCtr(raw: string): number {
  const s = (raw || '').trim()
  if (s.endsWith('%')) return (parseFloat(s) || 0) / 100
  const n = parseFloat(s) || 0
  return n > 1 ? n / 100 : n
}
function parseNum(raw: string): number { return parseFloat((raw || '').replace(/[,%\s]/g, '')) || 0 }

// Minimal CSV line splitter (handles quoted fields).
function splitCsvLine(line: string): string[] {
  const out: string[] = []; let cur = ''; let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++ } else inQ = !inQ }
    else if (c === ',' && !inQ) { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur); return out
}
function parseGSC(text: string): Page[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return []
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim())
  const idx = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)))
  const iUrl = idx(['top pages', 'page', 'url', 'address']) >= 0 ? idx(['top pages', 'page', 'url', 'address']) : 0
  const iClk = idx(['click']); const iImp = idx(['impress']); const iCtr = idx(['ctr']); const iPos = idx(['position'])
  const rows: Page[] = []
  for (let i = 1; i < lines.length; i++) {
    const c = splitCsvLine(lines[i]); if (!c[iUrl]) continue
    const impressions = iImp >= 0 ? parseNum(c[iImp]) : 0
    const clicks = iClk >= 0 ? parseNum(c[iClk]) : 0
    rows.push({
      url: c[iUrl].trim(),
      clicks, impressions,
      ctr: iCtr >= 0 ? parseCtr(c[iCtr]) : (impressions ? clicks / impressions : 0),
      position: iPos >= 0 ? parseNum(c[iPos]) : 0,
    })
  }
  return rows
}

const pctl = (n: number) => `${(n * 100).toFixed(2)}%`
const short = (u: string) => { try { const x = new URL(u); return (x.pathname || '/').replace(/\/$/, '') || '/' } catch { return u } }

function toCSV(rows: Record<string, unknown>[], cols: string[]): string {
  const esc = (v: unknown) => {
    let s = String(v ?? '')
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}` // neutralise CSV/Excel formula injection
    return `"${s.replace(/"/g, '""')}"`
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n')
}
function download(name: string, text: string) {
  const b = new Blob([text], { type: 'text/csv;charset=utf-8' }); const u = URL.createObjectURL(b)
  const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u)
}

function Drop({ label, onText, loaded }: { label: string; onText: (t: string, name: string) => void; loaded?: string }) {
  return (
    <label className="flex-1 min-w-[220px] cursor-pointer bg-zinc-900 border border-dashed border-zinc-700 hover:border-sky-600 rounded-lg p-4 block">
      <div className="text-xs font-medium text-zinc-300">{label}</div>
      <div className="text-[11px] text-zinc-500 mt-0.5">{loaded ? `✓ ${loaded}` : 'Click to choose a GSC Pages CSV'}</div>
      <input type="file" accept=".csv,text/csv" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => onText(String(r.result || ''), f.name); r.readAsText(f) }} />
    </label>
  )
}
function Table({ title, rows, cols, render }: { title: string; rows: Record<string, unknown>[]; cols: string[]; render: (r: Record<string, unknown>) => React.ReactNode[] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-x-auto">
      <div className="text-xs font-semibold text-zinc-300 px-3 py-2 border-b border-zinc-800">{title} <span className="text-zinc-600">({rows.length})</span></div>
      <table className="w-full text-xs min-w-[560px]">
        <thead className="text-zinc-500 border-b border-zinc-800"><tr>{cols.map((c) => <th key={c} className="text-left font-medium px-3 py-2">{c}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={cols.length} className="px-3 py-5 text-center text-zinc-600">No rows</td></tr>}
          {rows.slice(0, 100).map((r, i) => <tr key={i} className="border-b border-zinc-800/60 hover:bg-zinc-800/30">{render(r).map((cell, j) => <td key={j} className="px-3 py-2 text-zinc-300 align-top">{cell}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}

export default function SeoOpportunities() {
  const [cur, setCur] = useState<Page[]>([]); const [curName, setCurName] = useState('')
  const [prev, setPrev] = useState<Page[]>([]); const [prevName, setPrevName] = useState('')

  // Opportunities: impressions>100, CTR<1%, position 5–20, ranked by est. gain.
  const opps: Opp[] = useMemo(() => cur
    .filter((p) => p.impressions > 100 && p.ctr < 0.01 && p.position >= 5 && p.position <= 20)
    .map((p) => { const ex = expectedCtr(p.position); return { ...p, expectedCtr: ex, gain: Math.max(0, Math.round(p.impressions * (ex - p.ctr))) } })
    .sort((a, b) => b.gain - a.gain), [cur])

  const totalGain = opps.reduce((s, o) => s + o.gain, 0)

  // Trend movers (need both periods, matched by URL).
  const trends = useMemo(() => {
    if (!prev.length || !cur.length) return null
    const pm = new Map(prev.map((p) => [p.url, p]))
    const merged = cur.map((c) => { const p = pm.get(c.url); return { ...c, prevImpr: p?.impressions ?? 0, prevPos: p?.position ?? 0, prevClicks: p?.clicks ?? 0, hadPrev: !!p } })
    const seen = new Set(cur.map((c) => c.url))
    const dropped = prev.filter((p) => !seen.has(p.url)).map((p) => ({ ...p, prevImpr: p.impressions, prevPos: p.position, prevClicks: p.clicks, impressions: 0, clicks: 0, position: 0, ctr: 0, hadPrev: true }))
    const all = [...merged, ...dropped]
    const rising = all.filter((r) => r.hadPrev && r.prevPos > 0 && r.position > 0 && (r.prevPos - r.position) >= 0.3).sort((a, b) => (b.prevPos - b.position) - (a.prevPos - a.position))
    const declining = all.filter((r) => r.hadPrev && r.prevPos > 0 && r.position > 0 && (r.position - r.prevPos) >= 0.3).sort((a, b) => (b.position - b.prevPos) - (a.position - a.prevPos))
    const gaining = all.filter((r) => (r.impressions - r.prevImpr) > 0).sort((a, b) => (b.impressions - b.prevImpr) - (a.impressions - a.prevImpr))
    const losing = all.filter((r) => (r.impressions - r.prevImpr) < 0).sort((a, b) => (a.impressions - a.prevImpr) - (b.impressions - b.prevImpr))
    return { rising, declining, gaining, losing }
  }, [cur, prev])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Drop label="Current period — GSC Pages CSV (required)" onText={(t, n) => { setCur(parseGSC(t)); setCurName(`${n} · ${parseGSC(t).length} pages`) }} loaded={curName} />
        <Drop label="Previous period — GSC Pages CSV (optional, for trends)" onText={(t, n) => { setPrev(parseGSC(t)); setPrevName(`${n} · ${parseGSC(t).length} pages`) }} loaded={prevName} />
      </div>

      {cur.length === 0 && (
        <div className="text-sm text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          Export from Search Console → <span className="text-zinc-300">Performance → Pages tab → Export → CSV</span>, then upload it above.
          Add a second export from an earlier date range to see rising/declining and impression movers. Everything runs in your browser — nothing is uploaded or changed.
        </div>
      )}

      {cur.length > 0 && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"><div className="text-xs text-zinc-500">Pages analysed</div><div className="text-2xl font-bold text-white tabular-nums">{cur.length}</div></div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"><div className="text-xs text-zinc-500">CTR opportunities</div><div className="text-2xl font-bold text-sky-400 tabular-nums">{opps.length}</div><div className="text-xs text-zinc-600">impr&gt;100 · CTR&lt;1% · pos 5–20</div></div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"><div className="text-xs text-zinc-500">Est. monthly clicks at stake</div><div className="text-2xl font-bold text-emerald-400 tabular-nums">+{totalGain.toLocaleString()}</div></div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"><div className="text-xs text-zinc-500">Total impressions</div><div className="text-2xl font-bold text-white tabular-nums">{cur.reduce((s, p) => s + p.impressions, 0).toLocaleString()}</div></div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-sky-400 uppercase tracking-wider">Best CTR opportunities — ranked by estimated traffic gain</h2>
              <button onClick={() => download('seo-opportunities.csv', toCSV(opps.map((o) => ({ url: o.url, impressions: o.impressions, clicks: o.clicks, ctr: pctl(o.ctr), position: o.position.toFixed(1), expectedCtr: pctl(o.expectedCtr), estGainClicks: o.gain })), ['url', 'impressions', 'clicks', 'ctr', 'position', 'expectedCtr', 'estGainClicks']))}
                className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-xs rounded-lg px-3 py-1.5">⬇ Export CSV</button>
            </div>
            <Table title="Opportunities" rows={opps as unknown as Record<string, unknown>[]} cols={['Page', 'Impr', 'CTR', 'Pos', 'Target CTR', 'Est. +clicks/mo']}
              render={(r) => { const o = r as unknown as Opp; return [
                <span title={o.url} className="block max-w-[260px] truncate">{short(o.url)}</span>,
                o.impressions.toLocaleString(), <span className="text-amber-400">{pctl(o.ctr)}</span>, o.position.toFixed(1),
                <span className="text-zinc-500">{pctl(o.expectedCtr)}</span>, <span className="text-emerald-400 font-semibold">+{o.gain.toLocaleString()}</span>,
              ] }} />
          </section>

          {trends ? (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-violet-400 uppercase tracking-wider">Weekly movers (current vs previous)</h2>
              <div className="grid lg:grid-cols-2 gap-3">
                <Table title="Rising (position improved)" rows={trends.rising as unknown as Record<string, unknown>[]} cols={['Page', 'Prev pos', 'Now pos', 'Δ']}
                  render={(r) => { const x = r as any; return [<span title={x.url} className="block max-w-[220px] truncate">{short(x.url)}</span>, x.prevPos.toFixed(1), x.position.toFixed(1), <span className="text-emerald-400">▲ {(x.prevPos - x.position).toFixed(1)}</span>] }} />
                <Table title="Declining (position worsened)" rows={trends.declining as unknown as Record<string, unknown>[]} cols={['Page', 'Prev pos', 'Now pos', 'Δ']}
                  render={(r) => { const x = r as any; return [<span title={x.url} className="block max-w-[220px] truncate">{short(x.url)}</span>, x.prevPos.toFixed(1), x.position.toFixed(1), <span className="text-red-400">▼ {(x.position - x.prevPos).toFixed(1)}</span>] }} />
                <Table title="Gaining impressions" rows={trends.gaining as unknown as Record<string, unknown>[]} cols={['Page', 'Prev', 'Now', 'Δ']}
                  render={(r) => { const x = r as any; return [<span title={x.url} className="block max-w-[220px] truncate">{short(x.url)}</span>, x.prevImpr.toLocaleString(), x.impressions.toLocaleString(), <span className="text-emerald-400">▲ {(x.impressions - x.prevImpr).toLocaleString()}</span>] }} />
                <Table title="Losing impressions" rows={trends.losing as unknown as Record<string, unknown>[]} cols={['Page', 'Prev', 'Now', 'Δ']}
                  render={(r) => { const x = r as any; return [<span title={x.url} className="block max-w-[220px] truncate">{short(x.url)}</span>, x.prevImpr.toLocaleString(), x.impressions.toLocaleString(), <span className="text-red-400">▼ {(x.prevImpr - x.impressions).toLocaleString()}</span>] }} />
              </div>
            </section>
          ) : (
            <p className="text-xs text-zinc-600">Upload a previous-period CSV to unlock rising / declining / impression-mover reports.</p>
          )}
        </>
      )}
    </div>
  )
}
