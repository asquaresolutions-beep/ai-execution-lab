'use client'
// components/trustseal/api-access-section.tsx  (asq-trustseal-phase4 + hardening)
// Dashboard "API access": the account's Trust API key (store-backed, rotatable),
// plan, quota, this-month usage, plus Regenerate / Revoke. Reads/writes
// GET/POST /api/trustseal/api-key.
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import type { Locale } from '@/lib/trustseal/locales'
import { t } from '@/lib/trustseal/messages'

interface ApiInfo {
  key: string | null
  plan: string
  quota: { requestsPerMinute: number; monthly: number }
  usage: { period: string; count: number }
}

const card = { borderColor: 'rgb(var(--ts-border))', backgroundColor: 'rgb(var(--ts-surface-2))' } as const

export function ApiAccessSection({ locale = 'en' as Locale }: { locale?: Locale }) {
  const x = (k: string) => t(locale, k)
  const { user } = useAuth()
  const [info, setInfo] = useState<ApiInfo | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!user?.idToken) return
    try {
      const r = await fetch('/api/trustseal/api-key', { headers: { Authorization: `Bearer ${user.idToken}` }, cache: 'no-store' })
      if (r.ok) setInfo((await r.json()) as ApiInfo)
    } catch { /* non-critical */ }
  }, [user?.idToken])
  useEffect(() => { void load() }, [load])

  const act = useCallback(async (action: 'rotate' | 'revoke') => {
    if (!user?.idToken || busy) return
    const confirmMsg = action === 'rotate' ? x('dash.apiRotateConfirm') : x('dash.apiRevokeConfirm')
    if (!window.confirm(confirmMsg)) return
    setBusy(true)
    try {
      const r = await fetch('/api/trustseal/api-key', { method: 'POST', headers: { Authorization: `Bearer ${user.idToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
      if (r.ok) setInfo((await r.json()) as ApiInfo)
    } catch { /* */ } finally { setBusy(false) }
  }, [user?.idToken, busy])

  if (!user || !info) return null

  const copy = async () => {
    if (!info.key) return
    try { await navigator.clipboard.writeText(info.key); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ }
  }
  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div><dt className="text-xs" style={{ color: 'rgb(var(--ts-text-2))' }}>{label}</dt><dd className="text-sm font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>{value}</dd></div>
  )

  return (
    <section data-api-access className="rounded-xl border p-5" style={card}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>{x('dash.apiTitle')}</h2>
        <div className="flex items-center gap-2">
          <button type="button" disabled={busy} onClick={() => void act('rotate')} className="rounded-md border px-2.5 py-0.5 text-xs disabled:opacity-50" style={{ borderColor: 'rgb(var(--ts-border))', color: 'rgb(var(--ts-text-1))' }}>{x('dash.apiRotate')}</button>
          {info.key && <button type="button" disabled={busy} onClick={() => void act('revoke')} className="rounded-md border px-2.5 py-0.5 text-xs disabled:opacity-50" style={{ borderColor: 'rgb(var(--ts-border))', color: '#f87171' }}>{x('dash.apiRevoke')}</button>}
        </div>
      </div>

      <p className="mt-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'rgb(var(--ts-text-2))' }}>{x('dash.apiKey')}</p>
      {info.key ? (
        <div className="mt-1 flex items-stretch gap-2">
          <code dir="ltr" className="flex-1 overflow-x-auto rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'rgb(var(--ts-border))', backgroundColor: 'rgb(var(--ts-bg))', color: 'rgb(var(--ts-text-1))' }}>{info.key}</code>
          <button type="button" onClick={() => void copy()} className="shrink-0 rounded-lg border px-3 text-xs font-medium" style={{ borderColor: 'rgb(var(--ts-border))', color: copied ? 'rgb(var(--ts-accent))' : 'rgb(var(--ts-text-1))' }}>{copied ? x('dash.copied') : x('dash.copy')}</button>
        </div>
      ) : (
        <p className="mt-1 text-sm" style={{ color: '#fbbf24' }}>{x('dash.apiRevoked')}</p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={x('dash.apiPlan')} value={info.plan.toUpperCase()} />
        <Stat label={x('dash.apiPerMinute')} value={String(info.quota.requestsPerMinute)} />
        <Stat label={x('dash.apiMonthly')} value={info.quota.monthly.toLocaleString()} />
        <Stat label={x('dash.apiUsageThisMonth')} value={`${info.usage.count.toLocaleString()} (${info.usage.period})`} />
      </dl>
      <p className="mt-3 text-xs" style={{ color: 'rgb(var(--ts-text-3))' }}>{x('dash.apiHint')}</p>
    </section>
  )
}
