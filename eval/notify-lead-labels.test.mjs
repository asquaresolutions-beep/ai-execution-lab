// eval/notify-lead-labels.test.mjs
//
// The lead autoresponder printed the raw <select> value of the contact form
// ("thanks for your interest in our other"). notifyLead() now maps the known
// service values to readable names and falls back to a neutral sentence for
// "other", blank and unknown values.
//
// Scope guard: ONLY the visitor autoresponder sentence may change. The admin
// notification is pinned byte-for-byte to payloads captured from the unchanged
// pre-fix code (master 59adbd3), and the autoresponder's sender, recipient,
// subject and (absent) Reply-To are pinned too.
//
// Offline: the fetch stub never performs I/O and records any non-Resend host.
//
// Run: node --test --import ./eval/hooks.mjs eval/notify-lead-labels.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const imp = (p) => import(pathToFileURL(B + p).href)

// notify.ts captures these at module load. Obvious fake key — not a credential.
process.env.RESEND_API_KEY = 'test-key-not-a-real-secret'
const FROM = process.env.LEAD_EMAIL_FROM || 'A Square Solutions <noreply@asquaresolution.com>'
const ADMIN = process.env.ADMIN_EMAIL || 'contact@asquaresolution.com'

const RESEND_URL = 'https://api.resend.com/emails'
let captured = []
let violations = []
globalThis.fetch = async (url, init) => {
  const u = String(url)
  if (u !== RESEND_URL) { violations.push(u); return new Response('{}', { status: 500 }) }
  captured.push(JSON.parse(String(init?.body ?? '{}')))
  return new Response(JSON.stringify({ id: 'msg_test' }), { status: 200, headers: { 'content-type': 'application/json' } })
}

const { notifyLead, serviceLabel } = await imp('lib/email/notify.ts')

const VISITOR = 'visitor@example.test'
const MSG = 'Hello <there>'
const SRC = 'https://asquaresolution.com/contact/'

/** Runs notifyLead and returns the [admin, user] Resend payloads. */
async function lead(service, name = 'Jane Doe') {
  captured = []; violations = []
  const r = await notifyLead({ name, email: VISITOR, service, message: MSG, source: SRC })
  assert.equal(violations.length, 0, `non-Resend request(s): ${violations.join(', ')}`)
  assert.equal(captured.length, 2, 'exactly one admin notification + one autoresponder')
  assert.deepEqual(r, { admin: true, user: true, error: undefined })
  return captured
}
const sentence = (html) => html.match(/<p>Hi[^<]*<\/p>/)[0]

// Every option value of the asquaresolution.com/contact/ service <select>.
const LABELLED = {
  'ai-automation': 'AI automation',
  seo: 'SEO and content',
  'web-dev': 'web development',
  'digital-marketing': 'digital marketing',
  'ai-product': 'AI product development',
  consulting: 'strategy and consulting',
}
const NEUTRAL = ['other', '', undefined, 'unknown-service', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'Web Development', '<b>x</b>&']

// ── 1 · Readable names for every known service value ───────────────────────
for (const [slug, label] of Object.entries(LABELLED)) {
  test(`service "${slug}" → "thanks for your interest in our ${label} services"`, async () => {
    const [, user] = await lead(slug)
    assert.equal(sentence(user.html), `<p>Hi Jane Doe, thanks for your interest in our ${label} services. A Square Solutions will review your request and reply within 24 hours.</p>`)
    assert.ok(!user.html.includes(`our ${slug}.`), 'the raw value must not be printed')
    assert.ok(user.text.includes(`thanks for your interest in our ${label} services.`), 'text/plain part matches the HTML')
  })
}

// ── 2 · "other", blank and unknown values get the neutral sentence ─────────
for (const service of NEUTRAL) {
  test(`service ${JSON.stringify(service) ?? 'undefined'} → "thanks for getting in touch"`, async () => {
    const [, user] = await lead(service)
    assert.equal(sentence(user.html), '<p>Hi Jane Doe, thanks for getting in touch. A Square Solutions will review your request and reply within 24 hours.</p>')
    assert.ok(!/in our other|thanks for your interest/.test(user.html))
    assert.equal(serviceLabel(service), null)
  })
}

