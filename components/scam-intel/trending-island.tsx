'use client'

// Live "Trending Scam Campaigns" island. Fetches the public leaderboard and
// degrades silently to nothing if unavailable — the page's curated catalog is
// the SEO content; this is progressive enhancement.
import { useEffect, useState } from 'react'

interface LB { live: boolean; topBrands?: { k: string; n: number }[]; topCampaigns?: { k: string; n: number; slug?: string }[]; fastestGrowing?: { label: string; last7d: number; total: number }[] }

export function TrendingIsland() {
  const [lb, setLb] = useState<LB | null>(null)
  useEffect(() => {
    fetch('/api/scam-intel/public-leaderboard').then((r) => r.json()).then(setLb).catch(() => {})
  }, [])
  if (!lb) return null
  const growing = lb.fastestGrowing?.filter((g) => g.total > 0) ?? []
  const brands = lb.topBrands?.slice(0, 10) ?? []
  if (!lb.live && !brands.length) return null
  return (
    <section className="mt-10 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-zinc-100">Trending scam campaigns</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs ${lb.live ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-700/40 text-zinc-400'}`}>{lb.live ? 'live' : 'overview'}</span>
      </div>
      {growing.length > 0 && (
        <div className="mt-3">
          <h3 className="text-sm font-medium text-zinc-400">Fastest-growing (7 days)</h3>
          <ul className="mt-1 space-y-1 text-sm text-zinc-300">
            {growing.slice(0, 6).map((g, i) => <li key={i}>{g.label} <span className="text-zinc-500">· {g.last7d} new / {g.total} total</span></li>)}
          </ul>
        </div>
      )}
      {brands.length > 0 && (
        <div className="mt-3">
          <h3 className="text-sm font-medium text-zinc-400">Most spoofed brands</h3>
          <div className="mt-1 flex flex-wrap gap-2">
            {brands.map((b, i) => <span key={i} className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">{b.k}{b.n ? ` (${b.n})` : ''}</span>)}
          </div>
        </div>
      )}
    </section>
  )
}
