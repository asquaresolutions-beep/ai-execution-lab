// eval/newsletter-send-eligibility.test.mjs   (asq-newsletter-send-eligibility-v1)
//
// Offline tests for the campaign send path: who is queued, who is re-checked and
// skipped immediately before delivery, how outcomes and totals are recorded, what
// happens when a send is interrupted and retried, and the two per-campaign rendering
// options (preview line, footer without the ScamCheck link).
//
// The store is wrapped in a proxy that records every data call and can be told to
// throw once, so "nothing writes to a subscriber record" and "a crash here, then a
// retry" are asserted from OBSERVED behaviour. The provider request is stubbed: it
// performs no I/O, and a request to any other host is recorded as a violation
// (throwing would be swallowed by send()'s try/catch). Nothing leaves the machine.
//
// The two tests that used to be named "KNOWN LIMIT" (a retry after an interrupted send,
// and two runs at once) now assert the protection added by asq-newsletter-send-safety-v2.
// The exclusion list, the claims, the lock and the uncertain outcome have their own file:
// eval/newsletter-send-safety.test.mjs.
//
// What these tests deliberately do NOT claim:
//   • that bounced addresses are excluded — the stored event does not say whether a
//     bounce was permanent, and which bounced addresses to exclude is an open decision;
//   • that provider-suppressed addresses are excluded — this code has no provider
//     suppression data.
// Both limits are pinned below so they cannot be mistaken for safeguards.
//
// Run: node --test --import ./eval/hooks.mjs eval/newsletter-send-eligibility.test.mjs
// (drainCampaign paces 600 ms between recipients, so the file takes about half a minute.)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Captured by the modules under test at load — set BEFORE importing. Obvious fakes.
process.env.RESEND_API_KEY = 'test-key-not-a-real-secret'
// This suite exercises campaign sending: the production send switch (asq-campaign-send-switch-v1) is set ON
// for this test process only. eval/newsletter-send-switch.test.mjs covers it OFF.
process.env.CAMPAIGN_SENDS_ENABLED = 'true'
process.env.VERCEL_ENV = 'production'
process.env.ADMIN_API_TOKEN = 'test-token-not-a-real-secret'
process.env.NEWSLETTER_TEST_RECIPIENTS = 'preview-inbox@example.test'
delete process.env.WEEKLY_DIGEST_ENABLED
delete process.env.PUBLIC_APP_URL
delete process.env.MAIL_PHYSICAL_ADDRESS

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const imp = (p) => import(pathToFileURL(B + p).href)

const RESEND_URL = 'https://api.resend.com/emails'
let captured = []      // provider payloads, in order
let violations = []    // any request that is not a POST to the provider's send endpoint
let onSend = null      // optional async hook(payload) → Response | undefined, to script the provider
globalThis.fetch = async (url, init) => {
  const u = String(url)
  if (u !== RESEND_URL || String(init?.method || 'GET').toUpperCase() !== 'POST') { violations.push(`${init?.method || 'GET'} ${u}`); return new Response('{}', { status: 500 }) }
  const payload = JSON.parse(String(init?.body ?? '{}'))
  captured.push(payload)
  const scripted = onSend ? await onSend(payload) : undefined
  return scripted || new Response(JSON.stringify({ id: 'msg_test' }), { status: 200, headers: { 'content-type': 'application/json' } })
}
const refuse = (status, message) => new Response(JSON.stringify({ message }), { status, headers: { 'content-type': 'application/json' } })

const { setStore } = await imp('lib/store/adapter.ts')
const { MemoryStore } = await imp('lib/store/memory-store.ts')
const S = await imp('lib/newsletter/subscribers.ts')
const C = await imp('lib/newsletter/campaigns.ts')
const { parseResendEvent } = await imp('lib/email/webhook.ts')
const { POST } = await imp('app/api/admin/campaigns/route.ts')
const { GET: METRICS_GET } = await imp('app/api/admin/newsletter-metrics/route.ts')
const { CAMPAIGNS, CAMPAIGN_SENDS } = C
const { subscriberDocId, clearlyInvalidEmail } = S

const LIST = 'newsletter'
const SUBSCRIBER_COLLECTIONS = ['newsletter', 'lab_subscribers', 'subscribers']
const EVENTS = 'email_events'
const DATA_OPS = ['get', 'set', 'create', 'update', 'query', 'delete', 'increment']
const WRITES = new Set(['set', 'create', 'update', 'delete', 'increment'])
// The only collections the send path may write to: the campaign, its queue rows, the per-attempt claims and the run lock.
const SEND_PATH_WRITES = () => [CAMPAIGNS, CAMPAIGN_SENDS, C.CAMPAIGN_SEND_CLAIMS, C.CAMPAIGN_RUN_LOCKS]

/** Wrap a store: record every data call; `fault(call, args)` may throw to simulate a crash at that exact call. */
function instrument(store) {
  const calls = []
  const ctl = { fault: null }
  const proxy = new Proxy(store, {
    get(target, prop) {
      const v = Reflect.get(target, prop)
      if (typeof v !== 'function' || !DATA_OPS.includes(String(prop))) return v
      return (...args) => {
        const call = { op: String(prop), collection: args[0], id: typeof args[1] === 'string' ? args[1] : undefined }
        calls.push(call)
        if (ctl.fault) ctl.fault(call, args)
        return v.apply(target, args)
      }
    },
  })
  return { proxy, calls, ctl }
}

