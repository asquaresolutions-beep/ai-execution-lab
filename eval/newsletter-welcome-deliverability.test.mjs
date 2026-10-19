// eval/newsletter-welcome-deliverability.test.mjs   (asq-welcome-deliverability-v1)
//
// Offline tests for the welcome drip's check made immediately before each send:
// the subscriber's CURRENT record (unsubscribe / deleted since the list was read) and
// the provider's events for the address (complaint, provider suppression, permanent
// bounce, repeated bounces since the last delivery). Also the webhook fields the check
// relies on, and idempotency (one delivery per subscriber and step).
//
// The store is a MemoryStore wrapped in a proxy that records every data call and can be
// told to fail a call or to answer a read differently, so "nothing is written" and
// "a failed check sends nothing" are asserted from OBSERVED behaviour. The provider
// request is stubbed: no I/O; any request other than a POST to the provider's send
// endpoint is recorded as a violation. Nothing leaves the machine.
//
// Run: node --test --import ./eval/hooks.mjs eval/newsletter-welcome-deliverability.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

process.env.RESEND_API_KEY = 'test-key-not-a-real-secret'
delete process.env.PUBLIC_APP_URL
delete process.env.MAIL_PHYSICAL_ADDRESS

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const imp = (p) => import(pathToFileURL(B + p).href)

const RESEND_URL = 'https://api.resend.com/emails'
let captured = []     // { to, key } per provider request, in order
let violations = []
globalThis.fetch = async (url, init) => {
  const u = String(url)
  if (u !== RESEND_URL || String(init?.method || 'GET').toUpperCase() !== 'POST') { violations.push(`${init?.method || 'GET'} ${u}`); return new Response('{}', { status: 500 }) }
  const body = JSON.parse(String(init?.body ?? '{}'))
  const h = init?.headers || {}
  captured.push({ to: Array.isArray(body.to) ? body.to[0] : body.to, key: h['Idempotency-Key'] ?? null })
  return new Response(JSON.stringify({ id: 'msg_test' }), { status: 200, headers: { 'content-type': 'application/json' } })
}

const { setStore } = await imp('lib/store/adapter.ts')
const { MemoryStore } = await imp('lib/store/memory-store.ts')
const { parseResendEvent } = await imp('lib/email/webhook.ts')
const { deliverabilityBlock, REPEATED_BOUNCE_THRESHOLD } = await imp('lib/newsletter/deliverability.ts')
const { processWelcomeSequence } = await imp('lib/newsletter/welcome-sequence.ts')

const DAY = 86_400_000
const NOW = Date.parse('2026-10-18T07:00:00Z')
const ago = (d) => NOW - d * DAY
const LIST = 'newsletter', EVENTS = 'email_events'
const WRITES = new Set(['set', 'create', 'update', 'delete', 'increment'])

/** MemoryStore behind a proxy: records every data call; ctl.fault(call) may throw; ctl.get(call) may answer a get. */
function harness() {
  const real = new MemoryStore()
  const calls = []
  const ctl = { fault: null, get: null }
  const store = new Proxy(real, {
    get(t, prop) {
      const v = t[prop]
      if (typeof v !== 'function' || !['get', 'set', 'create', 'update', 'query', 'delete', 'increment'].includes(prop)) return typeof v === 'function' ? v.bind(t) : v
      return async (...args) => {
        const call = { op: prop, collection: args[0], args }
        calls.push(call)
        if (ctl.fault) ctl.fault(call)
        if (prop === 'get' && ctl.get) { const r = ctl.get(call); if (r !== undefined) return r }
        return v.apply(t, args)
      }
    },
  })
  setStore(store)
  return { real, store, calls, ctl }
}
const reset = () => { captured = []; violations = [] }
const enable = () => { process.env.WELCOME_SEQUENCE_ENABLED = 'true'; process.env.WELCOME_SEQUENCE_SINCE = new Date(ago(60)).toISOString() }
async function sub(real, id, email, { daysOld = 3, welcomeStep, unsubscribed } = {}) {
  await real.set(LIST, id, { email, createdAt: new Date(ago(daysOld)).toISOString(), ...(welcomeStep !== undefined ? { welcomeStep } : {}), ...(unsubscribed ? { unsubscribed: true } : {}) })
}
// Events are stored the way the webhook stores them: address lower-cased, ts in ms.
async function ev(real, email, type, daysAgo, extra = {}) { await real.set(EVENTS, null, { type, email: email.toLowerCase(), ts: ago(daysAgo), ...extra }) }
const subscriberWrites = (calls) => calls.filter((c) => WRITES.has(c.op) && c.collection === LIST)

