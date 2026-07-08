'use client'

// Fires a single `embed_view` impression event when the embeddable checker mounts,
// keyed by the same `embed_source` that scan_start/scan_complete carry. This closes
// the funnel — impression → scan_start → scan_complete are now all attributable to
// the originating blog page via one consistent dimension, so per-source scan-rate is
// computable directly in GA4 without parsing page_location. Measurement-only; no UI.
//
// It ALSO beacons the impression to our own /api/scam-intel/track endpoint, so the
// funnel is queryable server-side (via /api/admin/scan-stats) independent of GA4.
// embed_view is the ONLY client-driven funnel event; scan_start/scan_complete are
// logged server-side in the screenshot route (authoritative).

import { useEffect } from 'react'
import { trackEvent } from '@/lib/track-event'

export function EmbedAnalytics({ source }: { source: string }) {
  useEffect(() => {
    trackEvent('embed_view', { check_type: 'screenshot', embed_source: source })
    // Best-effort server-side counter. sendBeacon survives page navigation and
    // never blocks; any failure is silently ignored (measurement must not error).
    try {
      const body = JSON.stringify({ event: 'embed_view', embed_source: source })
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/scam-intel/track', new Blob([body], { type: 'application/json' }))
      } else {
        void fetch('/api/scam-intel/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {})
      }
    } catch { /* noop */ }
  }, [source])
  return null
}
