// eval/email-attribution.test.mjs
//
// Offline tests for the PROPOSED attribution + cancellation work.
// MemoryStore only · network trip-wire armed · NO Resend API call · no production write.
//
// Run: node --test --import ./eval/hooks.mjs eval/email-attribution.test.mjs
//
// Covers:
//   1. campaignId → Resend tags        (lib/email/tags.ts — inert proposal)
//   2. event parsing                   (lib/email/webhook.ts — already shipped)
//   3. campaign-level aggregation      (summarizeEmailEvents — already shipped)
//   4. canceled campaign guards        (against the real campaigns.ts guards)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const B = 'C:/Users/Acer/Desktop/ai-execution-lab/'
const imp = (p) => import(pathToFileURL(B + p).href)

const realFetch = globalThis.fetch
globalThis.fetch = (...a) => { throw new Error('NETWORK ATTEMPTED: ' + String(a[0]).slice(0, 80)) }
process.on('exit', () => { globalThis.fetch = realFetch })

const { campaignTags, sanitizeTagValue } = await imp('lib/email/tags.ts')
const { parseResendEvent, summarizeEmailEvents } = await imp('lib/email/webhook.ts')
const { setStore } = await imp('lib/store/adapter.ts')
const { MemoryStore } = await imp('lib/store/memory-store.ts')
const { CAMPAIGNS, CAMPAIGN_SENDS, enqueueCampaign, approveCampaign, drainCampaign, composeCustomIssue } =
  await imp('lib/newsletter/campaigns.ts')

// ── 1 · campaignId → Resend tags ────────────────────────────────────────────
test('a real campaign id produces one campaignId tag', () => {
  const t = campaignTags('scamcheck-fake-screenshot-2026-08-26')
  assert.deepEqual(t, [{ name: 'campaignId', value: 'scamcheck-fake-screenshot-2026-08-26' }])
})

test('no campaign id → undefined, so non-campaign mail keeps its exact payload shape', () => {
  for (const v of [undefined, '', '   ', null, 123, {}]) {
    assert.equal(campaignTags(v), undefined, `expected undefined for ${JSON.stringify(v)}`)
  }
})

test('disallowed characters are coerced, never passed through to Resend', () => {
  // Resend rejects the whole send on an invalid tag — an unsanitised id would turn
  // "add attribution" into "newsletter stops sending".
  assert.equal(sanitizeTagValue('manual:custom/issue #1'), 'manual-custom-issue-1')
  assert.equal(sanitizeTagValue('a b  c'), 'a-b-c')
  assert.equal(sanitizeTagValue('--lead--'), 'lead')
  assert.equal(sanitizeTagValue('émoji-🎉-id'), 'moji-id')
})

test('tag values are capped at 256 characters', () => {
  const v = sanitizeTagValue('x'.repeat(400))
  assert.equal(v.length, 256)
})

test('an id that sanitises to nothing yields NO tag rather than a malformed one', () => {
  assert.equal(campaignTags('###'), undefined)
  assert.equal(campaignTags('---'), undefined)
})

test('every produced tag satisfies Resend\'s character rule', () => {
  for (const id of ['scamcheck-weekly-2026-08-26', 'asquare-signal-001', 'manual:custom', 'a/b c']) {
    const t = campaignTags(id)
    if (!t) continue
    assert.match(t[0].value, /^[A-Za-z0-9_-]+$/, `invalid tag value for ${id}`)
    assert.match(t[0].name, /^[A-Za-z0-9_-]+$/)
    assert.ok(t[0].value.length <= 256)
  }
})

// ── 2 · Event parsing ───────────────────────────────────────────────────────
const evt = (type, over = {}) => ({
  type, created_at: '2026-08-27T04:00:00.000Z',
  data: { to: ['Person@Example.Test'], email_id: 'msg_123', ...over },
})

test('each supported Resend event maps to its internal type', () => {
  const pairs = [
    ['email.sent', 'sent'], ['email.delivered', 'delivered'], ['email.delivery_delayed', 'delivery_delayed'],
    ['email.bounced', 'bounced'], ['email.opened', 'opened'], ['email.clicked', 'clicked'],
    ['email.complained', 'complained'],
  ]
  for (const [wire, internal] of pairs) {
    assert.equal(parseResendEvent(evt(wire))?.type, internal, `${wire} should map to ${internal}`)
  }
})

test('recipient address is lower-cased on parse', () => {
  assert.equal(parseResendEvent(evt('email.delivered')).email, 'person@example.test')
})

test('campaignId is read from tags — and is undefined without them (today\'s behaviour)', () => {
  assert.equal(parseResendEvent(evt('email.delivered')).campaignId, undefined)
  const tagged = parseResendEvent(evt('email.delivered', { tags: { campaignId: 'camp-1' } }))
  assert.equal(tagged.campaignId, 'camp-1')
})

test('unknown or malformed payloads are rejected, not half-parsed', () => {
  assert.equal(parseResendEvent(evt('email.something_new')), null)
  assert.equal(parseResendEvent({ type: 'email.delivered' }), null)           // no data.to
  assert.equal(parseResendEvent({ data: { to: ['a@b.c'] } }), null)           // no type
  assert.equal(parseResendEvent(null), null)
})

test('FIXED: an empty `to` array is now REJECTED, not stored as "undefined"', () => {
  // Was: `String(data.to[0])` → String(undefined) === 'undefined', which is TRUTHY,
  // so `if (!to) return null` never fired and a malformed payload wrote a junk row
  // into email_events with email "undefined". Now `String(data.to[0] ?? '')`.
  //
  // This expectation was previously pinned to the BROKEN behaviour so the defect was
  // visible; the flip to null is the fix landing.
  assert.equal(parseResendEvent(evt('email.delivered', { to: [] })), null)
})

