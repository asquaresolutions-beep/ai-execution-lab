// ─────────────────────────────────────────────────────────────────
// lib/trustseal/messages/en.ts  (asq-trustseal-public-launch)
// English message catalogue — the single source of truth + the type origin for
// every locale (hi/es/ar must match this SHAPE). Plain nested namespaces
// (namespace → key → string). All public copy lives here so pages contain NO
// hardcoded strings — they read via t(locale, 'namespace.key').
// ─────────────────────────────────────────────────────────────────
export const en = {
  common: {
    product: 'TrustSeal',
    company: 'A Square Solutions',
    tagline: 'Business trust, reputation & verification',
    getStarted: 'Get started',
    talkToSales: 'Talk to sales',
    verifyNow: 'Verify a domain',
    learnMore: 'Learn more',
    copyright: '© 2026 A Square Solutions. All rights reserved.',
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
  switcher: { label: 'Language' },

  hero: {
    eyebrow: 'Trust Intelligence Platform',
    title: 'Verify any business in seconds',
    subtitle: 'TrustSeal turns domain ownership and reputation signals into a verifiable trust score — so customers, partners and platforms can trust who they deal with.',
    ctaPrimary: 'Verify a domain',
    ctaSecondary: 'See pricing',
    note: 'No card needed to verify · Pro unlocks the embeddable badge & Command Center',
  },

  metrics: {
    heading: 'Trusted signal, at scale',
    domainsVerified: 'Domains verified',
    trustChecks: 'Trust checks run',
    countries: 'Countries covered',
    uptime: 'Verification uptime',
  },

  how: {
    heading: 'How verification works',
    subheading: 'Three steps from unknown to verified.',
    step1Title: 'Claim your domain',
    step1Body: 'Add a single DNS TXT record to prove you control the domain. The first account to verify owns it.',
    step2Title: 'We compute trust',
    step2Body: 'TrustSeal evaluates ownership, TLS, reputation and risk signals into a single, explainable trust score.',
    step3Title: 'Show the seal',
    step3Body: 'Publish a live, tamper-resistant badge and a public seal page that updates as your standing changes.',
  },

  levels: {
    heading: 'Trust levels',
    subheading: 'Every domain maps to one clear band — matching the Command Center signal system.',
    verifiedName: 'Verified',
    verifiedDesc: 'Ownership confirmed and signals strong. Full confidence.',
    establishedName: 'Established',
    establishedDesc: 'Verified with a solid, consistent reputation history.',
    limitedName: 'Limited',
    limitedDesc: 'Verified but with thin or new signals. Proceed with normal care.',
    cautionName: 'Caution',
    cautionDesc: 'Anomalies detected. Review before transacting.',
    riskName: 'Risk',
    riskDesc: 'Blocklist or impersonation signals. High risk — avoid.',
  },

  feed: {
    heading: 'Live verification feed',
    subheading: 'A continuous stream of trust intelligence.',
    streaming: 'STREAMING',
  },

  network: {
    heading: 'The Trust Network',
    subheading: 'Domains, verifications and risk signals connected into one live topology — the same intelligence that powers the Command Center.',
    cta: 'Explore the Command Center',
  },

  pricing: {
    heading: 'Simple, transparent pricing',
    subheading: 'Start free. Upgrade when you need the badge and intelligence.',
    freeName: 'Free',
    freePrice: '₹0',
    freeTagline: 'For getting verified',
    freeF1: '1 verified domain',
    freeF2: 'Public seal page',
    freeF3: 'Standard re-verification',
    freeCta: 'Get started',
    proName: 'Pro',
    proPriceMonthly: '₹499/mo',
    proPriceYearly: '₹4,990/yr',
    proTagline: 'For businesses that show trust',
    proF1: 'Up to 10 domains',
    proF2: 'Embeddable signed badge',
    proF3: 'Trust Intelligence Command Center',
    proF4: 'Advanced analytics & priority re-verification',
    proCta: 'Go Pro',
    yearlyBadge: '2 months free',
    gstNote: 'Prices inclusive of 18% GST.',
  },

  faq: {
    heading: 'Frequently asked questions',
    q1: 'How does TrustSeal verify a domain?',
    a1: 'You add a DNS TXT record we generate. Once detected, ownership is confirmed and the first account to verify owns the domain.',
    q2: 'Is the badge tamper-resistant?',
    a2: 'Yes. The embeddable badge checks live status on every load and is origin-bound to the claimed domain, so a copied badge cannot fake verification.',
    q3: 'What do Pro and Free include?',
    a3: 'Free gives one verified domain and a public seal page. Pro adds the embeddable badge, the Command Center, analytics and multiple domains.',
    q4: 'Can I cancel anytime?',
    a4: 'Yes. Cancelling stops renewal — your Pro access continues until the end of the period you already paid for.',
    q5: 'Do you support international businesses?',
    a5: 'TrustSeal is available in English, Hindi, Spanish and Arabic, with full right-to-left support for Arabic.',
  },

  cta: {
    heading: 'Show the world you can be trusted',
    subheading: 'Verify your domain today and publish a trust signal customers recognise.',
    primary: 'Verify a domain',
    secondary: 'Talk to sales',
  },

  footer: {
    tagline: 'Business trust, reputation & verification.',
    product: 'Product',
    company: 'Company',
    legal: 'Legal',
    privacy: 'Privacy',
    terms: 'Terms',
    security: 'Security',
    about: 'About',
    contact: 'Contact',
    builtBy: 'TrustSeal is built by A Square Solutions.',
  },
} as const

export type Messages = typeof en
