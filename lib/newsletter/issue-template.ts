// ─────────────────────────────────────────────────────────────────
// lib/newsletter/issue-template.ts  (asq-nl-issue-framework-v1)
// Pure, dependency-free composer for EDITORIAL newsletter issues (hand-written,
// fraud-awareness), as opposed to the auto-generated trending digest in
// digest-copy.ts. Enforces a fixed 5-section framework so every issue is
// consistent, mobile-first, and on-brand for the ScamCheck audience:
//
//   1. 🚨 Scam of the Week
//   2. ✅ Verification Tip
//   3. 📖 Worth Reading
//   4. 🛡️ ScamCheck Corner
//   5. 📲 Share This Alert
//
// Output { subject, title, bodyHtml } is wrapped (brand shell + List-Unsubscribe
// + postal footer + text/plain alt) by sendListEmail() in lib/email/notify.ts —
// so issues can be sent through the existing approved campaign pipeline
// (campaigns.ts) without any new send path. No project imports → unit-testable
// under `node --experimental-strip-types`. Nothing here sends anything.
//
// To send an issue:
//   1. Create a draft Campaign (brand:'scamcheck') whose subject/title/bodyHtml
//      come from composeNewsletterIssue(ISSUE_001).
//   2. Admin approves it (approveCampaign) → enqueue (enqueueCampaign).
//   3. The daily cron drains it via sendListEmail (gated by WEEKLY_DIGEST_ENABLED).
// ─────────────────────────────────────────────────────────────────

const SCAMCHECK = 'https://scamcheck.asquaresolution.com'

const esc = (s: string) =>
  String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))

// ── Mobile-first share helpers ─────────────────────────────────────
/** WhatsApp deep link that prefills a share message + url. Works on phone + web. */
export function whatsappShareUrl(text: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`
}

// ── The fixed 5-section framework ──────────────────────────────────
export interface NewsletterIssueInput {
  /** Issue number (for the kicker line + analytics). */
  number: number
  /** Inbox subject line. */
  subject: string
  /** Preheader / preview text (keep < ~90 chars). */
  preview: string
  /** H2 used inside the brand wrapper. */
  title: string
  /** Short, human intro paragraph(s) as HTML. */
  intro: string
  /** 1. Scam of the Week — name + body (what it is + how it works). */
  scamOfWeek: { name: string; bodyHtml: string }
  /** 2. Verification Tip — the 10-second "how to verify before acting". */
  verificationTip: { bodyHtml: string }
  /** 3. Worth Reading — one internal link recommendation. */
  worthReading: { label: string; href: string; blurb: string }
  /** 4. ScamCheck Corner — one simple, non-salesy ScamCheck CTA. */
  scamCheckCorner: { bodyHtml: string; ctaLabel: string; ctaHref: string }
  /** 5. Share This Alert — WhatsApp + forward-to-a-friend. */
  shareThisAlert: { whatsappText: string; shareUrl: string; forwardHtml: string }
}

export interface ComposedIssue { subject: string; title: string; bodyHtml: string; preview: string }

// Mobile-first inline-styled primitives (email clients ignore <style>/classes).
const P = 'margin:0 0 14px;line-height:1.6;font-size:16px;color:#27272a'
const H = 'margin:26px 0 10px;font-size:18px;line-height:1.3;color:#18181b;font-weight:700'
const LI = 'margin:0 0 8px;line-height:1.55;font-size:16px;color:#27272a'
const BTN = 'display:inline-block;background:#0ea5e9;color:#fff;font-weight:700;font-size:16px;text-decoration:none;padding:13px 22px;border-radius:10px'
const BTN_WA = 'display:inline-block;background:#25D366;color:#fff;font-weight:700;font-size:16px;text-decoration:none;padding:13px 22px;border-radius:10px'

function section(emoji: string, heading: string, innerHtml: string): string {
  return `<h2 style="${H}">${emoji} ${esc(heading)}</h2>${innerHtml}`
}

/**
 * Render an editorial issue into { subject, title, bodyHtml } for sendListEmail().
 * Deterministic + pure. Mobile-first single-column layout.
 */
export function composeNewsletterIssue(issue: NewsletterIssueInput): ComposedIssue {
  const wa = whatsappShareUrl(issue.shareThisAlert.whatsappText, issue.shareThisAlert.shareUrl)

  const bodyHtml = [
    // Hidden preheader — controls the inbox preview text (not visible in the body).
    `<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;overflow:hidden;mso-hide:all">${esc(issue.preview)}</span>`,
    `<p style="margin:0 0 4px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#0ea5e9;font-weight:700">ScamCheck Weekly · Issue #${issue.number}</p>`,
    issue.intro,
    section('🚨', `Scam of the Week: ${issue.scamOfWeek.name}`, issue.scamOfWeek.bodyHtml),
    section('✅', 'Verification Tip', issue.verificationTip.bodyHtml),
    section('📖', 'Worth Reading',
      `<p style="${P}">${issue.worthReading.blurb}</p>` +
      `<p style="${P}"><a href="${issue.worthReading.href}" style="color:#0ea5e9;font-weight:700;text-decoration:underline">${esc(issue.worthReading.label)} →</a></p>`),
    section('🛡️', 'ScamCheck Corner',
      issue.scamCheckCorner.bodyHtml +
      `<p style="margin:14px 0 0"><a href="${issue.scamCheckCorner.ctaHref}" style="${BTN}">${esc(issue.scamCheckCorner.ctaLabel)}</a></p>`),
    section('📲', 'Share This Alert',
      issue.shareThisAlert.forwardHtml +
      `<p style="margin:14px 0 0"><a href="${wa}" style="${BTN_WA}">Share on WhatsApp</a></p>`),
  ].join('\n')

  return { subject: issue.subject, title: issue.title, bodyHtml, preview: issue.preview }
}

