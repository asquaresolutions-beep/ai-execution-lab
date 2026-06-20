'use client'
// components/tracks/notify-form.tsx
// "Notify me when this lesson is released" — reuses the existing newsletter
// infrastructure (POST /api/newsletter, idempotent, honeypot). No new backend.
import { useState } from 'react'
import { trackEvent } from '@/lib/track-event'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/

export function NotifyForm({ lessonId }: { lessonId: string }) {
  const [email, setEmail] = useState('')
  const [hp, setHp] = useState('') // honeypot
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [msg, setMsg] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(email)) { setState('err'); setMsg('Enter a valid email.'); return }
    setState('loading'); setMsg('')
    trackEvent('lesson_notify_submit', { lesson: lessonId })
    try {
      const r = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, hp, source: `track-notify:${lessonId}` }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { setState('ok'); setMsg(d.message || 'Done — we’ll let you know.') }
      else { setState('err'); setMsg(d.error === 'invalid_email' ? 'Enter a valid email.' : 'Could not sign you up — try again.') }
    } catch { setState('err'); setMsg('Network error — try again.') }
  }

  if (state === 'ok') {
    return (
      <p className="mt-6 text-sm text-surface-300">✓ {msg}</p>
    )
  }

  return (
    <form onSubmit={submit} className="mt-6 mx-auto max-w-sm">
      <p className="text-sm font-medium text-surface-300 mb-2">Notify me when this lesson is released</p>
      {/* honeypot — visually hidden, bots fill it */}
      <input
        type="text" value={hp} onChange={(e) => setHp(e.target.value)}
        tabIndex={-1} autoComplete="off" aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0" name="company"
      />
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email" inputMode="email" required placeholder="you@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-sm text-surface-100 placeholder:text-surface-600 focus:outline-none focus:border-white/[0.2]"
        />
        <button
          type="submit" disabled={state === 'loading'}
          className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {state === 'loading' ? 'Submitting…' : 'Notify me'}
        </button>
      </div>
      {state === 'err' && <p className="mt-2 text-xs text-red-400">{msg}</p>}
      <p className="mt-2 text-[11px] text-surface-600">One email when it’s live. No spam.</p>
    </form>
  )
}
