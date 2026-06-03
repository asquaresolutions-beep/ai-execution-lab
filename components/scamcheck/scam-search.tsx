'use client'

// Searchable scam database — queries /api/scam-intel/search and lists matches.
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Hit { kind: string; slug: string; href: string; title: string; snippet: string; category?: string }

export function ScamSearch() {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      try { const r = await fetch(`/api/scam-intel/search?q=${encodeURIComponent(q)}`); const d = await r.json(); setHits(d.results || []) } catch { /* keep */ } finally { setLoading(false) }
    }, 200)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search scams — e.g. UPI refund, fake SBI KYC, courier fee…" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100" />
      {loading && <p className="mt-2 text-xs text-zinc-500">Searching…</p>}
      <ul className="mt-4 divide-y divide-zinc-800 rounded-lg border border-zinc-800">
        {hits.map((h) => (
          <li key={`${h.kind}-${h.slug}`} className="px-4 py-3">
            <Link href={h.href} className="block">
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-100">{h.title}</span>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">{h.kind}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-400">{h.snippet}…</p>
            </Link>
          </li>
        ))}
        {!loading && hits.length === 0 && <li className="px-4 py-6 text-center text-sm text-zinc-500">No matches. Try “UPI”, “KYC”, “courier”, or “investment”.</li>}
      </ul>
    </div>
  )
}
