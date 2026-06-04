'use client'

// components/i18n/language-switcher.tsx
// Language switcher for ScamCheck (English / Hindi / Hinglish). Persists the
// choice to localStorage + a cookie (for future SSR), reflects it on <html lang>,
// and broadcasts a 'sc-lang' CustomEvent so any client component (e.g. the
// analyzer, which already ships an en/hi/hinglish dictionary in lib/i18n) can
// react. Architecture is ready for more languages — add to LANGS in
// lib/i18n/scamcheck.ts (Spanish intentionally excluded for now).

import { useEffect, useState } from 'react'
import { LANGS, type Lang } from '@/lib/i18n/scamcheck'

const KEY = 'sc-lang'

export function getStoredLang(): Lang {
  if (typeof window === 'undefined') return 'en'
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'en' || v === 'hi' || v === 'hinglish') return v
  } catch { /* ignore */ }
  return 'en'
}

export function useLang(): Lang {
  const [lang, setLang] = useState<Lang>('en')
  useEffect(() => {
    setLang(getStoredLang())
    const on = (e: Event) => setLang((e as CustomEvent<Lang>).detail)
    window.addEventListener('sc-lang', on as EventListener)
    return () => window.removeEventListener('sc-lang', on as EventListener)
  }, [])
  return lang
}

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const [lang, setLang] = useState<Lang>('en')
  useEffect(() => { setLang(getStoredLang()) }, [])

  function choose(next: Lang) {
    setLang(next)
    try {
      localStorage.setItem(KEY, next)
      document.cookie = `${KEY}=${next};path=/;max-age=31536000;samesite=lax`
      document.documentElement.lang = next === 'en' ? 'en' : next === 'hi' ? 'hi' : 'en-IN'
    } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent<Lang>('sc-lang', { detail: next }))
  }

  return (
    <label className={`flex items-center gap-1 text-xs text-zinc-400 ${className}`}>
      <span className="sr-only">Language</span>
      <span aria-hidden>🌐</span>
      <select
        value={lang}
        onChange={(e) => choose(e.target.value as Lang)}
        aria-label="Choose language"
        className="rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-xs text-zinc-200"
      >
        {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
    </label>
  )
}
