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
// A Square Solutions lead/contact emails are sent under the company brand (same
// verified sender address, A Square Solutions display name).
const ASQ_FROM = process.env.LEAD_EMAIL_FROM || 'A Square Solutions <noreply@asquaresolution.com>'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'contact@asquaresolution.com'

export function emailConfigured(): boolean { return !!RESEND_API_KEY }

const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))

async function send(opts: { to: string; subject: string; html: string; replyTo?: string; from?: string }): Promise<{ ok: boolean; skipped?: boolean; status?: number; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, skipped: true }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: opts.from || EMAIL_FROM, to: [opts.to], subject: opts.subject, html: opts.html, ...(opts.replyTo ? { reply_to: opts.replyTo } : {}) }),
    })
    if (r.ok) return { ok: true, status: r.status }
    let error = ''
    try { const d = await r.json(); error = (d.message || d.name || JSON.stringify(d)) } catch { error = await r.text().catch(() => '') }
    return { ok: false, status: r.status, error: String(error).slice(0, 300) }
  } catch (e) {
    return { ok: false, error: (e as Error).message?.slice(0, 300) }
  }
}

const wrap = (title: string, body: string) =>
  `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:auto;color:#18181b">
     <h2 style="color:#0ea5e9;margin:0 0 12px">${esc(title)}</h2>${body}
     <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0"/>
     <p style="font-size:12px;color:#71717a">ScamCheck · A Square Solutions · <a href="https://scamcheck.asquaresolution.com">scamcheck.asquaresolution.com</a></p>
   </div>`

// A Square Solutions-branded wrapper for company lead/contact emails.
const wrapAsq = (title: string, body: string) =>
  `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:auto;color:#18181b">
     <h2 style="color:#6366f1;margin:0 0 12px">${esc(title)}</h2>${body}
     <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0"/>
     <p style="font-size:12px;color:#71717a">A Square Solutions · <a href="https://asquaresolution.com">asquaresolution.com</a></p>
   </div>`

/** Admin notification + user autoresponder for a contact / scam-report submission. */
export async function notifyContact(d: { name?: string; email?: string; kind?: string; message: string }): Promise<{ admin: boolean; user: boolean; error?: string }> {
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
    return { admin: admin.ok, user, error: admin.error || res.error }
  }
  return { admin: admin.ok, user, error: admin.error }
}

/** Service lead form: admin notification (with service + message + source) + user autoresponder. */
export async function notifyLead(d: { name?: string; email: string; service?: string; message?: string; source?: string }): Promise<{ admin: boolean; user: boolean; error?: string }> {
  const admin = await send({
    to: ADMIN_EMAIL,
    from: ASQ_FROM,
    subject: `New lead${d.service ? ` — ${d.service}` : ''}${d.name ? ` (${d.name})` : ''}`,
    replyTo: d.email,
    html: wrapAsq('New service lead', `
      <p><b>Name:</b> ${esc(d.name || '—')}</p>
      <p><b>Email:</b> ${esc(d.email)}</p>
      <p><b>Service interest:</b> ${esc(d.service || '—')}</p>
      <p><b>Message:</b></p><p style="white-space:pre-wrap">${esc(d.message || '—')}</p>
      <p><b>Source page:</b> ${esc(d.source || '—')}</p>`),
  })
  const user = await send({
    to: d.email,
    from: ASQ_FROM,
    subject: 'Thanks — we\'ll be in touch within 24 hours',
    html: wrapAsq('Thanks for reaching out', `
      <p>Hi${d.name ? ' ' + esc(d.name) : ''}, thanks for your interest${d.service ? ` in our ${esc(d.service)}` : ''}. A Square Solutions will review your request and reply within 24 hours.</p>
      <p>In the meantime, explore <a href="https://asquaresolution.com/services/">our services</a> or our <a href="https://asquaresolution.com/case-studies/">case studies</a>.</p>`),
  })
  return { admin: admin.ok, user: user.ok, error: admin.error || user.error }
}

/** A Square Solutions newsletter (blog): admin notification + subscriber welcome. Tracks source page. */
export async function notifyNewsletter(d: { name?: string; email: string; source?: string }): Promise<{ admin: boolean; user: boolean; error?: string }> {
  const admin = await send({
    to: ADMIN_EMAIL,
    subject: `New newsletter signup${d.name ? ` — ${d.name}` : ''}`,
    replyTo: d.email,
    html: wrap('New newsletter signup', `<p><b>Name:</b> ${esc(d.name || '—')}</p><p><b>Email:</b> ${esc(d.email)}</p><p><b>Source page:</b> ${esc(d.source || '—')}</p>`),
  })
  const user = await send({
    to: d.email,
    subject: 'Welcome to the A Square Solutions newsletter',
    html: wrap('You\'re subscribed', `
      <p>Hi${d.name ? ' ' + esc(d.name) : ''}, thanks for subscribing. You'll get practical updates on AI, web, and SEO from A Square Solutions.</p>
      <p>Explore our work at <a href="https://asquaresolution.com">asquaresolution.com</a>, or check a suspicious message free with <a href="https://scamcheck.asquaresolution.com">ScamCheck</a>.</p>`),
  })
  return { admin: admin.ok, user: user.ok, error: admin.error || user.error }
}

/** AI Execution Lab Weekly newsletter: admin notification + subscriber welcome. */
export async function notifyLabSignup(d: { name?: string; email: string }): Promise<{ admin: boolean; user: boolean; error?: string }> {
  const admin = await send({
    to: ADMIN_EMAIL,
    subject: `New AI Execution Lab Weekly signup${d.name ? ` — ${d.name}` : ''}`,
    replyTo: d.email,
    html: wrap('New newsletter signup', `<p><b>Name:</b> ${esc(d.name || '—')}</p><p><b>Email:</b> ${esc(d.email)}</p><p>List: AI Execution Lab Weekly</p>`),
  })
  const user = await send({
    to: d.email,
    subject: 'Welcome to AI Execution Lab Weekly',
    html: wrap('You\'re subscribed to AI Execution Lab Weekly', `
      <p>Hi${d.name ? ' ' + esc(d.name) : ''}, thanks for subscribing. Each week you'll get the latest production AI engineering notes, systems, and failure post-mortems from the AI Execution Lab.</p>
      <p>Read the latest at <a href="https://lab.asquaresolution.com">lab.asquaresolution.com</a>.</p>`),
  })
  return { admin: admin.ok, user: user.ok, error: admin.error || user.error }
}

/** Welcome / confirmation for a scam-alert subscription. */
export async function notifySubscribe(email: string): Promise<{ ok: boolean; error?: string }> {
  const res = await send({
    to: email,
    subject: 'You\'re subscribed to ScamCheck alerts',
    html: wrap('Subscription confirmed', `
      <p>Thanks for subscribing to ScamCheck scam alerts. You'll get notified about new and trending scam campaigns relevant to your region.</p>
      <p>Check a suspicious message any time at <a href="https://scamcheck.asquaresolution.com">scamcheck.asquaresolution.com</a>.</p>`),
  })
  return { ok: res.ok, error: res.error }
}
