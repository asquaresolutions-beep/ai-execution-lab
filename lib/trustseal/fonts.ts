// ─────────────────────────────────────────────────────────────────
// lib/trustseal/fonts.ts  (asq-trustseal-a6)
// TrustSeal font architecture. Latin (en/es) inherits the app's existing Inter
// (--font-geist-sans from the root layout). For scripts that Inter doesn't cover
// we add subsetted Noto faces via next/font, applied ONLY on the relevant locale
// wrapper — so en/es pages never download Arabic/Devanagari, and ScamCheck/Lab
// (which don't import this module) are unaffected.
//   • ar → Noto Sans Arabic
//   • hi → Noto Sans Devanagari
// `display:'swap'` + subsetting keep this within the performance budget.
// The faces are self-hosted via next/font/local (./noto-fonts.ts), copied from
// what the Google Fonts loader served, so builds no longer fetch from Google.
// ─────────────────────────────────────────────────────────────────
import { fontArabic, fontDevanagari } from './noto-fonts'
import type { Locale } from './locales'

export { fontArabic, fontDevanagari }

/** className that DEFINES the script-font CSS var for a locale (empty for Latin). */
export function localeFontClass(locale: Locale): string {
  if (locale === 'ar') return fontArabic.variable
  if (locale === 'hi') return fontDevanagari.variable
  return ''
}

/** font-family stack for a locale, preferring the script face then Inter. */
export function localeFontFamily(locale: Locale): string | undefined {
  if (locale === 'ar') return 'var(--ts-font-arabic), var(--font-geist-sans), system-ui, sans-serif'
  if (locale === 'hi') return 'var(--ts-font-devanagari), var(--font-geist-sans), system-ui, sans-serif'
  return undefined // en/es inherit the root Inter stack
}
