// ─────────────────────────────────────────────────────────────────
// lib/seo/scamcheck-meta.ts
// Shared SEO metadata builder for ScamCheck pages: canonical URL, Open Graph,
// and Twitter cards in one call so every page is consistent. Pure.
// ─────────────────────────────────────────────────────────────────

import type { Metadata } from 'next'

export const SCAMCHECK_BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://scamcheck.asquaresolution.com'

export function buildMeta(opts: { path: string; title: string; description: string; keywords?: string[]; type?: 'website' | 'article' }): Metadata {
  const url = `${SCAMCHECK_BASE}${opts.path.startsWith('/') ? opts.path : `/${opts.path}`}`
  const ogImage = `${SCAMCHECK_BASE}/opengraph-image`
  return {
    title: opts.title,
    description: opts.description,
    keywords: opts.keywords,
    alternates: { canonical: url },
    openGraph: { title: opts.title, description: opts.description, url, type: opts.type ?? 'website', siteName: 'ScamCheck', images: [{ url: ogImage }] },
    twitter: { card: 'summary_large_image', title: opts.title, description: opts.description, images: [ogImage] },
  }
}
