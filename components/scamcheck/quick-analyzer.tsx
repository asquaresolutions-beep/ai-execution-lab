'use client'

// Quick analyzer — instant scam check for text / link / email / phone, in tabs,
// above the AI screenshot analyzer. Mobile-first, credit-aware, high-conversion.
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useCredits, authHeaders } from '@/hooks/use-credits'
import { useAuth } from '@/components/auth/auth-provider'

type Tab = 'message' | 'link' | 'email' | 'phone' | 'screenshot'
const TABS: { id: Tab; label: string }[] = [
  { id: 'message', label: 'Message' }, { id: 'link', label: 'Link' }, { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' }, { id: 'screenshot', label: 'Screenshot' },
]
const PLACEHOLDER: Record<Tab, string> = {
  message: 'Paste the suspicious SMS / WhatsApp message…',
  link: 'Paste a link, e.g. http://sbi-kyc-verify.xyz',
  email: 'Paste the sender email, e.g. support@paytm-refund.top',
  phone: 'Paste the phone number, e.g. +91 98xxxxxxxx',
  screenshot: '',
}
interface QuickResult {
  verdict: string; riskScore: number; trusted: boolean; category: string
  signals: { id: string; label: string; severity: string }[]
  advice: string[]; reputationNotes: string[]
  entities: { urls: string[]; phones: string[]; upiIds: string[] }
}
const STYLE: Record<string, string> = {
  likely_scam: 'bg-red-500/15 text-red-300 border-red-500/40',
  suspicious: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  likely_safe: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  unclear: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40',
}

export function QuickAnalyzer() {
  const [tab, setTab] = useState<Tab>('message')
  const [value, setValue] = useState('')
  const [result, setResult] = useState<QuickResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { user } = useAuth()
  const { remaining, quota, loggedIn, refresh } = useCredits()

  const check = async () => {
    setError(''); setResult(null)
    if (!value.trim() || value.trim().length < 3) { setError('Enter something to check.'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/scam-intel/quick-check', { method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders(user) }, body: JSON.stringify({ type: tab, value }) })
      const data = await r.json()
      if (r.status === 402) { setError(data.detail || `Daily limit reached (${quota}/day). Sign in for 50/day.`); void refresh(); return }
      if (!r.ok) { setError(data.detail || data.error || 'Check failed.'); return }
      setResult(data as QuickResult)
      void refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Network error.') } finally { setBusy(false) }
  }
  const scrollToShot = () => document.getElementById('screenshot-analyzer')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-100">Quick scam check</h2>
        <span className="text-xs text-zinc-500">{remaining}/{quota} free scans today{!loggedIn ? ' · sign in for 50' : ''}</span>
      </div>

      <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
        {TABS.map((tb) => (
          <button key={tb.id} onClick={() => { setTab(tb.id); setResult(null); setError('') }}
            className={cn('whitespace-nowrap rounded-lg px-3 py-1.5 text-sm', tab === tb.id ? 'bg-sky-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700')}>{tb.label}</button>
        ))}
      </div>

      {tab === 'screenshot' ? (
        <div className="mt-4 rounded-lg border border-zinc-800 p-4 text-sm text-zinc-300">
          Screenshots use the AI analyzer (OCR + vision) below.
          <button onClick={scrollToShot} className="mt-3 block w-full rounded-lg bg-sky-500 px-4 py-2.5 font-medium text-white hover:bg-sky-400">Open AI screenshot analyzer ↓</button>
        </div>
      ) : (
        <div className="mt-4">
          {tab === 'message' ? (
            <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} placeholder={PLACEHOLDER[tab]} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-100" />
          ) : (
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={PLACEHOLDER[tab]} inputMode={tab === 'phone' ? 'tel' : 'text'} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-100" />
          )}
          <button onClick={check} disabled={busy} className="mt-3 w-full rounded-lg bg-sky-500 px-4 py-3 text-base font-semibold text-white hover:bg-sky-400 disabled:opacity-60">
            {busy ? 'Checking…' : `Check this ${tab}`}
          </button>
        </div>
      )}

      {error && <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      {result && (
        <div className="mt-4 space-y-3">
          <div className={cn('rounded-lg border p-4', STYLE[result.verdict] || STYLE.unclear)}>
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold capitalize">{result.verdict.replace(/_/g, ' ')}</span>
              <span className="text-sm">Risk {result.riskScore}/100</span>
            </div>
            {result.trusted && <p className="mt-1 text-xs opacity-80">Matches a verified/official entity — likely legitimate (still verify in the official app).</p>}
            {result.reputationNotes?.map((n, i) => <p key={i} className="mt-1 text-xs opacity-80">{n}</p>)}
          </div>
          {result.signals?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {result.signals.map((s) => <span key={s.id} className={cn('rounded-full px-2 py-1 text-xs', s.severity === 'danger' ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300')}>{s.label}</span>)}
            </div>
          )}
          {result.advice?.length > 0 && (
            <ul className="list-inside list-disc space-y-1 text-sm text-zinc-300">{result.advice.map((a, i) => <li key={i}>{a}</li>)}</ul>
          )}
        </div>
      )}
    </section>
  )
}
