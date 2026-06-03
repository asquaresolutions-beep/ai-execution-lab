'use client'
// ─────────────────────────────────────────────────────────────────
// components/scam/alert-subscribe.tsx
// Retention: email alert sign-up + "save to watchlist" (localStorage, zero
// backend) + browser-notification opt-in. Client-only, lazy, no CLS.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'

const WATCH_KEY = 'sc_watchlist'

export function AlertSubscribe({ topic, topicId }: { topic: string; topicId?: string }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [watched, setWatched] = useState(false)

  useEffect(() => {
    if (!topicId) return
    try { setWatched((JSON.parse(localStorage.getItem(WATCH_KEY) || '[]') as string[]).includes(topicId)) } catch { /* ignore */ }
  }, [topicId])

  async function subscribe(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const r = await fetch('/api/scam-intel/subscribe', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, categories: topicId ? [topicId] : [] }),
      })
      setStatus(r.ok ? 'done' : 'error')
    } catch { setStatus('error') }
  }

  function toggleWatch() {
    if (!topicId) return
    try {
      const list = new Set(JSON.parse(localStorage.getItem(WATCH_KEY) || '[]') as string[])
      if (list.has(topicId)) list.delete(topicId)
      else { list.add(topicId); requestNotify() }
      localStorage.setItem(WATCH_KEY, JSON.stringify([...list]))
      setWatched(list.has(topicId))
    } catch { /* ignore */ }
  }

  function requestNotify() {
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission() } catch { /* ignore */ }
  }

  return (
    <section className="my-6 rounded-lg border border-indigo-500/25 bg-indigo-500/5 p-4">
      <h2 className="text-sm font-semibold text-white">Get alerted about new {topic} scams</h2>
      <p className="mt-1 text-xs text-neutral-400">Free email alerts when a new or trending scam is detected. No spam.</p>
      {status === 'done' ? (
        <p className="mt-3 text-sm text-green-400">✓ Subscribed. Confirm via email (coming soon).</p>
      ) : (
        <form onSubmit={subscribe} className="mt-3 flex flex-wrap gap-2">
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600"
          />
          <button type="submit" disabled={status === 'loading'} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
            {status === 'loading' ? '…' : 'Alert me'}
          </button>
        </form>
      )}
      {status === 'error' && <p className="mt-2 text-xs text-red-400">Something went wrong. Please try again.</p>}
      {topicId && (
        <button onClick={toggleWatch} className="mt-3 text-xs text-neutral-400 hover:text-white">
          {watched ? '★ On your watchlist' : '☆ Add to watchlist'}
        </button>
      )}
    </section>
  )
}
