'use client'
// components/scamcheck/newsletter-capture.tsx
// asq-newsletter-v1 — inline email capture for the scan-result surface (reusable).
// Posts to /api/newsletter (server does double opt-in + honeypot + rate limit).
// Verdict-aware copy; dismiss/suppress-if-subscribed via localStorage; honeypot;
// dataLayer analytics. Reuses card/input/button styles → no new design system.
// Rollback: delete this file + its <NewsletterCapture/> usages (asq-newsletter-v1).
import { useEffect, useState, type FormEvent } from 'react'

const COPY: Record<string, { h: string; p: string; btn: string }> = {
  scam: { h: '⚠️ Scams like this are spreading fast.', p: 'Get a free weekly heads-up so you spot the next one before it costs you.', btn: 'Send me scam alerts' },
  suspicious: { h: 'Not sure? You’re not alone.', p: 'Get the week’s trending scams in a 2-minute email and stay one step ahead.', btn: 'Get weekly alerts' },
  safe: { h: 'Stay one step ahead of scammers.', p: 'Free weekly alerts on the latest scams doing the rounds — unsubscribe anytime.', btn: 'Keep me updated' },
}
function variant(verdict?: string) {
  if (verdict && /scam/.test(verdict)) return COPY.scam
  if (verdict && /(suspicious|needs_review|unclear)/.test(verdict)) return COPY.suspicious
  return COPY.safe
}
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/
const SUB_KEY = 'scm_nl_sub'

// Coarse device bucket for analytics (mobile | tablet | desktop).
function deviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || ''
    if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return 'tablet'
    if (/Mobi|iPhone|Android|IEMobile|Opera Mini/i.test(ua)) return 'mobile'
  }
  const w = typeof window !== 'undefined' ? window.innerWidth : 1280
  return w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop'
}

export function NewsletterCapture({ verdict, source = 'scan-result', className = '', magnet }: { verdict?: string; source?: string; className?: string; magnet?: { href: string; title: string } }) {
  const [email, setEmail] = useState('')
  const [hp, setHp] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [msg, setMsg] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const v = variant(verdict)

  const track = (event: string, extra: Record<string, unknown> = {}) => {
    try { (window as unknown as { dataLayer?: unknown[] }).dataLayer?.push({ event, source, verdict, ...extra }) } catch { /* noop */ }
  }
  useEffect(() => {
    try { if (localStorage.getItem(SUB_KEY) === '1') { setSubscribed(true); return } } catch { /* noop */ }
    track('newsletter_prompt_shown')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (subscribed) return null
  if (status === 'ok') {
    return (
      <div className={`rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4 text-sm text-emerald-200 ${className}`}>
        <p>{msg === 'already'
          ? '✓ You’re already subscribed — you’re all set. We’ll keep the scam alerts coming.'
          : '✓ You’re in — the week’s scams to watch for are on their way.'}</p>
        {magnet && (
          <a
            href={magnet.href} download
            onClick={() => track('lead_magnet_download', { magnet: magnet.title })}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400"
          >
            ⬇ Download your free {magnet.title}
          </a>
        )}
      </div>
    )
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(email)) { setStatus('err'); setMsg('Please enter a valid email.'); return }
    setStatus('loading'); setMsg(''); track('newsletter_submit_attempt')
    try {
      const r = await fetch('/api/newsletter', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, consent: true, source, verdict: verdict ?? 'na', device: deviceType(), hp }),
      })
      if (r.ok) {
        const data = await r.json().catch(() => ({})) as { duplicate?: boolean }
        setStatus('ok'); try { localStorage.setItem(SUB_KEY, '1') } catch { /* noop */ }
        if (data.duplicate) { setMsg('already'); track('newsletter_already_subscribed') }
        else track('newsletter_submit_success')
      }
      else if (r.status === 429) { setStatus('err'); setMsg('Too many tries — please wait a minute.'); track('newsletter_submit_error', { reason: 'rate_limited' }) }
      else { setStatus('err'); setMsg('Couldn’t sign you up — try again.'); track('newsletter_submit_error', { reason: r.status }) }
    } catch { setStatus('err'); setMsg('Network error — please try again.'); track('newsletter_submit_error', { reason: 'network' }) }
  }

  return (
    <form onSubmit={submit} className={`rounded-xl border border-sky-500/30 bg-sky-500/[0.06] p-4 ${className}`}>
      <p className="text-sm font-semibold text-zinc-100">{v.h}</p>
      <p className="mt-1 text-xs text-zinc-400">{v.p}</p>
      {magnet && <p className="mt-2 text-xs font-medium text-emerald-300">📄 Plus: instant free download — {magnet.title}.</p>}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com" aria-label="Email address"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 sm:flex-1"
        />
        {/* honeypot — bots fill this; humans never see it */}
        <input type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} aria-hidden="true" className="hidden" />
        <button type="submit" disabled={status === 'loading'}
          className="rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-60">
          {status === 'loading' ? 'Sending…' : v.btn}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">Free. Unsubscribe anytime. We never share your email.</p>
      {status === 'err' && <p className="mt-1 text-xs text-red-400">{msg}</p>}
    </form>
  )
}
