// ─────────────────────────────────────────────────────────────────
// lib/seo/paths.ts
// Enumerates every programmatic page path for generateStaticParams +
// sitemap. Caps combos to keep the build fast and hobby-friendly.
// ─────────────────────────────────────────────────────────────────

import { SCAM_TYPES, CITIES, BANKS, UPI_APPS, PLATFORMS, COMBO_TYPES, COMBO_CITIES } from './facets'

/** All slugs as string[] arrays for the optional catch-all route. */
export function allScamPathSlugs(): string[][] {
  const out: string[][] = []
  out.push([]) // /scams hub
  for (const t of SCAM_TYPES) out.push(['type', t.id])
  for (const c of CITIES) out.push(['city', c.id])
  for (const b of BANKS) out.push(['bank', b.id])
  for (const u of UPI_APPS) out.push(['upi', u.id])
  for (const p of PLATFORMS) out.push(['platform', p.id])
  // Combos: top types × top cities.
  for (const t of COMBO_TYPES) for (const c of COMBO_CITIES) out.push(['type', t, c])
  return out
}

/** Absolute path strings for the sitemap. */
export function allScamPaths(): string[] {
  return allScamPathSlugs().map((s) => `/scams${s.length ? '/' + s.join('/') : ''}`)
}

export function pageCount(): { total: number; types: number; cities: number; banks: number; upi: number; platforms: number; combos: number } {
  return {
    total: allScamPathSlugs().length,
    types: SCAM_TYPES.length,
    cities: CITIES.length,
    banks: BANKS.length,
    upi: UPI_APPS.length,
    platforms: PLATFORMS.length,
    combos: COMBO_TYPES.length * COMBO_CITIES.length,
  }
}
