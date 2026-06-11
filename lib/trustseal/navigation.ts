// ─────────────────────────────────────────────────────────────────
// lib/trustseal/navigation.ts  (asq-trustseal-a2)
// Pure locale-path helpers for the switcher + links. NO programmatic navigation
// here — these only compute hrefs. The TrustSeal scaffold lives under
// /trustseal/{locale}/… (see Phase A1).
// ─────────────────────────────────────────────────────────────────
import { DEFAULT_LOCALE, isLocale, type Locale } from './locales'

const PREFIX = '/trustseal'

/** Build /trustseal/{locale}{subpath}. subpath should start with '/' or be ''. */
export function withLocale(locale: Locale, subpath = ''): string {
  const tail = subpath && !subpath.startsWith('/') ? `/${subpath}` : subpath
  return `${PREFIX}/${locale}${tail}`
}

/** Remove the /trustseal/{locale} prefix → the locale-agnostic subpath ('' for home). */
export function stripLocalePrefix(pathname: string): string {
  const m = pathname.match(/^\/trustseal\/[a-z]{2}(\/.*)?$/i)
  if (!m) return pathname.startsWith(PREFIX) ? pathname.slice(PREFIX.length) || '' : pathname
  return m[1] ?? ''
}

/**
 * Same page, different locale. Swaps the locale segment of a /trustseal/{cur}/…
 * path → /trustseal/{target}/…  If the path has no locale segment, returns the
 * localized home. Pure; returns an href (the switcher navigates via <Link>).
 */
export function localizePath(pathname: string, target: Locale): string {
  if (!isLocale(target)) target = DEFAULT_LOCALE
  const m = pathname.match(/^(\/trustseal)\/[a-z]{2}(\/.*)?$/i)
  if (!m) return withLocale(target)
  return `${m[1]}/${target}${m[2] ?? ''}`
}
