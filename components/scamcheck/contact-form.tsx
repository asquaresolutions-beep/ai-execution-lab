'use client'

import { useState } from 'react'

export function ContactForm() {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [message, setMessage] = useState(''); const [kind, setKind] = useState('general')
  const [hp, setHp] = useState('') // honeypot — humans never see/fill this
  const [startedAt] = useState(() => Date.now())
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle'); const [msg, setMsg] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg('')
    // Client-side validation
    if (message.trim().length < 10) { setState('error'); setMsg('Please enter at least 10 characters describing your message.'); return }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setState('error'); setMsg('Please enter a valid email, or leave it blank.'); return }
    if (hp) { setState('done'); setMsg('Thanks — we received your message.'); return } // silently drop bots
    setState('sending')
    try {
      const r = await fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, email, message, kind, hp, elapsedMs: Date.now() - startedAt }) })
      const d = await r.json()
      if (!r.ok) { setState('error'); setMsg(d.detail || d.error || 'Could not send.'); return }
      setState('done'); setMsg(d.detail || 'Thanks — we received your message.'); setMessage('')
    } catch { setState('error'); setMsg('Network error.') }
  }

  if (state === 'done') return <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">{msg}</div>

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email (optional, for a reply)" className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
      </div>
      <select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
        <option value="general">General question</option>
        <option value="report">Report a scam</option>
        <option value="feedback">Product feedback</option>
        <option value="business">Business / API</option>
      </select>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder="Your message — paste the scam details here if reporting." className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-100" />
      {/* Honeypot: hidden from users; only bots fill it. */}
      <input value={hp} onChange={(e) => setHp(e.target.value)} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 opacity-0" />
      {msg && state === 'error' && <p className="text-sm text-red-400">{msg}</p>}
      <button disabled={state === 'sending'} className="rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-60">{state === 'sending' ? 'Sending…' : 'Send message'}</button>
      <p className="text-xs text-zinc-500">Or email us directly at <a href="mailto:contact@asquaresolution.com" className="text-sky-400 hover:underline">contact@asquaresolution.com</a>.</p>
    </form>
  )
}