test('every falsy-recipient shape is rejected rather than half-parsed', () => {
  for (const to of [[], [''], [null], [undefined], '', null, undefined]) {
    assert.equal(parseResendEvent(evt('email.delivered', { to })), null,
      `expected null for to=${JSON.stringify(to)}`)
  }
})

test('a valid recipient is still accepted — the fix did not over-reject', () => {
  assert.equal(parseResendEvent(evt('email.delivered', { to: ['a@b.test'] })).email, 'a@b.test')
  assert.equal(parseResendEvent(evt('email.delivered', { to: 'plain@b.test' })).email, 'plain@b.test')
  // extra recipients are ignored, first wins — unchanged behaviour
  assert.equal(parseResendEvent(evt('email.delivered', { to: ['x@b.test', 'y@b.test'] })).email, 'x@b.test')
})

test('a missing created_at falls back to now rather than NaN', () => {
  const p = parseResendEvent({ type: 'email.delivered', data: { to: ['a@b.test'] } })
  assert.ok(Number.isFinite(p.ts) && p.ts > 0)
})

// ── 3 · Campaign-level aggregation ──────────────────────────────────────────
test('aggregation over a realistic campaign shape', () => {
  const rows = [
    ...Array(50).fill({ type: 'sent' }),
    ...Array(47).fill({ type: 'delivered' }),
    ...Array(12).fill({ type: 'opened' }),
    ...Array(3).fill({ type: 'clicked' }),
    ...Array(2).fill({ type: 'bounced' }),
    { type: 'complained' },
  ]
  const s = summarizeEmailEvents(rows)
  assert.equal(s.total, 115)
  assert.equal(s.byType.sent, 50)
  assert.equal(s.byType.delivered, 47)
  assert.equal(s.deliveryRate, 94)               // 47/50
  assert.equal(s.openRate, 25.5)                 // 12/47
  assert.equal(s.clickRate, 6.4)                 // 3/47
  assert.equal(s.bounceRate, 4)                  // 2/50
})

test('zero events aggregates to zeroes, not NaN — distinguishable from unavailable', () => {
  const s = summarizeEmailEvents([])
  assert.equal(s.total, 0)
  assert.deepEqual(s.byType, {})
  for (const k of ['deliveryRate', 'openRate', 'clickRate', 'bounceRate']) {
    assert.equal(s[k], 0, `${k} must be 0, not NaN`)
    assert.ok(Number.isFinite(s[k]))
  }
})

test('delivered-only data still yields rates (no sent events recorded)', () => {
  const s = summarizeEmailEvents([...Array(10).fill({ type: 'delivered' }), ...Array(2).fill({ type: 'opened' })])
  assert.equal(s.deliveryRate, 0, 'no sent events → delivery rate is not computable, reported as 0')
  assert.equal(s.openRate, 20, 'opens still divide by delivered')
})

// ── 4 · Canceled campaign guards ────────────────────────────────────────────
async function seedCampaign(status) {
  const store = new MemoryStore()
  setStore(store)
  await store.set(CAMPAIGNS, 'c1', {
    id: 'c1', brand: 'scamcheck', status, subject: 's', title: 't', bodyHtml: '<p>b</p>',
    createdAt: new Date().toISOString(),
  })
  await store.set('newsletter', 'nl_a', { email: 'a@example.test', unsubscribed: false })
  return store
}

test('a canceled campaign CANNOT be enqueued', async () => {
  const store = await seedCampaign('canceled')
  const r = await enqueueCampaign('c1')
  assert.equal(r.ok, false)
  assert.match(r.error, /not_approved \(canceled\)/)
  assert.equal((await store.query(CAMPAIGN_SENDS, { limit: 50 })).length, 0)
})

test('a canceled campaign CANNOT be re-approved', async () => {
  await seedCampaign('canceled')
  const r = await approveCampaign('c1')
  assert.equal(r.ok, false)
  assert.match(r.error, /not_draft \(canceled\)/)
})

test('a canceled campaign CANNOT be drained', async () => {
  await seedCampaign('canceled')
  const r = await drainCampaign('c1')
  assert.equal(r.ok, false)
  assert.match(r.error, /not_sending \(canceled\)/)
  assert.equal(r.sent, 0)
})

test('a canceled campaign CANNOT be overwritten by a new compose', async () => {
  const store = await seedCampaign('canceled')
  const r = await composeCustomIssue({ id: 'c1', subject: 'new', title: 'new', bodyHtml: '<p>new</p>' })
  assert.equal(r.created, false)
  assert.match(r.reason, /not-draft \(canceled\)/)
  const doc = await store.get(CAMPAIGNS, 'c1')
  assert.equal(doc.data.subject, 's', 'original content must survive')
  assert.equal(doc.data.status, 'canceled')
})

test('canceled is terminal — all four entry points refuse, so no send path remains', async () => {
  await seedCampaign('canceled')
  const results = [
    (await enqueueCampaign('c1')).ok,
    (await approveCampaign('c1')).ok,
    (await drainCampaign('c1')).ok,
    (await composeCustomIssue({ id: 'c1', subject: 'x', title: 'x', bodyHtml: '<p>x</p>' })).created,
  ]
  assert.deepEqual(results, [false, false, false, false])
})

test('by contrast an APPROVED campaign still enqueues — proving the guards key on status', async () => {
  await seedCampaign('approved')
  const r = await enqueueCampaign('c1')
  assert.equal(r.ok, true)
  assert.equal(r.recipients, 1)
})
