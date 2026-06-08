// ─────────────────────────────────────────────────────────────────
// lib/scamcheck/blog-resources.ts
// asq-growth-links-v1 — curated map of A Square Solutions blog guides used for
// ScamCheck → blog internal linking (authority cluster + subscriber growth).
//
// Pure data + a small relevance selector. Used by <ScamResources/> to render a
// "Related guides" block with descriptive anchors + ItemList JSON-LD, and by the
// WP growth planner (scripts/wp/plan-blog-growth.mjs) as the reciprocal link map.
//
// Rollback: delete this file + its importers (asq-growth-links-v1).
// ─────────────────────────────────────────────────────────────────

const BLOG = 'https://asquaresolution.com/blog/'
export const BLOG_HUB = 'https://asquaresolution.com/blog/'

export interface BlogResource {
  /** Blog post slug (without trailing slash). */
  slug: string
  url: string
  title: string
  /** One-line, benefit-led blurb (SEO + UX). */
  blurb: string
  /** Checker slugs this guide is most relevant to (for relevance ranking). */
  relevantTo: string[]
}

const R = (slug: string, title: string, blurb: string, relevantTo: string[]): BlogResource => ({
  slug, url: `${BLOG}${slug}/`, title, blurb, relevantTo,
})

export const BLOG_RESOURCES: BlogResource[] = [
  R('whatsapp-scam-detection-guide', 'WhatsApp Scam Detection Guide',
    'Spot fake refunds, job offers, and impersonation in WhatsApp chats.',
    ['whatsapp-scam-checker', 'sms-scam-checker']),
  R('courier-parcel-scam-texts', 'Courier & Parcel Scam Texts',
    'Why “pending delivery fee” SMS links steal your card details.',
    ['sms-scam-checker', 'whatsapp-scam-checker']),
  R('upi-refund-qr-code-scams', 'UPI Refund & QR-Code Scams',
    'How “scan to receive” and collect-requests actually take your money.',
    ['upi-scam-checker', 'whatsapp-scam-checker']),
  R('how-to-identify-phishing-emails', 'How to Identify Phishing Emails',
    'Read sender domains and spoofed look-alikes before you click.',
    ['email-scam-checker']),
  R('ai-voice-deepfake-scams', 'AI Voice & Deepfake Scams',
    'New AI-cloned-voice “family emergency” scams and how to verify.',
    ['phone-scam-checker', 'whatsapp-scam-checker']),
  R('is-this-link-safe-how-to-check-a-url', 'Is This Link Safe? How to Check a URL',
    'A 30-second checklist to vet any link before you tap it.',
    ['link-scam-checker', 'sms-scam-checker', 'email-scam-checker']),
  R('fake-upi-payment-screenshot-scam', 'Fake UPI Payment Screenshot Scam',
    'How sellers are fooled by forged “payment successful” screenshots.',
    ['screenshot-scam-checker', 'upi-scam-checker']),
]

const BY_SLUG: Record<string, BlogResource> = Object.fromEntries(BLOG_RESOURCES.map((r) => [r.slug, r]))
export function getBlogResource(slug: string): BlogResource | undefined { return BY_SLUG[slug] }

/**
 * Pick the most relevant blog resources for a checker page.
 * Order: guides that list this checker as relevant (own guide first), then fill
 * with the remaining guides — always returning `limit` distinct resources.
 */
export function resourcesForChecker(checkerSlug: string, limit = 3): BlogResource[] {
  const relevant = BLOG_RESOURCES.filter((r) => r.relevantTo.includes(checkerSlug))
  const rest = BLOG_RESOURCES.filter((r) => !r.relevantTo.includes(checkerSlug))
  const ordered = [...relevant, ...rest]
  // de-dup defensively (in case of overlapping membership) and clamp
  const seen = new Set<string>()
  const out: BlogResource[] = []
  for (const r of ordered) {
    if (seen.has(r.slug)) continue
    seen.add(r.slug); out.push(r)
    if (out.length >= limit) break
  }
  return out
}