/**
 * Fresh store with one approved campaign `c1` and the given subscribers.
 * A subscriber is stored under the id the app derives from its address unless `key` is given.
 */
async function seed(subs, campaign = {}) {
  const store = new MemoryStore()
  await store.set(CAMPAIGNS, 'c1', {
    id: 'c1', brand: 'scamcheck', status: 'approved', subject: 'Subject line', title: 'Headline', bodyHtml: '<p>Body</p>',
    createdAt: '2026-10-01T00:00:00.000Z', approvedAt: '2026-10-02T00:00:00.000Z', ...campaign,
  })
  for (const s of subs) await store.set(LIST, s.key || subscriberDocId(s.email), { email: s.email, unsubscribed: !!s.unsubscribed, source: 'test-seed' })
  const { proxy, calls, ctl } = instrument(store)
  setStore(proxy)
  captured = []; violations = []; onSend = null
  return { store, calls, ctl }
}
const rowsOf = async (store, id = 'c1') => (await store.query(CAMPAIGN_SENDS, { where: [{ field: 'campaignId', op: '==', value: id }], limit: 1000 })).map((r) => r.data)
const rowFor = async (store, email, id = 'c1') => (await store.get(CAMPAIGN_SENDS, `cs_${id}_${subscriberDocId(email)}`))?.data
const subscribersJson = async (store) => JSON.stringify(await Promise.all(SUBSCRIBER_COLLECTIONS.map((c) => store.query(c, { limit: 1000 }))))
const sentTo = () => captured.map((p) => p.to[0])
const noViolations = () => assert.equal(violations.length, 0, `unexpected request(s): ${violations.join(', ')}`)
const post = (body) => POST(new Request('https://lab.example.test/api/admin/campaigns', {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer test-token-not-a-real-secret' }, body: JSON.stringify(body),
}))

// ══ 1 · The address rule: only what can never be a mailbox ═════════════════════
test('clearlyInvalidEmail flags only addresses the grammar itself rules out', () => {
  const invalid = [
    '', 'no-at-sign.example.test', 'two@@example.test', 'a@b@example.test', 'user@nodot',
    '.leading@example.test', 'trailing.@example.test', 'double..dot@example.test',
    'comma,inside@example.test', 'semi;colon@example.test', 'angle<bracket@example.test', 'paren(thesis@example.test',
    'spa ce@example.test', 'zero​width@example.test', 'control\u0007char@example.test',
    'user@-leadinghyphen.test', 'user@trailinghyphen-.test', 'user@double..dot.test', 'user@under_score.test',
    `${'x'.repeat(65)}@example.test`, `user@${'d'.repeat(64)}.test`,
  ]
  for (const a of invalid) assert.equal(clearlyInvalidEmail(a), true, `should be clearly invalid: ${JSON.stringify(a)}`)
  // Unusual is not invalid: these are left for the provider to accept or refuse.
  const notJudged = [
    'reader@example.test', 'first.last+tag@example.co.in', 'UPPER@Example.Test', '  padded@example.test  ',
    "o'brien@example.test", 'under_score@example.test', 'hyphen-@example.test', '_leading@example.test',
    'digits123@sub.domain.example.test', 'ñandú@example.test', 'user@bücher.example', '"quoted"@example.test', 'user@[203.0.113.5]',
  ]
  for (const a of notJudged) assert.equal(clearlyInvalidEmail(a), false, `must not be flagged: ${JSON.stringify(a)}`)
})

// ══ 2 · Queue creation ═════════════════════════════════════════════════════════
test('the queue leaves out unsubscribed, blank and clearly invalid addresses, says how many of each, and edits no subscriber', async () => {
  const { store, calls } = await seed([
    { email: 'one@example.test' }, { email: 'two@example.test' },
    { email: 'gone@example.test', unsubscribed: true },
    { email: 'bad..dots@example.test' }, { email: 'trailing.@example.test' },
    { email: "o'brien@example.test" },
  ])
  await store.set(LIST, 'nl_blank', { email: '', unsubscribed: false })
  const before = await subscribersJson(store)

  const r = await C.enqueueCampaign('c1')
  assert.deepEqual([r.ok, r.recipients, r.notQueued], [true, 3, { unsubscribed: 1, invalid_address: 2, no_email: 1 }])
  assert.match(r.fingerprint, /^[0-9a-f]{64}$/)
  const rows = await rowsOf(store)
  assert.deepEqual(rows.map((x) => x.email).sort(), ['o\'brien@example.test', 'one@example.test', 'two@example.test'])
  assert.ok(rows.every((x) => x.status === 'queued'))
  assert.ok(rows.every((x) => x.subscriberId === subscriberDocId(x.email)), 'each row records the subscriber document it was queued from')
  const c = (await store.get(CAMPAIGNS, 'c1')).data
  assert.equal(c.status, 'sending')
  assert.deepEqual(c.stats, { recipients: 3, notQueued: { unsubscribed: 1, invalid_address: 2, no_email: 1 } })

  assert.equal(await subscribersJson(store), before, 'no subscriber record may change')
  assert.equal(calls.filter((x) => WRITES.has(x.op) && SUBSCRIBER_COLLECTIONS.includes(x.collection)).length, 0)
  assert.equal(captured.length, 0, 'queuing sends nothing')
  noViolations()
})

