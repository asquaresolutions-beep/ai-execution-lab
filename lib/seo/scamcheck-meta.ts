// ─────────────────────────────────────────────────────────────────
// lib/seo/scamcheck-meta.ts
// Shared SEO metadata builder for ScamCheck pages: canonical URL, Open Graph,
// and Twitter cards in one call so every page is consistent. Pure.
// ─────────────────────────────────────────────────────────────────

import type { Metadata } from 'next'

export const SCAMCHECK_BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://scamcheck.asquaresolution.com'

export function buildMeta(opts: {
  path: string; title: string; description: string; keywords?: string[]; type?: 'website' | 'article'
  /** hreflang map, e.g. { en: '/link-scam-checker', es: '/es/link-checker', 'x-default': '/link-scam-checker' } (paths or absolute URLs). */
  languages?: Record<string, string>
  /** OpenGraph locale, e.g. 'es_ES'. Defaults to 'en_US'. */
  locale?: string
}): Metadata {
  const abs = (p: string) => (/^https?:\/\//.test(p) ? p : `${SCAMCHECK_BASE}${p.startsWith('/') ? p : `/${p}`}`)
  const url = abs(opts.path)
  const ogImage = `${SCAMCHECK_BASE}/opengraph-image`
  const languages = opts.languages
    ? Object.fromEntries(Object.entries(opts.languages).map(([k, v]) => [k, abs(v)]))
    : undefined
  return {
    // absolute → the root layout's "%s | AI Execution Lab" template never appends to ScamCheck pages
    title: { absolute: opts.title },
    description: opts.description,
    keywords: opts.keywords,
    // ScamCheck shield favicon — overrides the app-wide Lab icon on ScamCheck routes.
    icons: { icon: [{ url: '/scamcheck-icon.svg', type: 'image/svg+xml' }], shortcut: '/scamcheck-icon.svg', apple: '/scamcheck-icon.svg' },
    alternates: { canonical: url, ...(languages ? { languages } : {}) },
    openGraph: { title: opts.title, description: opts.description, url, type: opts.type ?? 'website', siteName: 'ScamCheck', locale: opts.locale ?? 'en_US', images: [{ url: ogImage }] },
    twitter: { card: 'summary_large_image', title: opts.title, description: opts.description, images: [ogImage] },
  }
}
