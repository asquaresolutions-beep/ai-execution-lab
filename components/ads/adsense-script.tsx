'use client'
// ─────────────────────────────────────────────────────────────────
// components/ads/adsense-script.tsx
// Loads the AdSense library once — and ONLY for non-paid users (paid
// users never even download the script → faster, cleaner, no spend).
// Loaded lazily (afterInteractive) so it never blocks LCP/TTI.
// ─────────────────────────────────────────────────────────────────

import Script from 'next/script'
import { usePaidUser } from './use-paid-user'

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || ''

export function AdSenseScript() {
  const paid = usePaidUser()
  // Skip entirely if unconfigured or for paid users.
  if (!CLIENT || paid === true) return null
  // Wait until we know the user is NOT paid before loading (avoids a flash
  // of script load that we'd immediately want to drop).
  if (paid !== false) return null
  return (
    <Script
      id="adsbygoogle-init"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`}
    />
  )
}