test('the admin audience count equals what a queue would hold, including the invalid-address exclusion', async () => {
  const { store } = await seed([
    { email: 'one@example.test' }, { email: 'two@example.test' }, { email: 'gone@example.test', unsubscribed: true },
    { email: '.leading@example.test' }, { email: 'DUP@example.test', key: 'nl_dup_a' }, { email: 'dup@example.test', key: 'nl_dup_b' },
  ])
  const res = await METRICS_GET(new Request('https://lab.example.test/api/admin/newsletter-metrics', { headers: { authorization: 'Bearer test-token-not-a-real-secret' } }))
  const { audience } = await res.json()
  const q = await C.enqueueCampaign('c1')
  assert.equal(audience.eligible, q.recipients, 'the count shown before a send must be the number a send queues')
  assert.equal(audience.eligible, 3)
  assert.equal(audience.invalidAddress, 1)
  assert.equal(audience.invalidAddress, q.notQueued.invalid_address)
  assert.equal(audience.unsubscribed, q.notQueued.unsubscribed)
  assert.equal(audience.duplicateEmail, 1)
  assert.equal((await rowsOf(store)).length, 3)
})

// ══ 3 · The check made immediately before each delivery ════════════════════════
test('someone who unsubscribes AFTER the queue was built is not sent to, and the row says why', async () => {
  const { store, calls } = await seed([{ email: 'stays@example.test' }, { email: 'leaves@example.test' }])
  assert.equal((await C.enqueueCampaign('c1')).recipients, 2)
  // the unsubscribe link does exactly this to the record
  await store.update(LIST, subscriberDocId('leaves@example.test'), { unsubscribed: true, unsubscribedAt: '2026-10-03T00:00:00.000Z' })
  const before = await subscribersJson(store)
  calls.length = 0

  const r = await C.drainCampaign('c1')
  assert.deepEqual(r, { ok: true, processed: 2, sent: 1, failed: 0, skipped: 1, done: true })
  assert.deepEqual(sentTo(), ['stays@example.test'], 'no request may be made for the unsubscribed address')
  const row = await rowFor(store, 'leaves@example.test')
  assert.equal(row.status, 'skipped')
  assert.equal(row.skipReason, 'unsubscribed')
  assert.match(row.skippedAt, /^\d{4}-\d\d-\d\dT/)
  assert.ok(!('sentAt' in row) && !row.error, 'a skipped row is neither sent nor failed')
  assert.equal((await rowFor(store, 'stays@example.test')).status, 'sent')

  assert.equal(await subscribersJson(store), before, 'the send path must not edit any subscriber record')
  assert.equal(calls.filter((x) => WRITES.has(x.op) && !SEND_PATH_WRITES().includes(x.collection)).length, 0, 'writes go only to the campaign, its queue rows, the attempt claims and the run lock')
  noViolations()
})

test('the re-read happens immediately before EACH delivery: an unsubscribe during the run is honoured', async () => {
  const { store } = await seed([{ email: 'first@example.test' }, { email: 'second@example.test' }])
  await C.enqueueCampaign('c1')
  onSend = async (payload) => {   // while the first message is going out, the second recipient unsubscribes
    if (payload.to[0] === 'first@example.test') await store.update(LIST, subscriberDocId('second@example.test'), { unsubscribed: true })
  }
  const r = await C.drainCampaign('c1')
  assert.deepEqual([r.sent, r.skipped, r.failed], [1, 1, 0])
  assert.deepEqual(sentTo(), ['first@example.test'])
  assert.equal((await rowFor(store, 'second@example.test')).skipReason, 'unsubscribed')
  noViolations()
})

test('an unsubscribe recorded on the address-derived record stops a row that was queued from a record stored under another id', async () => {
  const { store } = await seed([{ email: 'legacy@example.test', key: 'nl_legacy_key' }])
  assert.equal((await C.enqueueCampaign('c1')).recipients, 1)
  assert.equal((await rowFor(store, 'legacy@example.test')).subscriberId, 'nl_legacy_key')
  // the unsubscribe link targets the id derived from the address
  await store.set(LIST, subscriberDocId('legacy@example.test'), { email: 'legacy@example.test', unsubscribed: true })
  const r = await C.drainCampaign('c1')
  assert.deepEqual([r.sent, r.skipped], [0, 1])
  assert.equal(captured.length, 0)
  assert.equal((await rowFor(store, 'legacy@example.test')).skipReason, 'unsubscribed')
})

test('a row queued from a record under another id is still sent while that record stays subscribed', async () => {
  const { store } = await seed([{ email: 'legacy@example.test', key: 'nl_legacy_key' }])
  await C.enqueueCampaign('c1')
  const r = await C.drainCampaign('c1')
  assert.deepEqual([r.sent, r.skipped], [1, 0])
  assert.deepEqual(sentTo(), ['legacy@example.test'])
})

test('a recipient whose subscriber record no longer exists is skipped as not subscribed', async () => {
  const { store } = await seed([{ email: 'kept@example.test' }, { email: 'removed@example.test' }])
  await C.enqueueCampaign('c1')
  await store.delete(LIST, subscriberDocId('removed@example.test'))
  const r = await C.drainCampaign('c1')
  assert.deepEqual([r.sent, r.skipped, r.failed], [1, 1, 0])
  assert.deepEqual(sentTo(), ['kept@example.test'])
  assert.equal((await rowFor(store, 'removed@example.test')).skipReason, 'not_subscribed')
})

