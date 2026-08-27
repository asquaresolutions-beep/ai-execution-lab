// ─────────────────────────────────────────────────────────────────
// lib/email/tags.ts   (asq-email-observability-v1)
//
// Builds the Resend `tags` array that lets an inbound webhook event be attributed
// back to the campaign that produced it.
//
// Wired into sendListEmail() in lib/email/notify.ts. Only the two campaign call
// sites in lib/newsletter/campaigns.ts pass a campaignId; every other caller gets
// undefined here and therefore an unchanged payload.
//
// ── Why sanitising is a safety requirement, not politeness ────────
// Resend restricts tag names and values to ASCII letters, digits, underscore and
// dash, up to 256 characters. An invalid tag makes the API REJECT the whole send —
// so an unsanitised campaign id could turn "add attribution" into "newsletter no
// longer sends". Every value is therefore coerced, and if nothing survives
// coercion the tag is omitted entirely rather than sent malformed.
//
// Today's ids (`scamcheck-fake-screenshot-2026-08-26`, `asquare-signal-001`,
// `scamcheck-weekly-YYYY-MM-DD`) are already valid; this guards future ones.
// ─────────────────────────────────────────────────────────────────

/** Resend tag entry. Both fields are constrained to [A-Za-z0-9_-]. */
export interface EmailTag {
  name: string
  value: string
}

const MAX_TAG_LEN = 256

/**
 * Coerce an arbitrary string into a Resend-safe tag value.
 * Disallowed characters become '-'; runs collapse; result is trimmed of leading
 * and trailing dashes and capped at 256 chars. Returns '' if nothing survives.
 */
export function sanitizeTagValue(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_TAG_LEN)
}

/**
 * Build the tags array for a campaign send, or undefined when there is no usable
 * campaign id — so the payload keeps its exact current shape for every non-campaign
 * email (welcome sequence, TrustSeal monitoring, transactional).
 */
export function campaignTags(campaignId?: string): EmailTag[] | undefined {
  const value = sanitizeTagValue(campaignId)
  if (!value) return undefined
  return [{ name: 'campaignId', value }]
}