// ── 1 · The rule itself (pure) ──────────────────────────────────────────────
test('rule: no history, or one transient bounce, never stops anyone', () => {
  assert.equal(deliverabilityBlock([]), null)
  assert.equal(deliverabilityBlock([{ type: 'bounced', ts: 1 }]), null)
  assert.equal(deliverabilityBlock([{ type: 'bounced', ts: 1, bounceType: 'Temporary' }]), null)
  assert.equal(REPEATED_BOUNCE_THRESHOLD, 2)
})
test('rule: repeated bounces since the last delivery stop list mail (typed or legacy untyped)', () => {
  assert.equal(deliverabilityBlock([{ type: 'bounced', ts: 1 }, { type: 'bounced', ts: 2 }]), 'repeated_bounce')
  assert.equal(deliverabilityBlock([{ type: 'delivered', ts: 1 }, { type: 'bounced', ts: 2, bounceType: 'Temporary' }, { type: 'bounced', ts: 3 }]), 'repeated_bounce')
})
test('rule: a later delivery clears earlier bounces', () => {
  assert.equal(deliverabilityBlock([{ type: 'bounced', ts: 1 }, { type: 'bounced', ts: 2 }, { type: 'delivered', ts: 3 }]), null)
  assert.equal(deliverabilityBlock([{ type: 'bounced', ts: 1 }, { type: 'delivered', ts: 2 }, { type: 'bounced', ts: 3 }]), null)
  assert.equal(deliverabilityBlock([{ type: 'bounced', ts: 1, bounceType: 'Permanent' }, { type: 'delivered', ts: 2 }]), null)
})
test('rule: one permanent bounce stops list mail', () => {
  assert.equal(deliverabilityBlock([{ type: 'bounced', ts: 5, bounceType: 'Permanent', bounceSubType: 'General' }]), 'permanent_bounce')
  assert.equal(deliverabilityBlock([{ type: 'bounced', ts: 5, bounceType: 'permanent' }]), 'permanent_bounce')
})
test('rule: a provider suppression stops list mail (suppressed event, or bounce sub-type Suppressed)', () => {
  assert.equal(deliverabilityBlock([{ type: 'suppressed', ts: 5 }]), 'provider_suppressed')
  assert.equal(deliverabilityBlock([{ type: 'bounced', ts: 5, bounceType: 'Permanent', bounceSubType: 'Suppressed' }]), 'provider_suppressed')
})
test('rule: a complaint stops list mail for good, even after a delivery', () => {
  assert.equal(deliverabilityBlock([{ type: 'complained', ts: 1 }, { type: 'delivered', ts: 2 }]), 'complained')
})
test('rule: delays, sends, opens and clicks change nothing; times as ISO text or missing are handled', () => {
  assert.equal(deliverabilityBlock([1, 2, 3, 4, 5].map((ts) => ({ type: 'delivery_delayed', ts })).concat([{ type: 'sent', ts: 6 }, { type: 'opened', ts: 7 }, { type: 'clicked', ts: 8 }])), null)
  assert.equal(deliverabilityBlock([{ type: 'bounced', ts: '2026-10-10T00:00:00Z' }, { type: 'bounced', ts: '2026-10-12T00:00:00Z' }]), 'repeated_bounce')
  // a delivery with no usable time counts as the oldest event, so it cannot clear later bounces
  assert.equal(deliverabilityBlock([{ type: 'delivered' }, { type: 'bounced', ts: 2 }, { type: 'bounced', ts: 3 }]), 'repeated_bounce')
})

// ── 2 · The webhook keeps what the rule needs ───────────────────────────────
test('webhook: a bounce keeps the provider\'s bounce type and sub-type', () => {
  const e = parseResendEvent({ type: 'email.bounced', created_at: '2026-10-17T21:28:35Z', data: { to: ['Reader@Example.test'], email_id: 'm1', bounce: { type: 'Permanent', subType: 'Suppressed', message: 'x' } } })
  assert.equal(e.type, 'bounced'); assert.equal(e.email, 'reader@example.test')
  assert.equal(e.bounceType, 'Permanent'); assert.equal(e.bounceSubType, 'Suppressed')
})
test('webhook: a bounce without details, and every other event, keep exactly their old shape', () => {
  const plain = parseResendEvent({ type: 'email.bounced', data: { to: 'a@b.test' } })
  for (const k of ['bounceType', 'bounceSubType', 'suppressedType']) assert.ok(!(k in plain), `${k} must be absent`)
  const delivered = parseResendEvent({ type: 'email.delivered', data: { to: 'a@b.test', bounce: { type: 'Permanent' }, suppressed: { type: 'X' } } })
  for (const k of ['bounceType', 'bounceSubType', 'suppressedType']) assert.ok(!(k in delivered), `${k} must be absent on a delivery`)
})
test('webhook: the provider\'s "suppressed" event is stored as type suppressed', () => {
  const e = parseResendEvent({ type: 'email.suppressed', data: { to: ['a@b.test'], suppressed: { type: 'OnAccountSuppressionList', message: 'y' } } })
  assert.equal(e.type, 'suppressed'); assert.equal(e.suppressedType, 'OnAccountSuppressionList')
})
test('webhook: provider labels are short strings or absent', () => {
  const e = parseResendEvent({ type: 'email.bounced', data: { to: 'a@b.test', bounce: { type: 'P'.repeat(500), subType: 42 } } })
  assert.equal(e.bounceType.length, 64); assert.ok(!('bounceSubType' in e))
})

