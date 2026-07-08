'use client'

// Fires a single `embed_view` impression event when the embeddable checker mounts,
// keyed by the same `embed_source` that scan_start/scan_complete carry. This closes
// the funnel — impression → scan_start → scan_complete are now all attributable to
// the originating blog page via one consistent dimension, so per-source scan-rate is
// computable directly in GA4 without parsing page_location. Measurement-only; no UI.

import { useEffect } from 'react'
import { trackEvent } from '@/lib/track-event'

export function EmbedAnalytics({ source }: { source: string }) {
  useEffect(() => {
    trackEvent('embed_view', { check_type: 'screenshot', embed_source: source })
  }, [source])
  return null
}
