'use client'
// ─────────────────────────────────────────────────────────────────
// components/scam/trending-ticker.tsx
// Above-the-fold auto-rotating trending-scams ticker for the homepage.
//
//  - Static-first: ships as fixed-height HTML with a neutral placeholder
//    line (same on server + first client render → no hydration mismatch).
//  - No CLS: the row height is reserved; rotation only swaps text inside it.
//  - CDN-friendly: single fetch of the cached /api/scam-intel/trending
//    snapshot (no realtime reads); rotates client-side every few seconds.
//  - Minimal JS: one interval, one fetch.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'

interface Item { clusterId: string; title: string; category: string; severity: string; viral: boolean; active: boolean; lastSeen: number }

const CAT: Record<string, string> = {
  upi_fraud: 'upi-fraud', otp_fraud: 'otp-fraud', kyc_fraud: 'kyc-fraud', phishing: 'phishing',
  fake_job: 'fake-job', investment_fraud: 'investment-fraud', loan_scam: 'loan-scam',
  courier_customs: 'courier-scam', lottery_prize: 'lottery-scam', tech_support: 'tech-support-scam',
  romance: 'romance-scam', whatsapp_scam: 'phishing',
}
const SEV: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10', high: 'text-orange-400 bg-orange-500/10',
  medium: 'text-amber-400 bg-amber-500/10', low: 'text-blue-400 bg-blue-500/10',
}
const ROTATE_MS = 4000

export function TrendingTicker() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    let alive = true
    fetch('/api/scam-intel/trending?limit=8')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => { if (alive) setItems(Array.isArray(d.items) ? d.items : []) })
      .catch(() => { if (alive) setItems([]) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!items || items.length < 2) return
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), ROTATE_MS)
    return () => clearInterval(t)
  }, [items])

  const cur = items && items.length ? items[idx % items.length] : null

  // Fixed-height row reserved on server + every render → zero CLS.
  return (
    <div className="mb-10 -mt-4 flex h-10 items-center gap-3 overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-sm">
      <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-surface-500">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        Trending
      </span>
      {cur ? (
        <a href={`/scams/type/${CAT[cur.category] || 'phishing'}`} className="flex min-w-0 flex-1 items-center gap-2 text-surface-200 hover:text-white">
          <span className="truncate">{cur.title}</span>
          {cur.viral && <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-red-300 bg-red-500/15">🔥 viral</span>}
          {cur.active && !cur.viral && <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-green-300 bg-green-500/15">● active</span>}
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${SEV[cur.severity] || ''}`}>{cur.severity}</span>
          <span className="shrink-0 text-[10px] text-surface-600">{rel(cur.lastSeen)}</span>
        </a>
      ) : (
        <span className="truncate text-surface-500">Live scam alerts across India — UPI, OTP, KYC, WhatsApp & more.</span>
      )}
    </div>
  )
}

function rel(ts: number): string {
  const h = Math.floor((Date.now() - ts) / 3_600_000)
  if (!ts || Number.isNaN(h)) return ''
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
