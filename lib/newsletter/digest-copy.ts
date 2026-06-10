// ─────────────────────────────────────────────────────────────────
// lib/newsletter/digest-copy.ts  (asq-scamcheck-digest-v1)
// Pure composer for the weekly "Top Scam Alerts" digest. Turns trending items
// (from the existing trending_snapshots materialized view) into a subject +
// title + HTML body. No project imports, no AI → deterministic + unit-testable.
// The HTML body is wrapped + given List-Unsubscribe treatment by sendListEmail.
// ─────────────────────────────────────────────────────────────────

export interface DigestItem { title?: string; category?: string; clusterId?: string; trendScore?: number }
export interface ComposedDigest { subject: string; title: string; bodyHtml: string; itemCount: number }

const esc = (s: string) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))
const SCAMCHECK = 'https://scamcheck.asquaresolution.com'

const prettyCategory = (c?: string) =>
  (c || 'scam').replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())

/**
 * Compose the weekly digest from the top trending scams. Returns null if there
 * is nothing to send (no items) — the caller then creates no draft.
 */
export function composeScamDigest(items: DigestItem[], now: number = Date.now(), maxItems = 6): ComposedDigest | null {
  const top = (items || []).filter((i) => i && i.title).slice(0, maxItems)
  if (top.length === 0) return null

  const week = new Date(now).toISOString().slice(0, 10)
  const subject = `Top ${top.length} scams trending this week — stay safe`
  const title = 'This week’s top scam alerts'

  const list = top
    .map((i) => {
      const cat = esc(prettyCategory(i.category))
      const t = esc(i.title!)
      return `<li style="margin:0 0 10px;line-height:1.5"><b>${t}</b> <span style="color:#71717a">· ${cat}</span></li>`
    })
    .join('\n')

  const bodyHtml = `
    <p>Here are the scams our detection systems saw trending this week. If a message, screenshot, or link looks like any of these — slow down and verify before you pay or share anything.</p>
    <ul style="padding-left:18px;margin:14px 0">
${list}
    </ul>
    <p style="margin:18px 0">
      <a href="${SCAMCHECK}/latest-scams" style="background:#0ea5e9;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">See all trending scams →</a>
    </p>
    <p style="color:#52525b">Got a suspicious message? Check it free in 30 seconds with <a href="${SCAMCHECK}">ScamCheck</a>.</p>
    <p style="font-size:11px;color:#a1a1aa">Week of ${week}</p>`

  return { subject, title, bodyHtml, itemCount: top.length }
}
