// ─────────────────────────────────────────────────────────────────
// lib/trustseal/seo.ts  (asq-trustseal-a4)
// TrustSeal SEO/metadata architecture: locale-aware Next Metadata with hreflang
// (en/hi/es/ar + x-default), canonical, and OpenGraph locale. Mirrors the shape
// of the existing scamcheck-meta buildMeta() but TrustSeal-branded and locale-first.
//
// Phase-A placeholders stay `noindex` by default (index:false) — pass index:true
// only when real content ships (Phase C). Base URL is env-overridable so the
// canonical/hreflang reflect the eventual public host once A3 attaches it.
// ─────────────────────────────────────────────────────────────────
import type { Metadata } from 'next'
import { LOCALES, DEFAULT_LOCALE, type Locale } from './locales'
import { coerceLocale } from './detect'
import { withLocale } from './navigation'

// Public base for TrustSeal. Until the host is attached (A3) this still produces
// correct, stable absolute URLs for canonical + hreflang.
const BASE = (process.env.TRUSTSEAL_BASE_URL || 'https://trustseal.asquaresolution.com').replace(/\/$/, '')

// OpenGraph locale codes (lang_TERRITORY).
const OG_LOCALE: Record<Locale, string> = {
  en: 'en_US',
  hi: 'hi_IN',
  es: 'es_ES',
  ar: 'ar_SA',
}

const abs = (path: string) => `${BASE}${path}`

/** hreflang map for a locale-agnostic subpath: every locale + x-default→en. */
export function trustHreflang(subpath = ''): Record<string, string> {
  const languages: Record<string, string> = {}
  for (const l of LOCALES) languages[l] = abs(withLocale(l, subpath))
  languages['x-default'] = abs(withLocale(DEFAULT_LOCALE, subpath))
  return languages
}

/** Absolute canonical URL for a given locale + subpath. */
export function trustCanonical(locale: Locale, subpath = ''): string {
  return abs(withLocale(locale, subpath))
}

export interface TrustMetaOpts {
  locale: string
  /** Locale-agnostic path, e.g. '/pricing' or '' for the home. */
  subpath?: string
  title: string
  description: string
  /** Index this page? Defaults to FALSE (Phase-A scaffolds stay noindex). */
  index?: boolean
}

/** Build locale-aware Next Metadata for a TrustSeal page. */
export function buildTrustMeta(opts: TrustMetaOpts): Metadata {
  const locale = coerceLocale(opts.locale)
  const subpath = opts.subpath ?? ''
  const canonical = trustCanonical(locale, subpath)
  const index = opts.index ?? false
  return {
    title: { absolute: opts.title },
    description: opts.description,
    alternates: { canonical, languages: trustHreflang(subpath) },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url: canonical,
      siteName: 'TrustSeal',
      locale: OG_LOCALE[locale],
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title: opts.title, description: opts.description },
    // Phase-A placeholders are intentionally noindex until real content (Phase C).
    robots: index ? undefined : { index: false, follow: false },
  }
}
