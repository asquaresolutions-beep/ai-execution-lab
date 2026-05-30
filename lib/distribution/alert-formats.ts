// ─────────────────────────────────────────────────────────────────
// lib/distribution/alert-formats.ts
// Real-time, per-channel alert formatters — DETERMINISTIC (no AI cost).
//
// Turns a scam type/cluster + place into channel-native alert snippets:
// X/Twitter, LinkedIn, WhatsApp, Telegram, and a YouTube Shorts hook.
// Used for fast, free distribution of trending alerts; the full AI bundle
// (generators.ts) remains available for long-form social copy.
// ─────────────────────────────────────────────────────────────────

import { SCAM_TYPE_BY_ID, type ScamType } from '@/lib/seo/facets'

export interface AlertInput {
  typeId: string
  place?: string          // city/bank/platform
  reportCount?: number
  url?: string            // canonical page URL for backlink
}

export interface AlertFormats {
  twitter: string         // ≤ 280 chars
  linkedin: string
  whatsapp: string        // forward-friendly, emoji headers
  telegram: string        // Markdown
  shortsHook: string      // first 3 seconds of a reel
  hashtags: string[]
}

const BASE = (process.env.NEXT_PUBLIC_SCAM_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://scamcheck.asquaresolution.com').replace(/\/$/, '')

export function formatAlert(input: AlertInput): AlertFormats | null {
  const t = SCAM_TYPE_BY_ID.get(input.typeId)
  if (!t) return null
  const place = input.place ? ` (${input.place})` : ''
  const url = input.url || `${BASE}/scams/type/${t.id}`
  const sign = t.signs[0]
  const protect = t.protect[0]
  const hashtags = buildHashtags(t, input.place)

  const twitter = clip(
    `🚨 ${t.name} alert${place}\n${sign}.\n✅ ${protect}\nReport: 1930\n${url}`,
    280,
  )

  const linkedin =
    `🚨 Scam alert: ${t.name}${place}\n\n` +
    `How it works: ${t.hook}\n\n` +
    `Warning signs:\n${t.signs.map((s) => `• ${s}`).join('\n')}\n\n` +
    `Stay safe: ${t.protect.join('. ')}.\n\n` +
    `If targeted, report to the cyber-fraud helpline 1930 and cybercrime.gov.in.\n\n` +
    `${hashtags.slice(0, 4).map((h) => '#' + h).join(' ')}\n${url}`

  const whatsapp =
    `🚨 *${t.name} Scam Alert*${place}\n\n` +
    `⚠️ ${sign}\n\n` +
    `✅ ${protect}\n` +
    `📞 Report fraud: *1930*\n\n` +
    `🔗 ${url}\n_Forwarded by ScamCheck — verify before you trust._`

  const telegram =
    `🚨 *${t.name} Scam Alert*${place}\n\n` +
    `${t.hook}\n\n` +
    `*Warning signs:*\n${t.signs.map((s) => `• ${s}`).join('\n')}\n\n` +
    `*Do this:* ${protect}\n` +
    `*Report:* 1930 · cybercrime.gov.in\n\n` +
    `[Full guide](${url})`

  const shortsHook = `Got this message? It could be a ${t.name.toLowerCase()}. Here's the one sign that gives it away…`

  return { twitter, linkedin, whatsapp, telegram, shortsHook, hashtags }
}

function buildHashtags(t: ScamType, place?: string): string[] {
  const tags = ['ScamAlert', 'CyberFraud', 'ScamCheck', pascal(t.name)]
  if (place) tags.push(pascal(place))
  if (/upi|otp|kyc|bank/.test(t.id)) tags.push('OnlineFraud')
  return [...new Set(tags)]
}

function pascal(s: string): string {
  return s.replace(/[^a-zA-Z0-9 ]/g, '').split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
}
function clip(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…'
}
