'use client'
// ─────────────────────────────────────────────────────────────────
// components/scam/check-message-box.tsx
// Above-the-fold "Check a message" engagement module. Detects the input
// type (URL / phone / WhatsApp/text) client-side and routes into the
// ScamCheck checker app with the query prefilled.
//
//  - Lightweight: one input + one button, no deps.
//  - Mobile-first: stacks on small screens.
//  - No CLS: fixed layout, reserved space.
//  - No hydration mismatch: stable initial render (empty input); all
//    detection/routing happens on submit (client event), not during render.
// ─────────────────────────────────────────────────────────────────

import { useState } from 'react'

const APP = (process.env.NEXT_PUBLIC_SCAMCHECK_APP_URL || 'https://scamcheck.asquaresolution.com').replace(/\/$/, '')

type InputType = 'url' | 'phone' | 'text'

function detectType(v: string): InputType {
  const s = v.trim()
  if (/\bhttps?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,}(\/|$)/i.test(s)) return 'url'
  if (/^\+?[\d][\d\s-]{6,}\d$/.test(s)) return 'phone'
  return 'text'
}

export function CheckMessageBox() {
  const [value, setValue] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = value.trim()
    if (!v) return
    const type = detectType(v)
    // Route into the ScamCheck flow with the query + a type hint prefilled.
    const url = `${APP}/?q=${encodeURIComponent(v)}&t=${type}`
    window.location.assign(url)
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3 sm:p-4"
      aria-label="Check a message for scams"
    >
      <label htmlFor="scamcheck-q" className="block text-sm font-semibold text-surface-100">
        Got a suspicious message? Check it free.
      </label>
      <p className="mt-0.5 text-xs text-surface-500">Paste a link, phone number, or message — UPI, WhatsApp, KYC, job offers.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          id="scamcheck-q"
          type="text"
          inputMode="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste a link, number, or message…"
          className="min-w-0 flex-1 rounded-lg border border-white/[0.10] bg-surface-950/60 px-3 py-2.5 text-sm text-surface-100 placeholder:text-surface-600 focus:border-amber-500/40 focus:outline-none"
          autoComplete="off"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-surface-950 hover:bg-amber-400 transition-colors"
        >
          Check now →
        </button>
      </div>
    </form>
  )
}
