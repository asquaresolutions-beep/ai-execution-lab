'use client'
// components/trustseal/billing/billing-section.tsx  (asq-trustseal-billing-b3)
// Billing section for the TrustSeal dashboard. Reads the server-authoritative
// status projection (Bearer ID token) and renders current plan, subscription
// status, renewal date, a billing-history placeholder, and upgrade/manage
// controls. This is DISPLAY + control wiring only — it performs NO entitlement
// enforcement (B4) and shows NO invoices yet (B5). Subscribe redirects to the
// Razorpay hosted checkout (short_url); state is granted only by the webhook.
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import type { Locale } from '@/lib/trustseal/locales'
import { t } from '@/lib/trustseal/messages'
import { formatDate } from '@/lib/trustseal/format'

interface BillingStatus {
  plan: 'free' | 'pro' | 'business'
  status: string
  active: boolean
  inGrace: boolean
  currentEnd: number | null
  interval: 'monthly' | 'yearly' | null
  cancelAtCycleEnd: boolean
}

const card = { borderColor: 'rgb(var(--ts-border))', backgroundColor: 'rgb(var(--ts-surface-2))' } as const

export function BillingSection({ locale = 'en' as Locale }: { locale?: Locale }) {
  const x = (k: string) => t(locale, k)
  const fmtDate = (ms: number | null) => formatDate(locale, ms, { year: 'numeric', month: 'short', day: 'numeric' })
  const { user } = useAuth()
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!user?.idToken) return
    try {
      const r = await fetch('/api/trustseal/billing/status', { headers: { Authorization: `Bearer ${user.idToken}` }, cache: 'no-store' })
      if (!r.ok) throw new Error(`status ${r.status}`)
      setStatus((await r.json()) as BillingStatus)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'billing error')
    }
  }, [user?.idToken])

  useEffect(() => { void load() }, [load])

  const subscribe = useCallback(async (interval: 'monthly' | 'yearly', plan: 'pro' | 'business' = 'pro') => {
    if (!user?.idToken || busy) return
    setBusy(true)
    try {
      const r = await fetch('/api/trustseal/billing/subscribe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval, plan }),
      })
      const data = (await r.json()) as { shortUrl?: string; error?: string }
      if (data.shortUrl) { window.location.href = data.shortUrl; return } // Razorpay hosted checkout
      // Business SKU not configured yet → graceful contact-sales message.
      if (data.error === 'plan_not_configured' && plan === 'business') { setError(x('dash.businessContact')); return }
      setError(data.error || 'subscribe failed')
    } catch {
      setError('subscribe failed')
    } finally {
      setBusy(false)
    }
  }, [user?.idToken, busy])

  const cancel = useCallback(async () => {
    if (!user?.idToken || busy) return
    setBusy(true)
    try {
      const r = await fetch('/api/trustseal/billing/cancel', { method: 'POST', headers: { Authorization: `Bearer ${user.idToken}` } })
      if (!r.ok) { const d = (await r.json()) as { error?: string }; setError(d.error || 'cancel failed'); return }
      await load() // status flips via webhook; refresh to reflect pending intent
    } catch {
      setError('cancel failed')
    } finally {
      setBusy(false)
    }
  }, [user?.idToken, busy, load])

  const reactivate = useCallback(async () => {
    if (!user?.idToken || busy) return
    setBusy(true)
    try {
      const r = await fetch('/api/trustseal/billing/reactivate', { method: 'POST', headers: { Authorization: `Bearer ${user.idToken}` } })
      const data = (await r.json()) as { shortUrl?: string; error?: string }
      if (data.shortUrl) { window.location.href = data.shortUrl; return } // re-checkout
      setError(data.error || 'reactivate failed')
    } catch {
      setError('reactivate failed')
    } finally {
      setBusy(false)
    }
  }, [user?.idToken, busy])

  if (!user) return null

  const isPaid = status?.active ?? false
  const isBusiness = isPaid && status?.plan === 'business'
  const isPro = isPaid // any active paid tier (kept name for downstream logic)
  const isCancelScheduled = isPaid && (status?.cancelAtCycleEnd ?? false)
  const planName = isBusiness ? x('dash.businessBadge') : isPro ? x('pricing.proName') : x('dash.planFree')

  return (
    <section data-billing-section className="rounded-xl border p-5" style={card}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>{x('dash.billingTitle')}</h2>
        <span className="rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ color: isPaid ? 'rgb(var(--ts-accent))' : 'rgb(var(--ts-text-2))', border: '1px solid rgb(var(--ts-border))' }}>
          {isBusiness ? x('dash.businessBadge') : isPro ? x('dash.proBadge') : x('dash.freeBadge')}
        </span>
      </div>

      {error && <p className="mt-2 text-sm" style={{ color: '#f87171' }}>{x('dash.billingError')}: {error}</p>}

      {/* Cancelled-but-still-entitled banner — removes the active/cancelled ambiguity */}
      {isCancelScheduled && (
        <p className="mt-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'rgb(var(--ts-border))', color: 'rgb(var(--ts-text-1))', background: 'rgba(251,191,36,0.08)' }}>
          {x('dash.cancelledBanner').replace('{date}', fmtDate(status?.currentEnd ?? null))}
        </p>
      )}

      {/* Pro → Business upsell (active Pro, not yet Business). Self-serve plan-swap
          isn't wired, so this routes to sales — but surfaces the upgrade value. */}
      {isPro && !isBusiness && (
        <div className="mt-3 rounded-lg border px-3 py-3" style={{ borderColor: '#a78bfa', background: 'rgba(167,139,250,0.08)' }}>
          <p className="text-sm font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>{x('dash.proToBusinessTitle')}</p>
          <p className="mt-1 text-xs" style={{ color: 'rgb(var(--ts-text-2))' }}>{x('dash.proToBusinessBody')}</p>
          <a href="mailto:contact@asquaresolution.com?subject=TrustSeal%20Business%20upgrade"
            className="mt-2 inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: '#a78bfa', color: '#06121e' }}>
            {x('dash.upgradeBusiness')}
          </a>
        </div>
      )}

      {/* current plan / status / renewal */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><dt style={{ color: 'rgb(var(--ts-text-2))' }}>{x('dash.planLabel')}</dt><dd style={{ color: 'rgb(var(--ts-text-1))' }}>{isPaid ? `${planName} · ${status?.interval ?? ''}` : x('dash.planFree')}</dd></div>
        <div><dt style={{ color: 'rgb(var(--ts-text-2))' }}>{x('dash.statusLabel')}</dt><dd style={{ color: 'rgb(var(--ts-text-1))' }}>{isCancelScheduled ? x('dash.cancelledActive') : `${status?.status ?? '—'}${status?.inGrace ? x('dash.graceSuffix') : ''}`}</dd></div>
        <div><dt style={{ color: 'rgb(var(--ts-text-2))' }}>{isCancelScheduled ? x('dash.accessUntilLabel') : x('dash.renewsLabel')}</dt><dd style={{ color: 'rgb(var(--ts-text-1))' }}>{fmtDate(status?.currentEnd ?? null)}</dd></div>
        <div><dt style={{ color: 'rgb(var(--ts-text-2))' }}>{x('dash.historyLabel')}</dt><dd style={{ color: 'rgb(var(--ts-text-3))' }}>{x('dash.invoicesSoon')}</dd></div>
      </dl>

      {/* upgrade / manage controls */}
      <div className="mt-5 flex flex-wrap gap-3">
        {!isPro ? (
          <>
            <button type="button" disabled={busy} onClick={() => void subscribe('monthly')}
              className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
              style={{ background: 'rgb(var(--ts-accent))', color: '#06121e' }}>{x('dash.upgradeMonthly')}</button>
            <button type="button" disabled={busy} onClick={() => void subscribe('yearly')}
              className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-60"
              style={{ borderColor: 'rgb(var(--ts-border))', color: 'rgb(var(--ts-text-1))' }}>{x('dash.upgradeYearly')}</button>
            <button type="button" disabled={busy} onClick={() => void subscribe('monthly', 'business')}
              className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
              style={{ background: '#a78bfa', color: '#06121e' }}>{x('dash.upgradeBusiness')}</button>
          </>
        ) : isCancelScheduled ? (
          <button type="button" disabled={busy} onClick={() => void reactivate()}
            className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ background: 'rgb(var(--ts-accent))', color: '#06121e' }}>{x('dash.reactivate')}</button>
        ) : (
          <button type="button" disabled={busy} onClick={() => void cancel()}
            className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ borderColor: 'rgb(var(--ts-border))', color: 'rgb(var(--ts-text-2))' }}>
            {x('dash.cancelSub')}
          </button>
        )}
      </div>
    </section>
  )
}
