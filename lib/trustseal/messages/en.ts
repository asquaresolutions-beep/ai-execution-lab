// ─────────────────────────────────────────────────────────────────
// lib/trustseal/messages/en.ts  (asq-trustseal-a5)
// English message catalogue — the single source of truth + the type origin for
// all locales. Shape is a plain nested namespace object (namespace → key →
// string), identical to what next-intl consumes, so a future migration is just:
// move this to en.json, add hi/es/ar.json, swap the accessor. English ONLY in
// Phase A5 (no hi/es/ar yet — they fall back to en).
// ─────────────────────────────────────────────────────────────────
export const en = {
  common: {
    product: 'TrustSeal',
    tagline: 'Business trust, reputation & verification',
    getStarted: 'Get started',
    talkToSales: 'Talk to sales',
  },
  nav: {
    product: 'Product',
    verify: 'Verify',
    pricing: 'Pricing',
    enterprise: 'Enterprise',
    customers: 'Customers',
    security: 'Security',
    docs: 'Docs',
    dashboard: 'Dashboard',
  },
  switcher: {
    label: 'Language',
  },
} as const

export type Messages = typeof en
