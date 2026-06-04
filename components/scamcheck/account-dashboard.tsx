'use client'

// User dashboard: scan history, risk-score history, last scan, total scans,
// remaining credits, and saved reports (the user's recorded scans). Requires sign-in.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth/auth-provider'
import { authHeaders } from '@/hooks/use-credits'
import { AuthButton } from '@/components/auth/auth-button'

interface Entry { ts: number; type: string; verdict: string; risk: number; label?: string }
interface Data { items: Entry[]; total: number; lastAt: number | null; credits?: { remaining: number; quota: number }; email?: string | null }

const VC: Record<string, string> = { likely_scam: 'text-red-300', suspicious: 'text-amber-300', likely_safe: 'text-emerald-300', needs_review: 'text-sky-300', unclear: 'text-zinc-300' }

export function AccountDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    fetch('/api/scans', { headers: authHeaders(user), cache: 'no-store' }).then((r) => r.ok ? r.json() : null).then((d) => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [user])

  if (!user) return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-center">
      <p className="text-sm text-zinc-400">Sign in to see your scan history, risk trends, and saved reports.</p>
      <div className="mt-3 flex justify-center"><AuthButton /></div>
    </div>
  )
  if (loading) return <p className="animate-pulse text-sm text-zinc-400">Loading your dashboard…</p>

  const items = data?.items ?? []
  const last = data?.lastAt ? new Date(data.lastAt) : null
  const avgRisk = items.length ? Math.round(items.reduce((a, e) => a + e.risk, 0) / items.length) : 0

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Total scans" value={String(data?.total ?? 0)} />
        <Stat label="Credits left today" value={data?.credits ? `${data.credits.remaining}/${data.credits.quota}` : '—'} />
        <Stat label="Last scan" value={last ? last.toLocaleDateString() : '—'} />
        <Stat label="Avg risk (recent)" value={`${avgRisk}/100`} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-zinc-200">Scan history &amp; reports</h2>
        {items.length === 0 ? (
          <p className="text-sm text-zinc-500">No scans yet. <Link href="/" className="text-sky-400 hover:underline">Run your first check →</Link></p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
            {items.map((e, i) => (
              <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                <div>
                  <span className={`font-medium capitalize ${VC[e.verdict] || 'text-zinc-300'}`}>{e.verdict.replace(/_/g, ' ')}</span>
                  <span className="ml-2 text-xs text-zinc-500">{e.type}{e.label ? ` · ${e.label.replace(/_/g, ' ')}` : ''}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-zinc-400">risk {e.risk}/100</div>
                  <div className="text-[10px] text-zinc-600">{new Date(e.ts).toLocaleString()}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="text-lg font-semibold text-zinc-100">{value}</div>
      <div className="text-[11px] text-zinc-500">{label}</div>
    </div>
  )
}
