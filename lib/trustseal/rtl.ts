// ─────────────────────────────────────────────────────────────────
// lib/trustseal/rtl.ts  (asq-trustseal-a6)
// RTL utility layer + direction helpers. Pure, no rendering. The wrapper `dir`
// (set in the [locale] layout via dirFor) does 80% of the work; these helpers
// cover the rare cases where JS genuinely needs a physical side (e.g. computing
// a transform origin). Components must otherwise use CSS LOGICAL properties
// (ms-/me-/ps-/pe-/text-start/end/start-/end-) — see rtl-conventions.md and the
// physical-class guardrail test.
// ─────────────────────────────────────────────────────────────────
import { RTL_LOCALES, dirFor, type Locale } from './locales'

export type Dir = 'ltr' | 'rtl'

/** Is this locale right-to-left? */
export function isRtlLocale(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale)
}

/** Physical side that corresponds to the INLINE-START edge for a direction. */
export function inlineStart(dir: Dir): 'left' | 'right' {
  return dir === 'rtl' ? 'right' : 'left'
}

/** Physical side that corresponds to the INLINE-END edge for a direction. */
export function inlineEnd(dir: Dir): 'left' | 'right' {
  return dir === 'rtl' ? 'left' : 'right'
}

export { dirFor }
