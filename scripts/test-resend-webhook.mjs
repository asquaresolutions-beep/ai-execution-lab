#!/usr/bin/env node
// Tests for Resend webhook analytics (asq-resend-analytics-v1). Unit-tests the
// pure signature/parse/summary helpers (real functions) + static-asserts route wiring.
// Run: node --experimental-strip-types scripts/test-resend-webhook.mjs
import fs from 'node:fs'
import { createHmac } from 'node:crypto'
import { verifyResendSignature, parseResendEvent, summarizeEmailEvents } from '../lib/email/webhook.ts'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')

// ── signature verification (build a valid Svix sig the way Resend does) ──
const secretB64 = Buffer.from('supersecretkey-1234567890').toString('base64')
const secret = 'whsec_' + secretB64
const id = 'msg_123', ts = '1700000000', body = '{"type":"email.delivered"}'
const validSig = createHmac('sha256', Buffer.from(secretB64, 'base64')).update(`${id}.${ts}.${body}`).digest('base64')
ok('valid signature accepted', verifyResendSignature({ secret, svixId: id, svixTimestamp: ts, rawBody: body, svixSignature: `v1,${validSig}` }))
ok('valid sig among multiple entries', verifyResendSignature({ secret, svixId: id, svixTimestamp: ts, rawBody: body, svixSignature: `v1,bogus v1,${validSig}` }))
ok('tampered body rejected', !verifyResendSignature({ secret, svixId: id, svixTimestamp: ts, rawBody: body + 'x', svixSignature: `v1,${validSig}` }))
ok('wrong secret rejected', !verifyResendSignature({ secret: 'whsec_' + Buffer.from('other').toString('base64'), svixId: id, svixTimestamp: ts, rawBody: body, svixSignature: `v1,${validSig}` }))
ok('missing headers rejected', !verifyResendSignature({ secret, svixId: '', svixTimestamp: ts, rawBody: body, svixSignature: `v1,${validSig}` }))

// ── event parsing ──
const ev = parseResendEvent({ type: 'email.opened', created_at: '2026-06-10T00:00:00Z', data: { to: ['User@Example.com'], email_id: 'e1', tags: { campaignId: 'c9' } } })
ok('parses opened', ev && ev.type === 'opened')
ok('lowercases email', ev.email === 'user@example.com')
ok('captures messageId + campaignId', ev.messageId === 'e1' && ev.campaignId === 'c9')
ok('maps all supported types', ['email.sent','email.delivered','email.bounced','email.clicked','email.complained','email.delivery_delayed'].every((t) => parseResendEvent({ type: t, data: { to: 'a@b.com' } })))
ok('unsupported type → null', parseResendEvent({ type: 'email.unknown', data: { to: 'a@b.com' } }) === null)
ok('missing recipient → null', parseResendEvent({ type: 'email.opened', data: {} }) === null)
ok('garbage → null', parseResendEvent(null) === null && parseResendEvent({}) === null)

// ── summary / rates ──
const s = summarizeEmailEvents([
  { type: 'sent' }, { type: 'sent' }, { type: 'sent' }, { type: 'sent' },
  { type: 'delivered' }, { type: 'delivered' }, { type: 'delivered' }, { type: 'delivered' },
  { type: 'opened' }, { type: 'opened' }, { type: 'clicked' }, { type: 'bounced' },
])
ok('counts total', s.total === 12)
ok('byType correct', s.byType.delivered === 4 && s.byType.opened === 2)
ok('delivery rate = delivered/sent', s.deliveryRate === 100) // 4 delivered / 4 sent
ok('open rate = opened/delivered', s.openRate === 50)        // 2/4
ok('click rate = clicked/delivered', s.clickRate === 25)     // 1/4
ok('empty input safe', summarizeEmailEvents([]).total === 0 && summarizeEmailEvents([]).openRate === 0)

// ── route + events wiring (static) ──
const r = read('app/api/webhooks/resend/route.ts')
ok('route verifies signature before recording', /verifyResendSignature/.test(r) && /invalid_signature/.test(r) && /status: 401/.test(r))
ok('route 503 when secret unset', /webhook_not_configured/.test(r) && /503/.test(r))
ok('route records via recordEmailEvent', /recordEmailEvent\(evt\)/.test(r))
const e = read('lib/email/events.ts')
ok('events stored in email_events, append-only (no delete)', /EMAIL_EVENTS = 'email_events'/.test(e) && !/\.delete\(/.test(e))
const u = read('app/api/newsletter/unsubscribe/route.ts')
ok('unsubscribe records an unsubscribed event', /recordEmailEvent\(\{ type: 'unsubscribed'/.test(u))

console.log(`\nresend-webhook: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
