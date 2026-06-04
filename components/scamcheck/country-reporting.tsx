'use client'

// components/scamcheck/country-reporting.tsx
// Shows the correct official fraud-reporting authority for the visitor's
// country. Detects country from the CDN geo header (/api/geo), falls back to
// browser locale, then to an international default. The visitor can override
// the country manually. Pure display of lib/scam-intel/countries data.

import { useEffect, useState } from 'react'
import { COUNTRIES, getCountry, countryFromLocale, INTERNATIONAL_FALLBACK, type CountryConfig } from '@/lib/scam-intel/countries'

export function CountryReporting() {
  const [cfg, setCfg] = useState<CountryConfig | null>(null)
  const [code, setCode] = useState<string>('')

  useEffect(() => {
    let alive = true
    const localeGuess = countryFromLocale(typeof navigator !== 'undefined' ? navigator.language : null)
    fetch('/api/geo')
      .then((r) => r.json())
      .then((d: { countryCode?: string | null }) => {
        if (!alive) return
        const c = d.countryCode || localeGuess || 'INT'
        setCode(c)
        setCfg(c === 'INT' ? INTERNATIONAL_FALLBACK : getCountry(c))
      })
      .catch(() => {
        if (!alive) return
        const c = localeGuess || 'INT'
        setCode(c); setCfg(c === 'INT' ? INTERNATIONAL_FALLBACK : getCountry(c))
      })
    return () => { alive = false }
  }, [])

  function pick(c: string) {
    setCode(c)
    setCfg(c === 'INT' ? INTERNATIONAL_FALLBACK : getCountry(c))
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-100">Where to report a scam</h3>
        <label className="text-xs text-zinc-400">
          Country:{' '}
          <select value={code} onChange={(e) => pick(e.target.value)} className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200" aria-label="Select your country">
            {Object.values(COUNTRIES).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            <option value="INT">Other / International</option>
          </select>
        </label>
      </div>
      {cfg ? (
        <div className="mt-3 text-sm text-zinc-300">
          <p className="text-zinc-100">{cfg.name}</p>
          <ul className="mt-1 space-y-1 text-xs">
            <li><span className="text-zinc-500">Helpline / agency:</span> {cfg.helpline} — {cfg.agency}</li>
            <li><span className="text-zinc-500">Report online:</span>{' '}
              <a href={cfg.reportUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">{cfg.reportUrl.replace(/^https?:\/\//, '')}</a>
            </li>
            <li className="text-zinc-400">{cfg.bankingGuidance}</li>
          </ul>
          <p className="mt-2 text-[11px] text-zinc-500">If money was lost or details shared, contact your bank immediately. ScamCheck does not file reports for you.</p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">Detecting your country…</p>
      )}
    </div>
  )
}
