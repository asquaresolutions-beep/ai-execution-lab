'use client'
// ─────────────────────────────────────────────────────────────────
// components/ads/use-paid-user.ts
// Detects an active paid plan to auto-remove ads — hydration-safe.
//
// These programmatic pages are static (SSG) and public, so paid status
// is unknown at build time. We therefore detect it ONLY on the client,
// after mount: the first render (server + first client render) returns
// `undefined`, matching the server HTML exactly → NO hydration mismatch.
//
// Cross-app signal: the ScamCheck/TrustSeal apps set a shared cookie or
// localStorage key when a user has an active paid plan. Configure the key
// via NEXT_PUBLIC_PAID_FLAG_KEY (default "sc_plan").
// ─────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'

const FLAG_KEY = process.env.NEXT_PUBLIC_PAID_FLAG_KEY || 'sc_plan'
const PAID_RE = /\b(paid|pro|basic|premium|active|plus)\b/i

/** undefined = still checking (render neutral), false = free, true = paid. */
export function usePaidUser(): boolean | undefined {
  const [paid, setPaid] = useState<boolean | undefined>(undefined)
  useEffect(() => {
    setPaid(detectPaid())
  }, [])
  return paid
}

function detectPaid(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const ls = window.localStorage.getItem(FLAG_KEY) || window.localStorage.getItem('plan') || ''
    if (PAID_RE.test(ls)) return true
    const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + FLAG_KEY + '=([^;]+)'))
    if (m && PAID_RE.test(decodeURIComponent(m[1]))) return true
  } catch {
    /* storage blocked → treat as free */
  }
  return false
}
