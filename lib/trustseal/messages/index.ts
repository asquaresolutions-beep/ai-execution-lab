// ─────────────────────────────────────────────────────────────────
// lib/trustseal/messages/index.ts  (asq-trustseal-a5)
// Typed dictionary registry + translation accessor `t()`.
//
// Phase A5 ships English ONLY; hi/es/ar are intentionally absent and fall back
// to English (so every page renders today, no missing-key holes). The registry +
// `t(locale, 'namespace.key')` API mirror next-intl's message-catalogue model:
// to migrate later, register hi/es/ar dictionaries here (or move to JSON +
// next-intl) — call sites that use string keys need no change.
// ─────────────────────────────────────────────────────────────────
import { DEFAULT_LOCALE, type Locale } from '../locales'
import { en, type Messages } from './en'
import { hi } from './hi'
import { es } from './es'
import { ar } from './ar'

export type { Messages }

// Locale → dictionary. All four locales are registered; hi/es/ar currently carry
// English placeholder values (see each file) until professional translations land —
// swapping those values needs no change here or at any call site.
const DICTIONARIES: Partial<Record<Locale, Messages>> = { en, hi, es, ar }

/** Full message object for a locale, falling back to English. */
export function getMessages(locale: Locale): Messages {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE] ?? en
}

/** Has a real (non-fallback) dictionary been provided for this locale yet? */
export function hasDictionary(locale: Locale): boolean {
  return Boolean(DICTIONARIES[locale])
}

function lookup(dict: Messages, key: string): string | null {
  const value = key.split('.').reduce<unknown>(
    (acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined),
    dict,
  )
  return typeof value === 'string' ? value : null
}

/**
 * Translate a dot-path key for a locale, with English fallback, then the raw key
 * as a last resort (so a typo renders visibly rather than crashing). Pure.
 */
export function t(locale: Locale, key: string): string {
  return lookup(getMessages(locale), key) ?? lookup(en, key) ?? key
}