test('a clearly invalid address that is already in the queue is not delivered to', async () => {
  const { store } = await seed([{ email: 'fine@example.test' }])
  await C.enqueueCampaign('c1')
  // a row as older code would have queued it, with its subscriber record present
  const bad = 'trailing.@example.test'
  await store.set(LIST, subscriberDocId(bad), { email: bad, unsubscribed: false })
  await store.set(CAMPAIGN_SENDS, `cs_c1_${subscriberDocId(bad)}`, { id: `cs_c1_${subscriberDocId(bad)}`, campaignId: 'c1', email: bad, status: 'queued', createdAt: '2026-10-02T00:00:00.000Z' })
  const r = await C.drainCampaign('c1')
  assert.deepEqual([r.sent, r.skipped, r.failed], [1, 1, 0])
  assert.deepEqual(sentTo(), ['fine@example.test'])
  assert.equal((await rowFor(store, bad)).skipReason, 'invalid_address')
  noViolations()
})

test('the daily job, when enabled, makes the same check and records the same outcomes', async () => {
  const { store } = await seed([{ email: 'stays@example.test' }, { email: 'leaves@example.test' }])
  await C.enqueueCampaign('c1')
  await store.update(LIST, subscriberDocId('leaves@example.test'), { unsubscribed: true })
  process.env.WEEKLY_DIGEST_ENABLED = 'true'
  let res
  try { res = await C.processCampaignSends() } finally { delete process.env.WEEKLY_DIGEST_ENABLED }
  assert.deepEqual(res, { enabled: true, processed: 2, sent: 1, failed: 0, skipped: 1, campaignsCompleted: 1 })
  assert.deepEqual(sentTo(), ['stays@example.test'])
  assert.equal((await rowFor(store, 'leaves@example.test')).skipReason, 'unsubscribed')
  const c = (await store.get(CAMPAIGNS, 'c1')).data
  assert.equal(c.status, 'sent')
  assert.deepEqual([c.stats.sent, c.stats.failed, c.stats.skipped], [1, 0, 1])
})

test('the daily job still sends nothing while its setting is absent', async () => {
  await seed([{ email: 'one@example.test' }])
  await C.enqueueCampaign('c1')
  assert.deepEqual(await C.processCampaignSends(), { enabled: false, processed: 0, sent: 0, failed: 0, skipped: 0, campaignsCompleted: 0 })
  assert.equal(captured.length, 0)
})

// ══ 4 · Outcomes and totals ════════════════════════════════════════════════════
test('per-recipient outcomes are sent, skipped or failed, and the campaign totals keep the three apart', async () => {
  const { store } = await seed([{ email: 'ok-a@example.test' }, { email: 'leaves@example.test' }, { email: 'refused@example.test' }, { email: 'ok-b@example.test' }])
  await C.enqueueCampaign('c1')
  await store.update(LIST, subscriberDocId('leaves@example.test'), { unsubscribed: true })
  onSend = async (p) => (p.to[0] === 'refused@example.test' ? refuse(422, 'Invalid `to` field.') : undefined)

  const r = await C.drainCampaign('c1')
  assert.deepEqual(r, { ok: true, processed: 4, sent: 2, failed: 1, skipped: 1, done: true })
  const byEmail = Object.fromEntries((await rowsOf(store)).map((x) => [x.email, x]))
  assert.equal(byEmail['ok-a@example.test'].status, 'sent')
  assert.equal(byEmail['ok-b@example.test'].status, 'sent')
  assert.equal(byEmail['leaves@example.test'].status, 'skipped')
  assert.equal(byEmail['refused@example.test'].status, 'failed')
  assert.match(byEmail['refused@example.test'].error, /Invalid `to` field/)
  assert.ok(!byEmail['refused@example.test'].skipReason && !byEmail['leaves@example.test'].error)

  const c = (await store.get(CAMPAIGNS, 'c1')).data
  assert.equal(c.status, 'sent')
  assert.deepEqual(c.stats, { recipients: 4, notQueued: {}, sent: 2, failed: 1, skipped: 1 }, 'a skipped recipient is not a failure')

  const list = await C.listCampaignSends('c1')
  assert.deepEqual(list.byStatus, { sent: 2, skipped: 1, failed: 1 })
  assert.equal(list.total, 4)
  assert.deepEqual(list.rows.filter((x) => x.status === 'skipped').map((x) => x.skipReason), ['unsubscribed'])
  assert.ok(list.rows.every((x) => x.email.includes('***@')), 'the listing still masks addresses')
  noViolations()
})

