'use client'

// components/consent/consent-banner.tsx
// GDPR / UK-GDPR / ePrivacy cookie consent, wired to Google Consent Mode v2.
// The root layout sets all consent signals to "denied" by default (before any
// ad/analytics tag loads). This banner lets the visitor Accept all, Reject
// non-essential, or Customize, then calls gtag('consent','update',…) and
// persists the choice in localStorage so it isn't asked again.
//
// Essential storage (the consent choice itself, auth, credits) always works;
// only ad_storage / ad_personalization / ad_user_data / analytics_storage are
// gated. Until the user accepts, AdSense serves non-personalised ads only.

import { useEffect, useState } from 'react'

const KEY = 'sc-consent-v1'
type Prefs = { analytics: boolean; ads: boolean }

declare global {
  interface Window { gtag?: (...args: unknown[]) => void }
}

function apply(prefs: Prefs) {
  const g = typeof window !== 'undefined' ? window.gtag : undefined
  if (typeof g === 'function') {
    g('consent', 'update', {
      ad_storage: prefs.ads ? 'granted' : 'denied',
      ad_user_data: prefs.ads ? 'granted' : 'denied',
      ad_personalization: prefs.ads ? 'granted' : 'denied',
      analytics_storage: prefs.analytics ? 'granted' : 'denied',
    })
  }
}

export function ConsentBanner() {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(false)
  const [prefs, setPrefs] = useState<Prefs>({ analytics: true, ads: true })

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true)
    } catch { setOpen(true) }
  }, [])

  function save(next: Prefs) {
    try { localStorage.setItem(KEY, JSON.stringify({ ...next, ts: Date.now() })) } catch { /* private mode */ }
    apply(next)
    setOpen(false)
  }

  if (!open) return null

  return (
    <div role="dialog" aria-label="Cookie consent" aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-zinc-700 bg-zinc-950/95 p-4 backdrop-blur sm:p-5">
      <div className="mx-auto max-w-3xl text-sm text-zinc-300">
        <p className="font-medium text-zinc-100">We value your privacy</p>
        <p className="mt-1 text-xs text-zinc-400">
          We use essential cookies to run this site, and — with your consent — analytics and advertising
          cookies (Google AdSense) to keep the tool free. You can accept all, reject non-essential, or
          choose. See our <a href="/privacy-policy" className="text-sky-400 hover:underline">Privacy Policy</a>.
        </p>

        {custom && (
          <div className="mt-3 space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-xs">
            <label className="flex items-center justify-between gap-3">
              <span><span className="text-zinc-100">Essential</span> — always on (security, auth, your consent choice).</span>
              <input type="checkbox" checked disabled aria-label="Essential cookies (always on)" />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span><span className="text-zinc-100">Analytics</span> — anonymous usage stats to improve the product.</span>
              <input type="checkbox" checked={prefs.analytics} onChange={(e) => setPrefs((p) => ({ ...p, analytics: e.target.checked }))} aria-label="Analytics cookies" />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span><span className="text-zinc-100">Advertising</span> — personalised ads via Google AdSense.</span>
              <input type="checkbox" checked={prefs.ads} onChange={(e) => setPrefs((p) => ({ ...p, ads: e.target.checked }))} aria-label="Advertising cookies" />
            </label>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => save({ analytics: true, ads: true })}
            className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-400">Accept all</button>
          <button onClick={() => save({ analytics: false, ads: false })}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:bg-zinc-800">Reject non-essential</button>
          {custom
            ? <button onClick={() => save(prefs)} className="rounded-lg border border-sky-500/50 px-4 py-2 text-xs text-sky-300 hover:bg-sky-500/10">Save preferences</button>
            : <button onClick={() => setCustom(true)} className="rounded-lg border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:bg-zinc-800">Customize</button>}
        </div>
      </div>
    </div>
  )
}
