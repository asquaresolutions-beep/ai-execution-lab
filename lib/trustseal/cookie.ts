// ─────────────────────────────────────────────────────────────────
// lib/trustseal/cookie.ts  (asq-trustseal-a2)
// Locale persistence cookie helpers. Pure parsers + a client-side setter.
// NO redirects, NO middleware, NO server mutation here — A2 is utilities only.
// Cookie name matches the de-facto Next.js convention (NEXT_LOCALE) so a future
// next-intl migration reads the same cookie.
// ─────────────────────────────────────────────────────────────────
import { isLocale, type Locale } from './locales'

export const LOCALE_COOKIE = 'NEXT_LOCALE'
const ONE_YEAR = 60 * 60 * 24 * 365

/** Parse a raw Cookie header (or document.cookie) → saved Locale, or null. */
export function readLocaleCookie(cookieHeader: string | null | undefined): Locale | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === LOCALE_COOKIE) {
      const val = decodeURIComponent((v.join('=') || '').trim())
      return isLocale(val) ? val : null
    }
  }
  return null
}

/** Build a `Set-Cookie` value (for any future server use). Does not set anything. */
export function serializeLocaleCookie(locale: Locale): string {
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`
}

/** Client-only: persist the chosen locale to document.cookie. No navigation. */
export function writeLocaleCookie(locale: Locale): void {
  if (typeof document === 'undefined') return
  document.cookie = serializeLocaleCookie(locale)
}