// ── 3 · The welcome drip with the check ─────────────────────────────────────
test('valid subscriber: sent once, step advanced, idempotency key per subscriber and step', async () => {
  reset(); enable(); const { real } = harness()
  await sub(real, 'nl_ok', 'ok@example.test')
  const r = await processWelcomeSequence(NOW)
  assert.equal(r.sent, 1); assert.equal(r.blocked, 0); assert.equal(violations.length, 0)
  assert.deepEqual(captured, [{ to: 'ok@example.test', key: 'welcome-nl_ok-step1' }])
  assert.equal((await real.get(LIST, 'nl_ok')).data.welcomeStep, 1)
})
test('one earlier transient bounce does not stop the next welcome step', async () => {
  reset(); enable(); const { real } = harness()
  await sub(real, 'nl_one', 'one@example.test'); await ev(real, 'one@example.test', 'bounced', 1, { bounceType: 'Temporary' })
  const r = await processWelcomeSequence(NOW)
  assert.equal(r.sent, 1); assert.equal(r.blocked, 0)
})
for (const [name, events, reason] of [
  ['repeated bounces (stored before this version, no type)', [['bounced', 2], ['bounced', 1]], 'repeated_bounce'],
  ['a permanent bounce', [['bounced', 1, { bounceType: 'Permanent', bounceSubType: 'General' }]], 'permanent_bounce'],
  ['a provider-suppressed address', [['suppressed', 1, { suppressedType: 'OnAccountSuppressionList' }]], 'provider_suppressed'],
  ['a spam complaint', [['complained', 1]], 'complained'],
]) {
  test(`${name}: not sent, step not advanced, nothing written`, async () => {
    reset(); enable(); const { real, calls } = harness()
    await sub(real, 'nl_x', 'x@example.test')
    for (const [type, d, extra] of events) await ev(real, 'x@example.test', type, d, extra)
    calls.length = 0
    const r = await processWelcomeSequence(NOW)
    assert.equal(r.sent, 0); assert.equal(r.blocked, 1); assert.deepEqual(r.blockedBy, { [reason]: 1 })
    assert.equal(captured.length, 0); assert.equal(violations.length, 0)
    assert.equal((await real.get(LIST, 'nl_x')).data.welcomeStep, undefined)
    assert.deepEqual(calls.filter((c) => WRITES.has(c.op)), [], 'a stopped send writes nothing anywhere')
  })
}
test('genuine unsubscribe: never due, never sent, events not even read', async () => {
  reset(); enable(); const { real, calls } = harness()
  await sub(real, 'nl_u', 'u@example.test', { unsubscribed: true })
  const r = await processWelcomeSequence(NOW)
  assert.equal(r.due, 0); assert.equal(r.sent, 0); assert.equal(captured.length, 0)
  assert.equal(calls.filter((c) => c.collection === EVENTS).length, 0)
})
test('unsubscribed after the list was read: the re-read record stops the send', async () => {
  reset(); enable(); const { real, ctl } = harness()
  await sub(real, 'nl_late', 'late@example.test')
  ctl.get = (c) => (c.collection === LIST && c.args[1] === 'nl_late' ? { id: 'nl_late', data: { email: 'late@example.test', unsubscribed: true } } : undefined)
  const r = await processWelcomeSequence(NOW)
  assert.equal(r.sent, 0); assert.deepEqual(r.blockedBy, { unsubscribed: 1 }); assert.equal(captured.length, 0)
})
test('record deleted after the list was read: not sent', async () => {
  reset(); enable(); const { real, ctl } = harness()
  await sub(real, 'nl_gone', 'gone@example.test')
  ctl.get = (c) => (c.collection === LIST ? null : undefined)
  const r = await processWelcomeSequence(NOW)
  assert.equal(r.sent, 0); assert.deepEqual(r.blockedBy, { not_subscribed: 1 })
})
test('the check cannot be made (store error): fail closed — nothing sent, step not advanced, retried next run', async () => {
  reset(); enable(); const { real, ctl } = harness()
  await sub(real, 'nl_err', 'err@example.test')
  ctl.fault = (c) => { if (c.op === 'query' && c.collection === EVENTS) throw new Error('store down') }
  const r1 = await processWelcomeSequence(NOW)
  assert.equal(r1.sent, 0); assert.equal(r1.deferred, 1); assert.equal(captured.length, 0)
  assert.equal((await real.get(LIST, 'nl_err')).data.welcomeStep, undefined)
  ctl.fault = null
  const r2 = await processWelcomeSequence(NOW)
  assert.equal(r2.sent, 1, 'once the store answers again, the step goes out')
})
test('address case does not hide history: events are matched on the lower-cased address', async () => {
  reset(); enable(); const { real } = harness()
  await sub(real, 'nl_case', 'Mixed.Case@Example.test')
  await ev(real, 'mixed.case@example.test', 'bounced', 2); await ev(real, 'mixed.case@example.test', 'bounced', 1)
  const r = await processWelcomeSequence(NOW)
  assert.equal(r.sent, 0); assert.deepEqual(r.blockedBy, { repeated_bounce: 1 })
})
test('another address\'s bounces do not affect this subscriber', async () => {
  reset(); enable(); const { real } = harness()
  await sub(real, 'nl_clean', 'clean@example.test')
  await ev(real, 'other@example.test', 'bounced', 2); await ev(real, 'other@example.test', 'bounced', 1)
  assert.equal((await processWelcomeSequence(NOW)).sent, 1)
})
test('mixed run: only the deliverable subscriber is mailed; counts add up', async () => {
  reset(); enable(); const { real } = harness()
  await sub(real, 'nl_a', 'a@example.test')
  await sub(real, 'nl_b', 'b@example.test'); await ev(real, 'b@example.test', 'bounced', 2); await ev(real, 'b@example.test', 'bounced', 1)
  await sub(real, 'nl_c', 'c@example.test'); await ev(real, 'c@example.test', 'suppressed', 1)
  await sub(real, 'nl_d', 'd@example.test', { unsubscribed: true })
  const r = await processWelcomeSequence(NOW)
  assert.deepEqual({ due: r.due, sent: r.sent, blocked: r.blocked, blockedBy: r.blockedBy }, { due: 3, sent: 1, blocked: 2, blockedBy: { repeated_bounce: 1, provider_suppressed: 1 } })
  assert.deepEqual(captured.map((c) => c.to), ['a@example.test'])
})
test('idempotency: a second run the same day sends nothing; a stopped address stays stopped and unadvanced', async () => {
  reset(); enable(); const { real } = harness()
  await sub(real, 'nl_ok', 'ok@example.test')
  await sub(real, 'nl_bad', 'bad@example.test'); await ev(real, 'bad@example.test', 'bounced', 2); await ev(real, 'bad@example.test', 'bounced', 1)
  await processWelcomeSequence(NOW); await processWelcomeSequence(NOW)
  assert.deepEqual(captured.map((c) => c.to), ['ok@example.test'], 'exactly one delivery in two runs')
  assert.equal((await real.get(LIST, 'nl_bad')).data.welcomeStep, undefined)
})
test('idempotency: the key changes with the step, so step 2 is not mistaken for a repeat of step 1', async () => {
  reset(); enable(); const { real } = harness()
  await sub(real, 'nl_s', 's@example.test', { daysOld: 3 })
  await processWelcomeSequence(NOW)
  await processWelcomeSequence(NOW + 3 * DAY)   // now 6 days old: step 2 due
  assert.deepEqual(captured.map((c) => c.key), ['welcome-nl_s-step1', 'welcome-nl_s-step2'])
})
test('a delivery after the bounces lets the drip resume', async () => {
  reset(); enable(); const { real } = harness()
  await sub(real, 'nl_back', 'back@example.test')
  await ev(real, 'back@example.test', 'bounced', 2.5); await ev(real, 'back@example.test', 'bounced', 2); await ev(real, 'back@example.test', 'delivered', 1)
  assert.equal((await processWelcomeSequence(NOW)).sent, 1)
})
test('disabled drip: no event read, no send', async () => {
  reset(); delete process.env.WELCOME_SEQUENCE_ENABLED; const { real, calls } = harness()
  await sub(real, 'nl_ok', 'ok@example.test'); calls.length = 0
  const r = await processWelcomeSequence(NOW)
  assert.equal(r.enabled, false); assert.equal(captured.length, 0); assert.equal(calls.length, 0)
})
