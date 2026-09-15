'use client'

// components/analytics/clarity.tsx
// Microsoft Clarity for the three hosts served by this deployment. Mounted once in
// app/layout.tsx, which persists across client-side navigation. The project is chosen in the
// browser from the exact hostname (see lib/analytics/clarity.ts) — no headers(), so static
// generation is untouched.
//
// Consent: Clarity is only loaded once the stored banner choice grants analytics. With no
// choice, or analytics denied, nothing Clarity-related runs on the page. ConsentBanner calls
// setClarityConsent() whenever the visitor saves a choice, which loads Clarity on a same-visit
// grant or forwards the change via Consent API v2 when it is already loaded.

import { useEffect } from 'react'
import {
  CONSENT_STORAGE_KEY,
  parseStoredConsent,
  syncClarity,
  type ClarityContext,
  type StoredConsent,
} from '@/lib/analytics/clarity'

declare global {
  interface Window { clarity?: ((...args: unknown[]) => void) & { q?: unknown[] } }
}

function browserContext(): ClarityContext {
  return {
    hostname: window.location.hostname,
    pathname: window.location.pathname,
    env: { nodeEnv: process.env.NODE_ENV, vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV },
    win: window,
    doc: document,
  }
}

export function setClarityConsent(prefs: StoredConsent): void {
  if (typeof window === 'undefined') return
  syncClarity(prefs, browserContext())
}

export function Clarity() {
  useEffect(() => {
    let stored: StoredConsent | null = null
    try { stored = parseStoredConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY)) } catch { /* storage blocked → no consent */ }
    syncClarity(stored, browserContext())
  }, [])

  return null
}
