// ─────────────────────────────────────────────────────────────────
// lib/trustseal/band.ts  (asq-trustseal-phase2)
// Single source of truth for the five TrustSeal trust bands (Badge V2): color,
// background tint, icon glyph, and the i18n label key. Used by the embeddable
// badge (badge.js), the public seal page, the badge preview, and the API, so the
// five levels look and read identically everywhere. Colors match the Command
// Center signal system.
// ─────────────────────────────────────────────────────────────────
import type { VerifyBand } from './verify/types'

export type Band = VerifyBand // 'verified' | 'established' | 'limited' | 'caution' | 'high_risk'

export interface BandMeta {
  /** Primary brand color (hex) for the band. */
  color: string
  /** Soft background tint (rgba) for chips/badges. */
  bg: string
  /** Single-glyph icon rendered in the badge/seal. */
  icon: string
  /** i18n key for the localized level name (levels.*Name). */
  labelKey: string
  /** Stable English name (for the API payload + non-localized contexts). */
  name: string
}

export const BAND_META: Record<Band, BandMeta> = {
  verified:  { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  icon: '✓', labelKey: 'levels.verifiedName',    name: 'Verified' },
  established:{ color: '#22d3ee', bg: 'rgba(34,211,238,0.12)',  icon: '★', labelKey: 'levels.establishedName', name: 'Established' },
  limited:   { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: '◐', labelKey: 'levels.limitedName',     name: 'Limited' },
  caution:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  icon: '!', labelKey: 'levels.cautionName',     name: 'Caution' },
  high_risk: { color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: '✕', labelKey: 'levels.riskName',        name: 'Risk' },
}

const FALLBACK = BAND_META.verified

export function bandMeta(band: string | null | undefined): BandMeta {
  return (band && BAND_META[band as Band]) || FALLBACK
}

/** All bands in display order (best → worst) — for legends / dashboards. */
export const BANDS_ORDERED: Band[] = ['verified', 'established', 'limited', 'caution', 'high_risk']
