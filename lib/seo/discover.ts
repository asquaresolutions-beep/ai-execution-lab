// ─────────────────────────────────────────────────────────────────
// lib/seo/discover.ts
// Google Discover optimization helpers: strong (non-clickbait) headlines,
// emotional-but-honest hooks, freshness handling, and image guidance.
// Deterministic — no AI cost.
// ─────────────────────────────────────────────────────────────────

export interface DiscoverMeta {
  headline: string            // primary, scannable, honest
  altHeadlines: string[]      // variants for A/B / social
  hook: string                // emotional but truthful opening
  imageRecommendation: ImageRec
  freshnessLabel: string      // human "Updated …"
  isFresh: boolean
}

export interface ImageRec {
  minWidth: number            // Discover prefers large images (≥1200px)
  aspectRatio: string
  altText: string
  ogImagePath: string         // dynamic OG route
  guidance: string
}

const FRESH_WINDOW_DAYS = 30

export function buildDiscoverMeta(opts: {
  subject: string             // e.g. "UPI fraud in Mumbai"
  typeName: string            // e.g. "UPI Fraud"
  region?: string
  updatedAt: number
}): DiscoverMeta {
  const { subject, typeName, region, updatedAt } = opts
  const place = region && region !== 'India' ? ` in ${region}` : ''

  // Honest, specific, benefit-led headlines (no fake urgency / clickbait).
  const headline = `${typeName}${place}: How It Works and How to Stay Safe`
  const altHeadlines = [
    `${typeName} Explained — Warning Signs and What to Do`,
    `Is It a ${typeName}? A Quick Way to Check${place}`,
    `${typeName}${place}: Spot It, Stop It, Report It`,
  ]

  const hook = `${typeName} is rising${place ? place : ' across India'} — and a few seconds of checking can save your money. Here is exactly how it works and how to protect yourself.`

  const ageDays = (Date.now() - updatedAt) / 86_400_000
  const isFresh = ageDays <= FRESH_WINDOW_DAYS

  return {
    headline,
    altHeadlines,
    hook,
    freshnessLabel: relativeUpdated(updatedAt),
    isFresh,
    imageRecommendation: {
      minWidth: 1200,
      aspectRatio: '1.91:1',
      altText: `Illustration: how a ${subject} works and how to stay safe`,
      ogImagePath: `/api/og?title=${encodeURIComponent(headline)}`,
      guidance: 'Use a single high-quality ≥1200px image (no logos/text overlay spam). Mark large image preview via robots max-image-preview:large (set in metadata).',
    },
  }
}

export function relativeUpdated(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86_400_000)
  if (days <= 0) return 'Updated today'
  if (days === 1) return 'Updated yesterday'
  if (days < 30) return `Updated ${days} days ago`
  const months = Math.floor(days / 30)
  return `Updated ${months} month${months > 1 ? 's' : ''} ago`
}