// ── ISSUE #1 — Fake UPI Payment Screenshot Scam ────────────────────
// 3-minute read. Theme matches the article that drove 77% of subscribers.
export const ISSUE_001: NewsletterIssueInput = {
  number: 1,
  subject: 'They "sent" ₹9,000 by mistake. It never arrived. 🚩',
  preview: 'The refund trap hitting UPI sellers this week — and the 10-second check that stops it.',
  title: 'A screenshot is not proof of payment',
  intro:
    `<p style="${P}">Hi — welcome to the first issue. One real scam, how to spot it, and one habit that protects you. 2-minute read.</p>`,
  scamOfWeek: {
    name: 'The "Wrong Payment" Refund Trap',
    bodyHtml:
      `<p style="${P}">A "buyer" or stranger messages you: <i>"Sorry, I accidentally sent you ₹9,000 instead of ₹900 — please refund the extra ₹8,100."</i> They attach a screenshot showing the payment went through. It looks real. There's an apology and a hurry.</p>` +
      `<p style="${P}">The problem: <b>no money ever arrived.</b> The screenshot was edited. If you "refund the difference," you send ₹8,100 of your own money to a scammer — for a payment that never happened.</p>` +
      `<p style="${P};margin-bottom:6px"><b>How it works:</b></p>` +
      `<ol style="padding-left:20px;margin:0 0 14px">` +
      `<li style="${LI}">A doctored screenshot showing a payment <i>to you</i> — right name, right amount, real-looking reference.</li>` +
      `<li style="${LI}">Manufactured urgency: "please hurry," "I'll get in trouble," "refund before the bank reverses it."</li>` +
      `<li style="${LI}">The ask: <i>you</i> send real money back to "correct" a payment you never received.</li>` +
      `<li style="${LI}">Once you refund, they vanish. There was nothing to reverse.</li>` +
      `</ol>`,
  },
  verificationTip: {
    bodyHtml:
      `<p style="${P}">Never act on a screenshot. Act on your own records — it takes 10 seconds:</p>` +
      `<ul style="padding-left:20px;margin:0 0 14px">` +
      `<li style="${LI}"><b>Open your own bank / UPI app yourself.</b> If the money truly arrived, it's in <i>your</i> transaction history. If it isn't there, it didn't happen.</li>` +
      `<li style="${LI}"><b>Check the actual balance</b> — not a screenshot, not an SMS. Both can be faked.</li>` +
      `<li style="${LI}"><b>Refuse to be rushed.</b> Real reversals are handled by the bank, never by you sending money to a stranger.</li>` +
      `</ul>` +
      `<p style="${P}"><b>The rule: if it's not in your own account, it doesn't exist.</b></p>`,
  },
  worthReading: {
    label: 'How to Spot a Fake UPI Payment Screenshot',
    href: 'https://asquaresolution.com/blog/fake-upi-payment-screenshot-scam/',
    blurb: 'The full breakdown — exactly how these fake screenshots are made and the tells that give them away. Worth keeping handy (and sending to anyone who sells online).',
  },
  scamCheckCorner: {
    bodyHtml:
      `<p style="${P}">Got a screenshot you're unsure about? Don't guess — upload it and get an instant risk read in about 30 seconds. Free, no signup.</p>`,
    ctaLabel: 'Check a screenshot free on ScamCheck →',
    ctaHref: `${SCAMCHECK}/scamcheck/screenshot`,
  },
  shareThisAlert: {
    whatsappText: 'Useful scam alert — how to spot fake UPI payment screenshots before you lose money:',
    shareUrl: `${SCAMCHECK}/?utm_source=newsletter&utm_medium=share&utm_campaign=issue01`,
    forwardHtml:
      `<p style="${P}">Know someone who sells online or uses UPI daily? This is the one to forward — one share can stop one fraud.</p>`,
  },
}
