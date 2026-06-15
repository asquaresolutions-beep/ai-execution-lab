// ─────────────────────────────────────────────────────────────────
// lib/trustseal/format.ts  (asq-trustseal-harden-i18n)
// Locale-aware formatting helpers. Replaces ad-hoc toLocaleDateString() (which
// used the runtime default locale, so dashboard/seal dates rendered in English
// regardless of the selected UI locale). Arabic renders Arabic-Indic numerals
// and Arabic month names; Hindi/Spanish render localized month names.
// ─────────────────────────────────────────────────────────────────
import type { Locale } from './locales'

// BCP-47 tags. Plain 'ar' yields Arabic-Indic digits + Arabic months.
const TAG: Record<Locale, string> = { en: 'en', hi: 'hi', es: 'es', ar: 'ar' }

/** Localized long date (e.g. "June 15, 2027" / "15 जून 2027" / "١٥ يونيو ٢٠٢٧"). */
export function formatDate(
  locale: Locale,
  value: number | string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' },
): string {
  if (value == null || value === '') return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  try {
    return new Intl.DateTimeFormat(TAG[locale] ?? 'en', opts).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}
