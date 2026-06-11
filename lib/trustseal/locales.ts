// ─────────────────────────────────────────────────────────────────
// lib/trustseal/locales.ts  (asq-trustseal-a1)
// Single source of truth for TrustSeal's supported locales + direction.
// Pure, dependency-free — safe to import from server components, layouts,
// and (later) middleware. NO detection logic here (that is Phase A2/A3);
// this module only declares the locale set and the LTR/RTL mapping.
// ─────────────────────────────────────────────────────────────────

export const LOCALES = ['en', 'hi', 'es', 'ar'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

/** Right-to-left locales. Arabic is the only RTL locale for now. */
export const RTL_LOCALES: readonly Locale[] = ['ar'] as const

/** Human-readable names (for the future switcher — A2). */
export const LOCALE_LABEL: Record<Locale, string> = {
  en: 'English',
  hi: 'हिन्दी',
  es: 'Español',
  ar: 'العربية',
}

/** Type guard: is an arbitrary string one of our supported locales? */
export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

/** Text direction for a locale. Drives the wrapper `dir` attribute. */
export function dirFor(locale: Locale): 'rtl' | 'ltr' {
  return RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr'
}