test('a failure that is retried and then sent is not left counted as a failure; skipped rows are never re-queued', async () => {
  const { store } = await seed([{ email: 'ok@example.test' }, { email: 'retry@example.test' }, { email: 'leaves@example.test' }])
  await C.enqueueCampaign('c1')
  await store.update(LIST, subscriberDocId('leaves@example.test'), { unsubscribed: true })
  let refuseOnce = true
  onSend = async (p) => { if (p.to[0] === 'retry@example.test' && refuseOnce) { refuseOnce = false; return refuse(429, 'Too many requests') } }

  const first = await C.drainCampaign('c1')
  assert.deepEqual([first.sent, first.failed, first.skipped, first.done], [1, 1, 1, true])
  assert.deepEqual((await store.get(CAMPAIGNS, 'c1')).data.stats, { recipients: 3, notQueued: {}, sent: 1, failed: 1, skipped: 1 })

  assert.deepEqual(await C.requeueFailedSends('c1'), { ok: true, requeued: 1 }, 'only the failed row goes back; the skipped row stays skipped')
  assert.equal((await rowFor(store, 'leaves@example.test')).status, 'skipped')
  const second = await C.drainCampaign('c1')
  assert.deepEqual([second.processed, second.sent, second.failed, second.skipped, second.done], [1, 1, 0, 0, true])
  assert.deepEqual((await store.get(CAMPAIGNS, 'c1')).data.stats, { recipients: 3, notQueued: {}, sent: 2, failed: 0, skipped: 1 }, 'totals describe the final rows, not the attempts')
  assert.deepEqual(sentTo(), ['ok@example.test', 'retry@example.test', 'retry@example.test'], 'the unsubscribed address was never requested')
})

test('a run that leaves recipients queued does not mark the campaign sent, by either route', async () => {
  const { store } = await seed([{ email: 'p1@example.test' }, { email: 'p2@example.test' }, { email: 'p3@example.test' }])
  await C.enqueueCampaign('c1')

  const first = await C.drainCampaign('c1', 1)   // a batch smaller than the queue
  assert.deepEqual(first, { ok: true, processed: 1, sent: 1, failed: 0, skipped: 0, done: false, remaining: 2 })
  let c = (await store.get(CAMPAIGNS, 'c1')).data
  assert.equal(c.status, 'sending')
  assert.ok(!c.sentAt, 'no completion time while recipients wait')
  assert.deepEqual(c.stats, { recipients: 3, notQueued: {}, sent: 1, failed: 0, skipped: 0 }, 'totals so far, counted from the rows')

  process.env.WEEKLY_DIGEST_ENABLED = 'true'
  let job
  try { job = await C.processCampaignSends(1) } finally { delete process.env.WEEKLY_DIGEST_ENABLED }
  assert.deepEqual(job, { enabled: true, processed: 1, sent: 1, failed: 0, skipped: 0, campaignsCompleted: 0 })
  assert.equal((await store.get(CAMPAIGNS, 'c1')).data.status, 'sending')
  assert.deepEqual((await rowsOf(store)).map((x) => x.status).sort(), ['queued', 'sent', 'sent'])

  const last = await C.drainCampaign('c1')
  assert.deepEqual([last.processed, last.sent, last.done], [1, 1, true])
  c = (await store.get(CAMPAIGNS, 'c1')).data
  assert.equal(c.status, 'sent')
  assert.deepEqual(c.stats, { recipients: 3, notQueued: {}, sent: 3, failed: 0, skipped: 0 })
  assert.deepEqual(sentTo().slice().sort(), ['p1@example.test', 'p2@example.test', 'p3@example.test'], 'each recipient once')
})

// ══ 5 · What this code does NOT know: bounces, complaints, provider suppression ═
test('LIMIT: a stored bounce event carries nothing that says whether the bounce was permanent', () => {
  const evt = parseResendEvent({
    type: 'email.bounced', created_at: '2026-10-01T10:00:00.000Z',
    data: { to: ['Reader@Example.Test'], email_id: 'msg_1', bounce: { type: 'Permanent', subType: 'General', message: 'mailbox does not exist' }, tags: { campaignId: 'c1' } },
  })
  assert.deepEqual(Object.keys(evt).sort(), ['campaignId', 'email', 'messageId', 'meta', 'ts', 'type'])
  assert.equal(evt.type, 'bounced')
  assert.deepEqual(evt.meta, { tags: { campaignId: 'c1' } })
  assert.ok(!/permanent|mailbox does not exist|subType/i.test(JSON.stringify(evt)), 'the detail is discarded on the way in, so it cannot be used to decide anything later')
})

test('LIMIT: stored bounce and complaint events are not consulted — who to exclude for them is an open decision, not a safeguard here', async () => {
  const { store, calls } = await seed([{ email: 'bounced-before@example.test' }, { email: 'complained-before@example.test' }])
  await store.set(EVENTS, 'ev_1', { type: 'bounced', email: 'bounced-before@example.test', ts: Date.parse('2026-09-11T09:20:00Z') })
  await store.set(EVENTS, 'ev_2', { type: 'complained', email: 'complained-before@example.test', ts: Date.parse('2026-09-11T09:21:00Z') })
  const q = await C.enqueueCampaign('c1')
  assert.deepEqual([q.recipients, q.notQueued], [2, {}], 'a bounce on record is not treated as proof the address is dead')
  const r = await C.drainCampaign('c1')
  assert.deepEqual([r.sent, r.skipped], [2, 0])
  assert.equal(calls.filter((x) => x.collection === EVENTS).length, 0, 'the send path never reads the event history')
})

