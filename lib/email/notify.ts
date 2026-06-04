// ─────────────────────────────────────────────────────────────────
// lib/email/notify.ts
// Transactional email for lead/contact forms via the Resend HTTP API (no SDK →
// no new dependency; npm is blocked in this repo). Fully env-gated: with no
// RESEND_API_KEY the helpers no-op (forms still persist to the store), so this
// is safe to ship before the key/domain are configured.
//
// Required env to activate:
//   RESEND_API_KEY  — Resend API key
//   EMAIL_FROM      — verified sender, e.g. "ScamCheck <noreply@asquaresolution.com>"
//   ADMIN_EMAIL     — where admin notifications go (default contact@asquaresolution.com)
// DNS to activate (on asquaresolution.com, via Resend domain verification):
//   SPF (include resend), DKIM (resend._domainkey CNAMEs), optional DMARC already set.
// ─────────────────────────────────────────────────────────────────

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const EMAIL_FROM = process.env.EMAIL_FROM || 'ScamCheck <noreply@asquaresolution.com>'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'contact@asquaresolution.com'

export function emailConfigured(): boolean { return !!RESEND_API_KEY }

const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))

async function send(opts: { to: string; subject: string; html: string; replyTo?: string }): Promise<{ ok: boolean; skipped?: boolean; status?: number }> {
  if (!RESEND_API_KEY) return { ok: false, skipped: true }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: EMAIL_FROM, to: [opts.to], subject: opts.subject, html: opts.html, ...(opts.replyTo ? { reply_to: opts.replyTo } : {}) }),
    })
    return { ok: r.ok, status: r.status }
  } catch {
    return { ok: false }
  }
}

const wrap = (title: string, body: string) =>
  `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:auto;color:#18181b">
     <h2 style="color:#0ea5e9;margin:0 0 12px">${esc(title)}</h2>${body}
     <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0"/>
     <p style="font-size:12px;color:#71717a">ScamCheck · A Square Solutions · <a href="https://scamcheck.asquaresolution.com">scamcheck.asquaresolution.com</a></p>
   </div>`

/** Admin notification + user autoresponder for a contact / scam-report submission. */
export async function notifyContact(d: { name?: string; email?: string; kind?: string; message: string }): Promise<{ admin: boolean; user: boolean }> {
  const kind = d.kind || 'general'
  const admin = await send({
    to: ADMIN_EMAIL,
    subject: `New ScamCheck ${kind}${d.name ? ` from ${d.name}` : ''}`,
    replyTo: d.email || undefined,
    html: wrap('New lead / message', `
      <p><b>Type:</b> ${esc(kind)}</p>
      <p><b>Name:</b> ${esc(d.name || '—')}</p>
      <p><b>Email:</b> ${esc(d.email || '—')}</p>
      <p><b>Message:</b></p><p style="white-space:pre-wrap">${esc(d.message)}</p>`),
  })
  let user = false
  if (d.email) {
    const res = await send({
      to: d.email,
      subject: 'We received your message — ScamCheck',
      html: wrap('Thanks — we got your message', `
        <p>Hi${d.name ? ' ' + esc(d.name) : ''}, thanks for contacting ScamCheck. Our team will review your message and reply within 24 hours.</p>
        <p>If you reported a scam and money or details may be involved, contact your bank immediately and your national fraud authority — see your country's options at
        <a href="https://scamcheck.asquaresolution.com/contact">our contact page</a>.</p>
        <p style="white-space:pre-wrap;color:#52525b;border-left:3px solid #e4e4e7;padding-left:10px">${esc(d.message)}</p>`),
    })
    user = res.ok
  }
  return { admin: admin.ok, user }
}

/** Welcome / confirmation for a scam-alert subscription. */
export async function notifySubscribe(email: string): Promise<boolean> {
  const res = await send({
    to: email,
    subject: 'You\'re subscribed to ScamCheck alerts',
    html: wrap('Subscription confirmed', `
      <p>Thanks for subscribing to ScamCheck scam alerts. You'll get notified about new and trending scam campaigns relevant to your region.</p>
      <p>Check a suspicious message any time at <a href="https://scamcheck.asquaresolution.com">scamcheck.asquaresolution.com</a>.</p>`),
  })
  return res.ok
}
