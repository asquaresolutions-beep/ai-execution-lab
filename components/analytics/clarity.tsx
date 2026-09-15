'use client'

// components/analytics/clarity.tsx
// Microsoft Clarity for the three hosts served by this deployment. Mounted once in
// app/layout.tsx, which persists across client-side navigation, so the tag is injected
// a single time per page load. The project is chosen in the browser from the exact
// hostname (see lib/analytics/clarity.ts) — no headers(), so static generation is untouched.
//
// Consent: the Clarity projects run with cookies OFF; the stored banner choice (or the
// denied default) is passed via Consent API v2 before the tag loads, and ConsentBanner
// calls setClarityConsent() whenever the visitor saves a choice.

import { useEffect } from 'react'
import {
  CONSENT_STORAGE_KEY,
  clarityConsentFrom,
  clarityTagFor,
  parseStoredConsent,
  type StoredConsent,
} from '@/lib/analytics/clarity'

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[] }

declare global {
  interface Window { clarity?: ClarityFn }
}

const SCRIPT_ID = 'ms-clarity-tag'

export function setClarityConsent(prefs: StoredConsent): void {
  if (typeof window === 'undefined' || typeof window.clarity !== 'function') return
  window.clarity('consentv2', clarityConsentFrom(prefs))
}

export function Clarity() {
  useEffect(() => {
    const tag = clarityTagFor(window.location.hostname, window.location.pathname, {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
    })
    if (!tag || document.getElementById(SCRIPT_ID)) return

    // Command queue from Microsoft's install snippet; calls made before the tag loads are replayed.
    if (typeof window.clarity !== 'function') {
      const queue: ClarityFn = function () {
        // eslint-disable-next-line prefer-rest-params
        ;(queue.q = queue.q || []).push(arguments)
      }
      window.clarity = queue
    }

    let stored: StoredConsent | null = null
    try { stored = parseStoredConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY)) } catch { /* storage blocked → denied */ }
    window.clarity('consentv2', clarityConsentFrom(stored))

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.async = true
    script.src = `https://www.clarity.ms/tag/${tag}`
    document.head.appendChild(script)
  }, [])

  return null
}