test('LIMIT: no provider suppression list is read — the only outbound request is the send itself', async () => {
  await seed([{ email: 'one@example.test' }, { email: 'two@example.test' }])
  await C.enqueueCampaign('c1')
  await C.drainCampaign('c1')
  assert.equal(captured.length, 2)
  noViolations()   // any GET, or any other URL, would have been recorded here
  const notify = readFileSync(B + 'lib/email/notify.ts', 'utf8')
  const campaigns = readFileSync(B + 'lib/newsletter/campaigns.ts', 'utf8')
  assert.deepEqual([...notify.matchAll(/fetch\(\s*'([^']+)'/g)].map((m) => m[1]), [RESEND_URL], 'the mail layer talks to one endpoint: send')
  assert.ok(!/\bfetch\(/.test(campaigns), 'the campaign engine makes no network request of its own')
  assert.ok(!/suppression/i.test(notify), 'there is no provider suppression lookup to rely on')
})

// ══ 6 · Duplicates, interruption and retry ═════════════════════════════════════
test('running the send again, or queuing again, never sends to anyone twice', async () => {
  const { store } = await seed([{ email: 'one@example.test' }, { email: 'two@example.test' }])
  await C.enqueueCampaign('c1')
  await C.drainCampaign('c1')
  assert.deepEqual(sentTo(), ['one@example.test', 'two@example.test'])
  assert.equal((await C.drainCampaign('c1')).ok, false, 'a completed campaign cannot be drained again')
  await store.update(CAMPAIGNS, 'c1', { status: 'approved' })   // even if someone resets the status by hand
  assert.equal((await C.enqueueCampaign('c1')).recipients, 0, 'existing rows are never re-created')
  const again = await C.drainCampaign('c1')
  assert.deepEqual([again.processed, again.sent], [0, 0])
  assert.equal(captured.length, 2, 'still exactly one message each')
})

test('interrupted BEFORE a message is handed to the provider: the retry sends that recipient exactly once', async () => {
  const { store, ctl } = await seed([{ email: 'r1@example.test' }, { email: 'r2@example.test' }, { email: 'r3@example.test' }])
  await C.enqueueCampaign('c1')
  let crash = true
  ctl.fault = (call) => {   // the process dies while re-reading recipient 2
    if (crash && call.op === 'get' && call.collection === LIST && call.id === subscriberDocId('r2@example.test')) { crash = false; throw new Error('simulated crash') }
  }
  await assert.rejects(() => C.drainCampaign('c1'), /simulated crash/)
  assert.deepEqual(sentTo(), ['r1@example.test'])
  assert.deepEqual((await rowsOf(store)).map((x) => x.status), ['sent', 'queued', 'queued'])
  assert.equal((await store.get(CAMPAIGNS, 'c1')).data.status, 'sending', 'an interrupted campaign is not marked sent')

  const retry = await C.drainCampaign('c1')
  assert.deepEqual([retry.processed, retry.sent, retry.done], [2, 2, true])
  assert.deepEqual(sentTo(), ['r1@example.test', 'r2@example.test', 'r3@example.test'], 'nobody twice, nobody missed')
  assert.deepEqual((await store.get(CAMPAIGNS, 'c1')).data.stats, { recipients: 3, notQueued: {}, sent: 3, failed: 0, skipped: 0 })
})

test('interrupted AFTER the provider accepted a message but before its row was marked: no retry sends to that recipient again', async () => {
  const { store, ctl } = await seed([{ email: 'r1@example.test' }, { email: 'r2@example.test' }, { email: 'r3@example.test' }])
  await C.enqueueCampaign('c1')
  let crash = true
  ctl.fault = (call, args) => {   // the process dies between the provider's "accepted" and the row update for recipient 2
    if (crash && call.op === 'update' && call.collection === CAMPAIGN_SENDS && call.id === `cs_c1_${subscriberDocId('r2@example.test')}` && args[2]?.status === 'sent') { crash = false; throw new Error('simulated crash') }
  }
  await assert.rejects(() => C.drainCampaign('c1'), /simulated crash/)
  assert.deepEqual(sentTo(), ['r1@example.test', 'r2@example.test'])
  assert.deepEqual((await rowsOf(store)).map((x) => x.status), ['sent', 'queued', 'queued'], 'recipient 2 was accepted by the provider yet still reads as queued')

  // The retry: recipient 2's attempt is already claimed, so it is left alone; recipient 3 goes out.
  const retry = await C.drainCampaign('c1')
  assert.deepEqual(retry, { ok: true, processed: 1, sent: 1, failed: 0, skipped: 0, done: false, held: 1, remaining: 1 })
  await C.drainCampaign('c1'); await C.drainCampaign('c1')   // and however often the action is repeated
  const count = (e) => sentTo().filter((x) => x === e).length
  assert.deepEqual([count('r1@example.test'), count('r2@example.test'), count('r3@example.test')], [1, 1, 1], 'nobody twice')
  assert.equal((await store.get(CAMPAIGNS, 'c1')).data.status, 'sending', 'not marked sent while one outcome is open')

  // Once the claim is older than any run can live, the row is recorded for what it is: outcome unknown.
  const claimId = `cs_c1_${subscriberDocId('r2@example.test')}__a1`
  await store.update(C.CAMPAIGN_SEND_CLAIMS, claimId, { claimedAtMs: Date.now() - 16 * 60_000 })
  const settle = await C.drainCampaign('c1')
  assert.deepEqual(settle, { ok: true, processed: 0, sent: 0, failed: 0, skipped: 0, done: true, uncertain: 1 })
  const row = await rowFor(store, 'r2@example.test')
  assert.deepEqual([row.status, row.uncertainReason], ['uncertain', 'no_outcome_recorded'])
  assert.deepEqual((await store.get(CAMPAIGNS, 'c1')).data.stats, { recipients: 3, notQueued: {}, sent: 2, failed: 0, skipped: 0, uncertain: 1 }, 'neither sent nor failed: uncertain')
  assert.equal(count('r2@example.test'), 1, 'still exactly one request for the recipient whose outcome is unknown')
})

test('a second run started while the first is still running is refused, and nobody is sent to twice', async () => {
  const { store } = await seed([{ email: 'r1@example.test' }, { email: 'r2@example.test' }])
  await C.enqueueCampaign('c1')
  // e.g. the operator's connection drops while the server is still sending, and the action is repeated at once
  const results = await Promise.all([C.drainCampaign('c1'), C.drainCampaign('c1')])
  const ran = results.filter((r) => r.ok); const refused = results.filter((r) => !r.ok)
  assert.equal(ran.length, 1); assert.equal(refused.length, 1)
  assert.deepEqual([ran[0].sent, ran[0].done], [2, true])
  assert.equal(refused[0].error, 'run_in_progress')
  assert.ok(refused[0].retryAfterSeconds > 0 && refused[0].retryAfterSeconds <= 330, 'the refusal says how long the running one may still hold the campaign')
  assert.equal(refused[0].sent, 0)
  const count = (e) => sentTo().filter((x) => x === e).length
  assert.deepEqual([count('r1@example.test'), count('r2@example.test')], [1, 1])
  assert.deepEqual((await store.get(CAMPAIGNS, 'c1')).data.stats, { recipients: 2, notQueued: {}, sent: 2, failed: 0, skipped: 0 })
  const locks = await store.query(C.CAMPAIGN_RUN_LOCKS, { limit: 10 })
  assert.deepEqual(locks.map((l) => [l.id, !!l.data.releasedAt]), [['c1__run1', true]], 'one lock was taken, and it is marked released when the run ends')
})

// ══ 7 · Rendering options: preview line and footer ═════════════════════════════
const LEGACY_HTML = (to) => {   // lib/email/notify.ts wrap() + unsubFooter() exactly as at production commit f7f18c5
  const unsub = `https://scamcheck.asquaresolution.com/api/newsletter/unsubscribe?id=${subscriberDocId(to)}`
  return `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:auto;color:#18181b">
     <h2 style="color:#0ea5e9;margin:0 0 12px">Headline</h2><p>Body</p><p style="font-size:12px;color:#a1a1aa;margin-top:16px;line-height:1.5">
     You're receiving this because you subscribed at asquaresolution.com.
     <a href="${unsub}" style="color:#a1a1aa;text-decoration:underline">Unsubscribe</a>.<br/>
     A Square Solutions, Mumbai, Maharashtra, India</p>
     <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0"/>
     <p style="font-size:12px;color:#71717a">ScamCheck · A Square Solutions · <a href="https://scamcheck.asquaresolution.com">scamcheck.asquaresolution.com</a></p>
   </div>`
}

test('a campaign that sets neither option renders byte-for-byte as before', async () => {
  await seed([{ email: 'reader@example.test' }])
  await C.enqueueCampaign('c1')
  await C.drainCampaign('c1')
  assert.equal(captured.length, 1)
  assert.equal(captured[0].html, LEGACY_HTML('reader@example.test'))
  assert.equal(captured[0].subject, 'Subject line')
  assert.deepEqual(Object.keys(captured[0]), ['from', 'to', 'subject', 'html', 'text', 'reply_to', 'headers', 'tags'])
})

test("footer 'no-link' removes the ScamCheck site link and nothing else", async () => {
  await seed([{ email: 'reader@example.test' }], { footer: 'no-link' })
  await C.enqueueCampaign('c1')
  await C.drainCampaign('c1')
  const p = captured[0]
  assert.equal(p.html, LEGACY_HTML('reader@example.test').replace(' · <a href="https://scamcheck.asquaresolution.com">scamcheck.asquaresolution.com</a>', ''))
  assert.ok(!p.html.includes('href="https://scamcheck.asquaresolution.com"'), 'no link to the ScamCheck site')
  assert.ok(!/scamcheck\.asquaresolution\.com(?!\/api\/newsletter\/unsubscribe)/.test(p.html), 'no bare ScamCheck domain for a mail client to auto-link')
  assert.match(p.html, /<p style="font-size:12px;color:#71717a">ScamCheck · A Square Solutions<\/p>/)
  assert.match(p.html, /api\/newsletter\/unsubscribe\?id=nl_[0-9a-f]{32}/, 'the unsubscribe link is untouched')
  assert.match(p.html, /A Square Solutions, Mumbai, Maharashtra, India/, 'the postal address is untouched')
  assert.ok(!/scamcheck\.asquaresolution\.com\)?\s*$/m.test(p.text.replace(/\(https:\/\/scamcheck\.asquaresolution\.com\/api\/newsletter\/unsubscribe[^)]*\)/, '')), 'nor in the plain-text part')
  assert.match(p.headers['List-Unsubscribe'], /^<https:\/\/[^>]+\/api\/newsletter\/unsubscribe\?id=nl_[0-9a-f]{32}>/)
})

test('preheader is the first text of the HTML part, hidden, exact and escaped; the plain-text part is unchanged', async () => {
  const preheader = 'Here’s a line with <angle> & ampersand.'
  await seed([{ email: 'reader@example.test' }], { preheader })
  await C.enqueueCampaign('c1')
  await C.drainCampaign('c1')
  const withPre = captured[0]
  const block = '<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">Here’s a line with &lt;angle&gt; &amp; ampersand.</div>'
  assert.equal(withPre.html, LEGACY_HTML('reader@example.test').replace('color:#18181b">\n', `color:#18181b">${block}\n`))
  assert.ok(withPre.html.indexOf(block) < withPre.html.indexOf('<h2'), 'it comes before the headline')
  assert.equal(withPre.subject, 'Subject line')

  await seed([{ email: 'reader@example.test' }])
  await C.enqueueCampaign('c1')
  await C.drainCampaign('c1')
  assert.equal(withPre.text, captured[0].text, 'plain-text readers see exactly what they saw before')
  assert.ok(!withPre.text.includes('Here’s a line'))
})

test('the daily job, when enabled, renders with the same options as the admin-triggered send', async () => {
  const options = { preheader: 'Preview line.', footer: 'no-link' }
  await seed([{ email: 'reader@example.test' }], options)
  await C.enqueueCampaign('c1')
  await C.drainCampaign('c1')
  const admin = captured[0]

  await seed([{ email: 'reader@example.test' }], options)
  await C.enqueueCampaign('c1')
  process.env.WEEKLY_DIGEST_ENABLED = 'true'
  try { await C.processCampaignSends() } finally { delete process.env.WEEKLY_DIGEST_ENABLED }
  assert.equal(captured.length, 1)
  assert.equal(captured[0].html, admin.html)
  assert.equal(captured[0].text, admin.text)
  assert.ok(captured[0].html.includes('>Preview line.</div>'), 'the preview line is there')
  assert.ok(!captured[0].html.includes('href="https://scamcheck.asquaresolution.com"'), 'the site link is not')
})

test('the single-recipient preview renders with the same options as the real send, and still writes nothing', async () => {
  const { store, calls } = await seed([{ email: 'reader@example.test' }], { preheader: 'Preview line.', footer: 'no-link', status: 'draft' })
  const before = JSON.stringify(await Promise.all([CAMPAIGNS, CAMPAIGN_SENDS, ...SUBSCRIBER_COLLECTIONS].map((c) => store.query(c, { limit: 1000 }))))
  assert.deepEqual(await C.sendCampaignTest('c1', 'preview-inbox@example.test'), { ok: true })
  const preview = captured[0]
  assert.equal(preview.subject, '[TEST] Subject line')
  assert.ok(preview.html.includes('>Preview line.</div>') && !preview.html.includes('href="https://scamcheck.asquaresolution.com"'))
  assert.equal(JSON.stringify(await Promise.all([CAMPAIGNS, CAMPAIGN_SENDS, ...SUBSCRIBER_COLLECTIONS].map((c) => store.query(c, { limit: 1000 })))), before)
  assert.equal(calls.filter((x) => WRITES.has(x.op)).length, 0)
  assert.equal(calls.filter((x) => SUBSCRIBER_COLLECTIONS.includes(x.collection) || x.collection === CAMPAIGN_SENDS).length, 0, 'the preview still never touches subscribers or the queue')

  await store.update(CAMPAIGNS, 'c1', { status: 'approved' })
  captured = []
  await C.enqueueCampaign('c1')
  await C.drainCampaign('c1')
  const real = captured[0]
  const strip = (h) => h.replace(/nl_[0-9a-f]{32}/g, 'nl_ID')
  assert.equal(strip(real.html), strip(preview.html), 'what is previewed is what is sent')
  assert.equal(real.subject, 'Subject line')
})

test('compose-custom stores the two options only when given, and refuses malformed ones', async () => {
  const { store } = await seed([])
  const base = { action: 'compose-custom', subject: 'S', title: 'T', bodyHtml: '<p>B</p>' }
  let res = await post({ ...base, id: 'plain' })
  assert.equal(res.status, 200)
  const plain = (await store.get(CAMPAIGNS, 'plain')).data
  assert.ok(!('preheader' in plain) && !('footer' in plain), 'a campaign without options is stored exactly as before')
  assert.deepEqual(Object.keys(plain).sort(), ['bodyHtml', 'brand', 'createdAt', 'id', 'source', 'status', 'subject', 'title'])

  res = await post({ ...base, id: 'opts', preheader: 'A preview line.', footer: 'no-link' })
  assert.equal(res.status, 200)
  const opts = (await store.get(CAMPAIGNS, 'opts')).data
  assert.deepEqual([opts.preheader, opts.footer, opts.status], ['A preview line.', 'no-link', 'draft'])

  res = await post({ ...base, id: 'dflt', footer: 'default' })
  assert.equal(res.status, 200)
  assert.ok(!('footer' in (await store.get(CAMPAIGNS, 'dflt')).data))

  for (const [bad, error] of [[{ footer: 'none' }, 'invalid_footer'], [{ footer: 7 }, 'invalid_footer'], [{ preheader: 'two\nlines' }, 'invalid_preheader'],
    [{ preheader: '<b>markup</b>' }, 'invalid_preheader'], [{ preheader: 'x'.repeat(201) }, 'invalid_preheader'], [{ preheader: 42 }, 'invalid_preheader']]) {
    res = await post({ ...base, id: 'bad', ...bad })
    assert.equal(res.status, 400, JSON.stringify(bad))
    assert.equal((await res.json()).error, error)
  }
  assert.equal(await store.get(CAMPAIGNS, 'bad'), null, 'a refused request stores nothing')
  assert.equal(captured.length, 0)
})
