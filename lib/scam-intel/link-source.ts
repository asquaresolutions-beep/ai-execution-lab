// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/link-source.ts
// Funnel attribution for scans that arrive via a TAGGED LINK rather than an embed.
//
// A Square Solutions pages link to ScamCheck with UTM tags they already carry
// (?utm_source=blog&utm_medium=cta&utm_campaign=<page>). Routes that render the
// analyzer without an embed `source` logged those scans as 'unknown'. This derives
// `${utm_source}.${utm_campaign}` from the tags already in the URL — no new
// parameter. The '.' namespace keeps it distinct from embed sources (bare page
// slugs), so per-embed metrics keep their meaning. Pure and dependency-free;
// scan-log's slug() still sanitizes (≤64 chars, [a-z0-9._-]) whatever this returns.
// ─────────────────────────────────────────────────────────────────

export function linkSourceFromSearch(search: string): string | undefined {
  let p: URLSearchParams
  try { p = new URLSearchParams(search) } catch { return undefined }
  const campaign = (p.get('utm_campaign') || '').trim()
  if (!campaign) return undefined
  return `${(p.get('utm_source') || '').trim() || 'utm'}.${campaign}`
}
