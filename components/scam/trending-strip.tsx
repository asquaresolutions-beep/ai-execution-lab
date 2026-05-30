'use client'
// ─────────────────────────────────────────────────────────────────
// components/scam/trending-strip.tsx
// Surfaces LIVE trending scams on otherwise-static (SSG) pages.
//
// Static-first: the page ships as static HTML; this strip hydrates and
// fetches the CDN-cached /api/scam-intel/trending (one cheap read behind
// the cache). Renders nothing until data arrives → no layout shift, no
// hydration mismatch. Freshness/viral/active badges add freshness signals.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'

interface TrendingItem {
  clusterId: string
  title: string
  category: string
  severity: string
  reportCount: number
  viral: boolean
  active: boolean
  lastSeen: number
}

const CAT_SLUG: Record<string, string> = {
  upi_fraud: 'upi-fraud', otp_fraud: 'otp-fraud', kyc_fraud: 'kyc-fraud', phishing: 'phishing',
  fake_job: 'fake-job', investment_fraud: 'investment-fraud', loan_scam: 'loan-scam',
  courier_customs: 'courier-scam', lottery_prize: 'lottery-scam', tech_support: 'tech-support-scam',
  romance: 'romance-scam', whatsapp_scam: 'phishing',
}

export function TrendingStrip({ limit = 6 }: { limit?: number }) {
  const [items, setItems] = useState<TrendingItem[] | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/scam-intel/trending?limit=${limit}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => { if (alive) setItems(Array.isArray(d.items) ? d.items : []) })
      .catch(() => { if (alive) setItems([]) })
    return () => { alive = false }
  }, [limit])

  // Nothing to show (loading or empty) → render nothing (no CLS).
  if (!items || items.length === 0) return null

  return (
    <section className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">Trending scams now</h2>
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.clusterId} className="flex items-center justify-between gap-3 text-sm">
            <a href={`/scams/type/${CAT_SLUG[it.category] || 'phishing'}`} className="truncate text-neutral-200 hover:text-white">
              {it.title}
            </a>
            <span className="flex shrink-0 items-center gap-1.5 text-[11px]">
              {it.viral && <Badge tone="viral">🔥 viral</Badge>}
              {it.active && !it.viral && <Badge tone="active">● active</Badge>}
              <span className="text-neutral-500">{relative(it.lastSeen)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'viral' | 'active' }) {
  const cls = tone === 'viral' ? 'bg-red-500/15 text-red-300' : 'bg-green-500/15 text-green-300'
  return <span className={`rounded px-1.5 py-0.5 font-medium ${cls}`}>{children}</span>
}

function relative(ts: number): string {
  const h = Math.floor((Date.now() - ts) / 3_600_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
