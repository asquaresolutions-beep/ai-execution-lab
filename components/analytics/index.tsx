/**
 * Analytics component — environment-gated, zero-config in dev.
 *
 * Supported integrations (all driven by env vars, no code changes needed):
 *
 *   Plausible:        set NEXT_PUBLIC_PLAUSIBLE_DOMAIN=yourdomain.com
 *   Google Analytics: set NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
 *   Vercel Analytics: install @vercel/analytics, then uncomment the import below
 *
 * None of these fire in NODE_ENV=development.
 */

// ── Vercel Analytics ─────────────────────────────────────────
// To enable: npm install @vercel/analytics  (or equivalent node install)
// Then uncomment the two lines below:
//
// import { Analytics as VercelAnalytics } from '@vercel/analytics/react'
// const VERCEL_ANALYTICS = true
const VERCEL_ANALYTICS = false

// ── Runtime env vars ─────────────────────────────────────────
const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
const GA_ID            = process.env.NEXT_PUBLIC_GA_ID

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function Analytics() {
  // Only fire in production
  if (process.env.NODE_ENV !== 'production') return null

  return (
    <>
      {/* Plausible — lightweight, privacy-first, no cookies */}
      {PLAUSIBLE_DOMAIN && (
        <script
          defer
          // eslint-disable-next-line react/no-unknown-property
          {...{ 'data-domain': PLAUSIBLE_DOMAIN } as Record<string, string>}
          src="https://plausible.io/js/script.js"
        />
      )}

      {/* Google Analytics 4 */}
      {GA_ID && (
        <>
          <script
            async
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          />
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer=window.dataLayer||[];
                function gtag(){dataLayer.push(arguments);}
                gtag('js',new Date());
                gtag('config','${GA_ID}',{page_path:window.location.pathname});
              `,
            }}
          />
        </>
      )}

      {/* Vercel Analytics — uncomment VERCEL_ANALYTICS=true above after installing package */}
      {/* {VERCEL_ANALYTICS && <VercelAnalytics />} */}
    </>
  )
}

// ── Web Vitals hook ──────────────────────────────────────────
// Wire this into next.config.js reportWebVitals or a layout useReportWebVitals
// to send Core Web Vitals to your analytics platform.
//
// export function reportWebVitals(metric: { name: string; value: number; id: string }) {
//   if (GA_ID) {
//     gtag('event', metric.name, {
//       event_category: 'Web Vitals',
//       value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
//       event_label: metric.id,
//       non_interaction: true,
//     })
//   }
// }
