// ─────────────────────────────────────────────────────────────────
// lib/trustseal/navigation.ts  (asq-trustseal-a2; clean public URLs a3)
// Pure locale-path helpers for the switcher, links, canonical + hreflang.
// PUBLIC TrustSeal URLs are clean: /{locale}/…  (Phase A3). The internal Next
// routes still live at /trustseal/[locale]/… — the middleware rewrites
// public→internal and 301s internal→public, so the /trustseal prefix NEVER
// appears in canonical/hreflang/links. INTERNAL_PREFIX is documented here for
// reference but only middleware.ts consumes it.
// ─────────────────────────────────────────────────────────────────
import { DEFAULT_LOCALE, isLocale, type Locale } from './locales'

/** Internal Next route prefix. Public URLs omit it; only the middleware uses it. */
export const INTERNAL_PREFIX = '/trustseal'

/** Public locale path: /{locale}{subpath}. subpath should start with '/' or be ''. */
export function withLocale(locale: Locale, subpath = ''): string {
  const tail = subpath && !subpath.startsWith('/') ? `/${subpath}` : subpath
  return `/${locale}${tail}`
}

/** Parse a leading /{locale} segment (locale-validated), or null. */
function leadingLocale(pathname: string): { locale: Locale; rest: string } | null {
  const m = pathname.match(/^\/([a-z]{2})(\/.*)?$/i)
  if (!m) return null
  const loc = m[1].toLowerCase()
  return isLocale(loc) ? { locale: loc, rest: m[2] ?? '' } : null
}

/** Remove the leading /{locale} → the locale-agnostic subpath ('' for home). */
export function stripLocalePrefix(pathname: string): string {
  const p = leadingLocale(pathname)
  return p ? p.rest : pathname
}

/**
 * Same page, different locale. Swaps the leading /{locale} → /{target}{rest}.
 * If there's no locale segment, returns the localized home. Pure (returns an
 * href; the switcher navigates via <Link>).
 */
export function localizePath(pathname: string, target: Locale): string {
  if (!isLocale(target)) target = DEFAULT_LOCALE
  const p = leadingLocale(pathname)
  return p ? `/${target}${p.rest}` : withLocale(target)
}
