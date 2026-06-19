// lib/track-event.ts
// Client-side conversion event helper. Fires the event to GA4 (gtag), Plausible,
// and the dataLayer (GTM-compat) — whichever is present. Safe no-op on the server
// or when no analytics is loaded. Measurement only; no UI/state side-effects.
//
// NOTE: the site loads gtag.js directly (no GTM container), so GA4 events MUST be
// sent via gtag('event', …). Pushing only to dataLayer does NOT reach GA4 here.

export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return
  const w = window as unknown as {
    gtag?: (command: string, eventName: string, params?: Record<string, unknown>) => void
    plausible?: (name: string, opts?: { props?: Record<string, unknown> }) => void
    dataLayer?: unknown[]
  }
  try { w.gtag?.('event', name, params) } catch { /* noop */ }
  try { w.plausible?.(name, { props: params }) } catch { /* noop */ }
  try { w.dataLayer?.push({ event: name, ...params }) } catch { /* noop */ }
}
