// ─────────────────────────────────────────────────────────────────
// lib/trustseal/detect.ts  (asq-trustseal-a2)
// Pure locale-detection utilities. NO side effects, NO redirects, NO middleware,
// NO host detection — these are building blocks A3 will later call. resolveLocale
// implements the agreed priority cascade but only RETURNS a locale; it never
// navigates or mutates anything.
//
// Priority: 1) saved cookie  2) URL locale  3) Accept-Language  4) geo suggestion
//           5) fallback en
// ─────────────────────────────────────────────────────────────────
import { LOCALES, DEFAULT_LOCALE, isLocale, type Locale } from './locales'

/** Extract the locale from a /trustseal/{locale}/… pathname, or null. */
export function localeFromPath(pathname: string | null | undefined): Locale | null {
  if (!pathname) return null
  const m = pathname.match(/^\/trustseal\/([a-z]{2})(?:\/|$)/i)
  return m && isLocale(m[1].toLowerCase()) ? (m[1].toLowerCase() as Locale) : null
}

/** Parse an Accept-Language header → highest-q supported Locale, or null. */
export function parseAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const q = params.find((p) => p.trim().startsWith('q='))
      return { base: tag.trim().toLowerCase().split('-')[0], q: q ? parseFloat(q.split('=')[1]) || 0 : 1 }
    })
    .filter((x) => x.base)
    .sort((a, b) => b.q - a.q)
  for (const { base } of ranked) if (isLocale(base)) return base
  return null
}

// Country (ISO-3166-1 alpha-2) → suggested locale. Suggestion only — never an
// override of an explicit cookie/URL/Accept-Language choice.
const COUNTRY_LOCALE: Record<string, Locale> = {
  IN: 'hi',
  // Spanish-speaking
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', PE: 'es', CL: 'es', VE: 'es', EC: 'es',
  GT: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es', SV: 'es', NI: 'es', CR: 'es', PA: 'es', UY: 'es',
  // Arabic-speaking
  SA: 'ar', AE: 'ar', EG: 'ar', MA: 'ar', DZ: 'ar', IQ: 'ar', SD: 'ar', SY: 'ar', YE: 'ar',
  JO: 'ar', TN: 'ar', LB: 'ar', LY: 'ar', PS: 'ar', OM: 'ar', KW: 'ar', QA: 'ar', BH: 'ar', MR: 'ar',
}

/** Map a country code → suggested locale, or null when there's no strong signal. */
export function geoSuggestion(country: string | null | undefined): Locale | null {
  if (!country) return null
  return COUNTRY_LOCALE[country.toUpperCase()] ?? null
}

export interface LocaleSignals {
  cookie?: string | null         // saved NEXT_LOCALE value (already-parsed string or raw)
  path?: string | null           // current pathname
  acceptLanguage?: string | null // Accept-Language header
  country?: string | null        // geo country code
}

/** Resolve a locale from all available signals using the agreed priority. Pure. */
export function resolveLocale(signals: LocaleSignals): Locale {
  const { cookie, path, acceptLanguage, country } = signals
  if (cookie && isLocale(cookie)) return cookie                  // 1. saved cookie
  const fromPath = localeFromPath(path); if (fromPath) return fromPath // 2. URL locale
  const fromLang = parseAcceptLanguage(acceptLanguage); if (fromLang) return fromLang // 3. Accept-Language
  const fromGeo = geoSuggestion(country); if (fromGeo) return fromGeo // 4. geo suggestion
  return DEFAULT_LOCALE                                          // 5. fallback en
}

/** Defensive: clamp any value to a known locale (else default). */
export function coerceLocale(value: string | null | undefined): Locale {
  return value && isLocale(value) ? value : DEFAULT_LOCALE
}

export { LOCALES }
