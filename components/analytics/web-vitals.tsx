'use client'

import { useReportWebVitals } from 'next/dist/client/web-vitals'

// ─────────────────────────────────────────────────────────────
// Web Vitals reporter
//
// Fires on CLS, FCP, FID, INP, LCP, TTFB. In production,
// sends to /api/vitals if the endpoint exists; otherwise
// logs to console in dev for local diagnosis.
//
// Usage: place <WebVitals /> inside a Client Component boundary
// (e.g. layout.tsx via a wrapper). It renders nothing — side
// effects only.
// ─────────────────────────────────────────────────────────────

const IS_DEV = process.env.NODE_ENV !== 'production'

export function WebVitals() {
  useReportWebVitals((metric) => {
    if (IS_DEV) {
      // Local dev: console output for quick diagnosis
      const { name, value, rating } = metric
      const colour =
        rating === 'good' ? '\x1b[32m' :
        rating === 'needs-improvement' ? '\x1b[33m' :
        '\x1b[31m'
      console.debug(`${colour}[Web Vitals] ${name}: ${Math.round(value)}ms (${rating})\x1b[0m`)
      return
    }

    // Production: send to analytics endpoint if available
    // Beacon API preferred — non-blocking, survives page unload
    const body = JSON.stringify({
      name:   metric.name,
      value:  metric.value,
      rating: metric.rating,
      id:     metric.id,
    })

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/vitals', body)
    }
  })

  return null
}