// A missing name reaches notifyLead as '' (app/api/lead/route.ts: (b.name || '').slice(...)).
test('the greeting still works without a name', async () => {
  const [, user] = await lead('seo', '')
  assert.equal(sentence(user.html), '<p>Hi, thanks for your interest in our SEO and content services. A Square Solutions will review your request and reply within 24 hours.</p>')
})

// ── 3 · Autoresponder envelope is unchanged ────────────────────────────────
test('autoresponder keeps sender, recipient, subject and has NO Reply-To', async () => {
  for (const service of ['web-dev', 'other']) {
    const [, user] = await lead(service)
    assert.deepEqual(Object.keys(user), ['from', 'to', 'subject', 'html', 'text'])
    assert.equal(user.from, FROM)
    assert.deepEqual(user.to, [VISITOR])
    assert.equal(user.subject, 'Thanks — we\'ll be in touch within 24 hours')
  }
})

test('only the greeting sentence differs from the pre-fix autoresponder', async () => {
  const [, user] = await lead('web-dev')
  // Pre-fix body (master 59adbd3) with the old sentence swapped for the new one.
  const before = `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:auto;color:#18181b">\n     <h2 style="color:#6366f1;margin:0 0 12px">Thanks for reaching out</h2>\n      <p>Hi Jane Doe, thanks for your interest in our web-dev. A Square Solutions will review your request and reply within 24 hours.</p>\n      <p>In the meantime, explore <a href="https://asquaresolution.com/services/">our services</a> or our <a href="https://asquaresolution.com/case-studies/">case studies</a>.</p>\n     <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0"/>\n     <p style="font-size:12px;color:#71717a">A Square Solutions · <a href="https://asquaresolution.com">asquaresolution.com</a></p>\n   </div>`
  assert.equal(user.html, before.replace('thanks for your interest in our web-dev.', 'thanks for your interest in our web development services.'))
})

// ── 4 · THE ADMIN NOTIFICATION IS BYTE-IDENTICAL TO THE PRE-FIX OUTPUT ─────
// Golden payloads captured from master 59adbd3 (before this change).
const adminGolden = (nameLine, serviceLine, subject) => ({
  from: FROM,
  to: [ADMIN],
  subject,
  html: `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:auto;color:#18181b">\n     <h2 style="color:#6366f1;margin:0 0 12px">New service lead</h2>\n      <p><b>Name:</b> ${nameLine}</p>\n      <p><b>Email:</b> visitor@example.test</p>\n      <p><b>Service interest:</b> ${serviceLine}</p>\n      <p><b>Message:</b></p><p style="white-space:pre-wrap">Hello &lt;there&gt;</p>\n      <p><b>Source page:</b> https://asquaresolution.com/contact/</p>\n     <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0"/>\n     <p style="font-size:12px;color:#71717a">A Square Solutions · <a href="https://asquaresolution.com">asquaresolution.com</a></p>\n   </div>`,
  text: `New service lead\n\n Name: ${nameLine}\n\n Email: visitor@example.test\n\n Service interest: ${serviceLine}\n\n Message:\nHello <there>\n\n Source page: https://asquaresolution.com/contact/\n\n A Square Solutions · asquaresolution.com (https://asquaresolution.com)`,
  reply_to: VISITOR,
})

test('admin notification is byte-identical to the pre-fix payload ("other", with name)', async () => {
  const [admin] = await lead('other', 'Jane Doe')
  assert.equal(JSON.stringify(admin), JSON.stringify(adminGolden('Jane Doe', 'other', 'New lead — other (Jane Doe)')))
})

test('admin notification is byte-identical to the pre-fix payload ("web-dev", no name)', async () => {
  const [admin] = await lead('web-dev', '')
  assert.equal(JSON.stringify(admin), JSON.stringify(adminGolden('—', 'web-dev', 'New lead — web-dev')))
})

test('admin notification keeps the RAW service value and visitor Reply-To for every input', async () => {
  for (const service of [...Object.keys(LABELLED), ...NEUTRAL]) {
    const [admin] = await lead(service)
    assert.equal(admin.subject, `New lead${service ? ` — ${service}` : ''} (Jane Doe)`)
    assert.equal(admin.reply_to, VISITOR)
    assert.equal(admin.from, FROM)
    assert.deepEqual(admin.to, [ADMIN])
    for (const label of Object.values(LABELLED)) assert.ok(!admin.html.includes(label), `admin mail must not contain the label "${label}"`)
  }
})
