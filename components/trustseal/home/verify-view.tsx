'use client'
// components/trustseal/home/verify-view.tsx  (asq-trustseal-harden)
// Real /verify page. Public domain-lookup → opens the public seal page for that
// domain; plus a CTA to claim/verify your own domain in the dashboard. All copy via
// t(locale,key); RTL-safe; client only for the lookup form.
import { useState } from 'react'
import type { Locale } from '@/lib/trustseal/locales'
import { t } from '@/lib/trustseal/messages'

const C = { bg: '#050811', text1: '#e6edf7', text2: '#9aa7c2', text3: '#5d6a86', cyan: '#22d3ee' }
const card: React.CSSProperties = { background: 'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))', border: '1px solid rgba(120,160,255,0.14)', borderRadius: 16 }

function normalize(input: string): string | null {
  const d = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? d : null
}

export function VerifyView({ locale = 'en' as Locale }: { locale?: Locale }) {
  const x = (k: string) => t(locale, k)
  const [val, setVal] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const d = normalize(val)
    if (!d) { setErr(x('verify.invalidDomain')); return }
    window.location.href = `/${locale}/trust/${encodeURIComponent(d)}`
  }

  return (
    <main className="px-6 py-16" style={{ background: `radial-gradient(1100px 560px at 70% -10%, rgba(56,189,248,0.10), transparent 60%), ${C.bg}`, color: C.text1, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <h1 className="mx-auto max-w-3xl text-center text-3xl font-bold sm:text-4xl">{x('verify.title')}</h1>
      <p className="mx-auto mt-3 max-w-2xl text-center text-sm" style={{ color: C.text2 }}>{x('verify.subtitle')}</p>

      <form onSubmit={submit} className="mx-auto mt-10 max-w-xl p-6" style={card}>
        <label htmlFor="ts-verify-domain" className="block text-sm font-semibold">{x('verify.lookupLabel')}</label>
        <div className="mt-3 flex flex-wrap gap-3">
          <input id="ts-verify-domain" value={val} onChange={(e) => { setVal(e.target.value); setErr(null) }}
            inputMode="url" placeholder={x('verify.lookupPlaceholder')} aria-label={x('verify.lookupLabel')}
            className="min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'rgba(120,160,255,0.25)', color: C.text1 }} />
          <button type="submit" className="rounded-lg px-5 py-2 text-sm font-semibold" style={{ background: C.cyan, color: '#06121e' }}>{x('verify.lookupCta')}</button>
        </div>
        {err
          ? <p className="mt-2 text-xs" style={{ color: '#f87171' }}>{err}</p>
          : <p className="mt-2 text-xs" style={{ color: C.text3 }}>{x('verify.lookupHint')}</p>}
      </form>

      <div className="mx-auto mt-6 max-w-xl p-6 text-center" style={card}>
        <h2 className="font-semibold">{x('verify.ownTitle')}</h2>
        <p className="mt-1.5 text-sm" style={{ color: C.text2 }}>{x('verify.ownBody')}</p>
        <a href={`/${locale}/dashboard`} className="mt-4 inline-block rounded-lg border px-5 py-2 text-sm font-semibold" style={{ borderColor: 'rgba(120,160,255,0.3)', color: C.cyan }}>{x('verify.ownCta')}</a>
      </div>
    </main>
  )
}
