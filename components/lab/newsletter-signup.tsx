'use client'

// AI Execution Lab Weekly — newsletter signup (name + email). Posts to
// /api/lab-subscribe. Distinct Lab branding (not ScamCheck).
import { useState } from 'react'

export function NewsletterSignup({ compact = false }: { compact?: boolean }) {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [hp, setHp] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle'); const [msg, setMsg] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg('')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) { setState('error'); setMsg('Enter a valid email.'); return }
    if (hp) { setState('done'); setMsg('Subscribed.'); return }
    setState('sending')
    try {
      const r = await fetch('/api/lab-subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, email, hp }) })
      const d = await r.json()
      if (!r.ok) { setState('error'); setMsg(d.detail || 'Could not subscribe.'); return }
      setState('done'); setMsg(d.message || 'Subscribed to AI Execution Lab Weekly.')
    } catch { setState('error'); setMsg('Network error.') }
  }

  return (
    <section className={`rounded-xl border border-brand-500/20 bg-brand-500/[0.04] ${compact ? 'p-4' : 'p-5'}`}>
      <h2 className={`font-bold text-surface-100 ${compact ? 'text-sm' : 'text-base'}`}>AI Execution Lab Weekly</h2>
      <p className="mt-1 text-xs text-surface-500">Production AI engineering notes, systems, and failure post-mortems — once a week.</p>
      {state === 'done' ? (
        <p className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{msg}</p>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" className="w-full rounded-lg border border-white/10 bg-surface-950 px-3 py-2 text-sm text-surface-100" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="you@email.com" className="w-full rounded-lg border border-white/10 bg-surface-950 px-3 py-2 text-sm text-surface-100" />
          <input value={hp} onChange={(e) => setHp(e.target.value)} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 opacity-0" />
          {msg && state === 'error' && <p className="text-xs text-red-400">{msg}</p>}
          <button disabled={state === 'sending'} className="w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-400 disabled:opacity-60">{state === 'sending' ? 'Subscribing…' : 'Subscribe'}</button>
        </form>
      )}
    </section>
  )
}
