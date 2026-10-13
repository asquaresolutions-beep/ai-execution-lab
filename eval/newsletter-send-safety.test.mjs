// eval/newsletter-send-safety.test.mjs   (asq-newsletter-send-safety-v2)
//
// Offline tests for the two additions to the campaign send path:
//   A · per-campaign exclusions — a reviewed, auditable list of subscriber record ids to
//       leave out of one campaign; the read-only preflight; binding a queue to a preflight.
//   B · duplicate-send protection — the run lock, the per-attempt claim, the three
//       outcomes (sent / failed / uncertain), the provider idempotency key, and the
//       explicit resolution of an uncertain recipient.
//
// Same harness as eval/newsletter-send-eligibility.test.mjs: an in-memory store behind a
// proxy that records every data call and can inject a fault or an after-effect, and a
// stubbed provider that performs no I/O. A request to any other host is recorded as a
// violation. Every address is synthetic. Nothing leaves the machine.
//
// What these tests deliberately do NOT claim:
//   • exactly-once delivery. If the provider accepts a message and the answer is lost,
//     the recipient is 'uncertain' and nothing here can know better (see the LIMIT test);
//   • that the provider honours the idempotency key. Only that the documented header is
//     sent, with the right value, is asserted — the provider is a stub;
//   • that the production database's create-if-absent is atomic. The in-memory store's
//     is; for the live store there is storeSelfCheck, to be run after deployment;
//   • anything about which addresses belong on an exclusion list. Every list here is a
//     synthetic fixture.
//
// Run: node --test --import ./eval/hooks.mjs eval/newsletter-send-safety.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

// Captured by the modules under test at load — set BEFORE importing. Obvious fakes.
process.env.RESEND_API_KEY = 'test-key-not-a-real-secret'
process.env.ADMIN_API_TOKEN = 'test-token-not-a-real-secret'
process.env.NEWSLETTER_TEST_RECIPIENTS = 'preview-inbox@example.test'
delete process.env.WEEKLY_DIGEST_ENABLED
delete process.env.PUBLIC_APP_URL
delete process.env.MAIL_PHYSICAL_ADDRESS
delete process.env.EMAIL_FROM

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const imp = (p) => import(pathToFileURL(B + p).href)

const RESEND_URL = 'https://api.resend.com/emails'
let captured = []      // provider payloads, in order
let sentHeaders = []   // the request headers that went with each payload
let violations = []    // any request that is not a POST to the provider's send endpoint
let onSend = null      // optional async hook(payload) → Response | undefined; may throw to simulate a lost connection
globalThis.fetch = async (url, init) => {
  const u = String(url)
  if (u !== RESEND_URL || String(init?.method || 'GET').toUpperCase() !== 'POST') { violations.push(`${init?.method || 'GET'} ${u}`); return new Response('{}', { status: 500 }) }
  const payload = JSON.parse(String(init?.body ?? '{}'))
  captured.push(payload)
  sentHeaders.push({ ...(init?.headers || {}) })
  const scripted = onSend ? await onSend(payload) : undefined
  return scripted || new Response(JSON.stringify({ id: 'msg_test' }), { status: 200, headers: { 'content-type': 'application/json' } })
}
const refuse = (status, message) => new Response(JSON.stringify({ message }), { status, headers: { 'content-type': 'application/json' } })

const { setStore } = await imp('lib/store/adapter.ts')
const { MemoryStore } = await imp('lib/store/memory-store.ts')
const S = await imp('lib/newsletter/subscribers.ts')
const C = await imp('lib/newsletter/campaigns.ts')
const N = await imp('lib/email/notify.ts')
const { POST } = await imp('app/api/admin/campaigns/route.ts')
const { CAMPAIGNS, CAMPAIGN_SENDS, CAMPAIGN_SEND_CLAIMS: CLAIMS, CAMPAIGN_RUN_LOCKS: LOCKS } = C
const { subscriberDocId } = S

const LIST = 'newsletter'
const SUBSCRIBER_COLLECTIONS = ['newsletter', 'lab_subscribers', 'subscribers']
const EVENTS = 'email_events'
const DATA_OPS = ['get', 'set', 'create', 'update', 'query', 'delete', 'increment']
const WRITES = new Set(['set', 'create', 'update', 'delete', 'increment'])
const QUEUES = C.CAMPAIGN_QUEUES
const TRANSITIONS = C.CAMPAIGN_SEND_TRANSITIONS
const SEND_PATH_WRITES = [CAMPAIGNS, CAMPAIGN_SENDS, CLAIMS, LOCKS, QUEUES, TRANSITIONS]

/**
 * Wrap a store: record every data call. `fault(call, args)` may throw to simulate a crash at
 * that exact call; `after(call, args, result)` runs once the call has completed.
 */
function instrument(store) {
  const calls = []
  const ctl = { fault: null, after: null }
  const proxy = new Proxy(store, {
    get(target, prop) {
      const v = Reflect.get(target, prop)
      if (typeof v !== 'function' || !DATA_OPS.includes(String(prop))) return v
      return async (...args) => {
        const call = { op: String(prop), collection: args[0], id: typeof args[1] === 'string' ? args[1] : undefined }
        calls.push(call)
        if (ctl.fault) ctl.fault(call, args)
        const result = await v.apply(target, args)
        if (ctl.after) await ctl.after(call, args, result)
        return result
      }
    },
  })
  return { proxy, calls, ctl }
}

/** Fresh store with one approved campaign `c1` and the given subscribers (stored under the address-derived id unless `key` is given). */
async function seed(subs, campaign = {}) {
  const store = new MemoryStore()
  await store.set(CAMPAIGNS, 'c1', {
    id: 'c1', brand: 'scamcheck', status: 'approved', subject: 'Subject line', title: 'Headline', bodyHtml: '<p>Body</p>',
    createdAt: '2026-10-01T00:00:00.000Z', approvedAt: '2026-10-02T00:00:00.000Z', ...campaign,
  })
  for (const s of subs) await store.set(LIST, s.key || subscriberDocId(s.email), { email: s.email, unsubscribed: !!s.unsubscribed, source: 'test-seed' })
  const { proxy, calls, ctl } = instrument(store)
  setStore(proxy)
  captured = []; sentHeaders = []; violations = []; onSend = null
  return { store, calls, ctl }
}
const rowId = (email, id = 'c1') => `cs_${id}_${subscriberDocId(email)}`
const rowsOf = async (store, id = 'c1') => (await store.query(CAMPAIGN_SENDS, { where: [{ field: 'campaignId', op: '==', value: id }], limit: 1000 })).map((r) => r.data)
const rowFor = async (store, email, id = 'c1') => (await store.get(CAMPAIGN_SENDS, rowId(email, id)))?.data
const campaign = async (store, id = 'c1') => (await store.get(CAMPAIGNS, id)).data
const subscribersJson = async (store) => JSON.stringify(await Promise.all([...SUBSCRIBER_COLLECTIONS, EVENTS].map((c) => store.query(c, { limit: 1000 }))))
const sentTo = () => captured.map((p) => p.to[0])
const timesSent = (email) => sentTo().filter((x) => x === email).length
const keys = () => sentHeaders.map((h) => h['Idempotency-Key'])
const noViolations = () => assert.equal(violations.length, 0, `unexpected request(s): ${violations.join(', ')}`)
const post = (body) => POST(new Request('https://lab.example.test/api/admin/campaigns', {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer test-token-not-a-real-secret' }, body: JSON.stringify(body),
}))
const lockDoc = async (store, n, id = 'c1') => (await store.get(LOCKS, `${id}__run${n}`))?.data
/** Queue the way the admin route does: against the binding of a preflight taken now. */
const queueBound = async (id = 'c1') => { const p = await C.previewRecipients(id); return C.enqueueCampaign(id, undefined, p.binding) }
const withDailyJob = async (fn) => { process.env.WEEKLY_DIGEST_ENABLED = 'true'; try { return await fn() } finally { delete process.env.WEEKLY_DIGEST_ENABLED } }

// A well-formed exclusion entry. The record id and the evidence are synthetic fixtures.
const EVIDENCE = 'synthetic fixture: provider suppression export 2026-10-10, sha256 0123abcd, row origin bounce'
const excl = (recordId, extra = {}) => ({ recordId, reason: 'provider_suppression', evidence: EVIDENCE, reviewedAt: '2026-10-10T09:30:00.000Z', ...extra })
const FP = (ids) => createHash('sha256').update([...ids].sort().join('\n')).digest('hex')

// ════════════════════════════════════════════════════════════════════════════════
// A · Per-campaign exclusions
// ════════════════════════════════════════════════════════════════════════════════
test('A1 an exclusion must name a record id, a known reason, its evidence and when it was reviewed — or the whole list is refused', () => {
  const good = excl(subscriberDocId('one@example.test'))
  const ok = C.validateExclusions([good, excl('nl_legacy_key', { reason: 'owner_decision', reviewedBy: ' owner ' })])
  assert.equal(ok.ok, true)
  assert.deepEqual(ok.list[0], good)
  assert.deepEqual(ok.list[1], { recordId: 'nl_legacy_key', reason: 'owner_decision', evidence: EVIDENCE, reviewedAt: '2026-10-10T09:30:00.000Z', reviewedBy: 'owner' })
  assert.deepEqual(C.EXCLUSION_REASONS, ['provider_suppression', 'confirmed_permanent_bounce', 'spam_complaint', 'owner_decision'])

  const bad = [
    ['not a list', 'exclusions_must_be_a_list'],
    [{ 0: good }, 'exclusions_must_be_a_list'],
    [[null], 'entry_malformed'],
    [[['x']], 'entry_malformed'],
    [[{ ...good, recordId: 'reader@example.test' }], 'record_id_malformed'],   // an address is never accepted as an id
    [[{ ...good, recordId: '' }], 'record_id_malformed'],
    [[{ ...good, recordId: 42 }], 'record_id_malformed'],
    [[good, { ...good }], 'record_id_repeated', 1],
    [[{ ...good, reason: 'bounced' }], 'reason_unknown'],
    [[{ ...good, reason: undefined }], 'reason_unknown'],
    [[{ ...good, evidence: undefined }], 'evidence_required'],
    [[{ ...good, evidence: 'too short' }], 'evidence_required'],
    [[{ ...good, evidence: 'x'.repeat(501) }], 'evidence_malformed'],
    [[{ ...good, evidence: 'line one of the evidence\nline two' }], 'evidence_malformed'],
    [[{ ...good, evidence: 'the provider export lists reader@example.test as bounced' }], 'evidence_contains_address'],
    [[{ ...good, reviewedAt: undefined }], 'reviewed_at_required'],
    [[{ ...good, reviewedAt: '14 October 2026' }], 'reviewed_at_required'],
    [[{ ...good, reviewedAt: '2026-13-45T99:99:00Z' }], 'reviewed_at_required'],
    [[{ ...good, reviewedAt: new Date(Date.now() + 3_600_000).toISOString() }], 'reviewed_at_in_future'],
    [[{ ...good, reviewedBy: 'owner@example.test' }], 'reviewed_by_malformed'],
    [[{ ...good, reviewedBy: '' }], 'reviewed_by_malformed'],
    [Array.from({ length: 2001 }, (_, i) => excl(`nl_${i}`)), 'too_many_exclusions'],
  ]
  for (const [input, error, index] of bad) {
    const r = C.validateExclusions(input)
    assert.deepEqual([r.ok, r.error], [false, error], JSON.stringify(input).slice(0, 80))
    if (index !== undefined) assert.equal(r.index, index)
  }
  const mixed = C.validateExclusions([good, { ...excl('nl_other'), reason: 'guess' }])
  assert.deepEqual([mixed.ok, mixed.error, mixed.index, 'list' in mixed], [false, 'reason_unknown', 1, false], 'one bad entry refuses the whole list')
})

test('A2 the list is set on a draft or approved campaign, replaces what was there, is frozen once queued, and writes nothing but the campaign', async () => {
  const { store, calls } = await seed([{ email: 'one@example.test' }, { email: 'two@example.test' }], { status: 'draft' })
  const before = await subscribersJson(store)
  const a = subscriberDocId('one@example.test'); const b = subscriberDocId('two@example.test')

  let res = await post({ action: 'set-exclusions', id: 'c1', exclusions: [excl(a), excl(b, { reason: 'owner_decision' })] })
  assert.deepEqual([res.status, await res.json()], [200, { ok: true, count: 2 }])
  let c = await campaign(store)
  assert.deepEqual(c.exclusions.map((e) => [e.recordId, e.reason, e.evidence, e.reviewedAt]), [[a, 'provider_suppression', EVIDENCE, '2026-10-10T09:30:00.000Z'], [b, 'owner_decision', EVIDENCE, '2026-10-10T09:30:00.000Z']])
  assert.match(c.exclusionsSetAt, /^\d{4}-\d\d-\d\dT/); assert.equal(c.exclusionsSetBy, 'admin')
  assert.equal(c.status, 'draft', 'setting the list changes nothing else')

  res = await post({ action: 'set-exclusions', id: 'c1', exclusions: [excl(b)] })
  assert.deepEqual((await campaign(store)).exclusions.map((e) => e.recordId), [b], 'replaced, not merged')

  res = await post({ action: 'set-exclusions', id: 'c1', exclusions: [excl(a), { ...excl(b), evidence: 'no' }] })
  assert.deepEqual([res.status, (await res.json()).error], [400, 'evidence_required'])
  assert.deepEqual((await campaign(store)).exclusions.map((e) => e.recordId), [b], 'a refused list changes nothing')
  res = await post({ action: 'set-exclusions', id: 'c1' })
  assert.deepEqual([res.status, (await res.json()).error], [400, 'exclusions_must_be_a_list'])
  res = await post({ action: 'set-exclusions', id: 'nope', exclusions: [] })
  assert.equal(res.status, 404)
  res = await post({ action: 'set-exclusions', exclusions: [] })
  assert.equal(res.status, 400)

  await C.approveCampaign('c1')
  res = await post({ action: 'set-exclusions', id: 'c1', exclusions: [excl(a)] })
  assert.equal(res.status, 200, 'still allowed once approved, before anything is queued')

  assert.equal(calls.filter((x) => WRITES.has(x.op) && x.collection !== CAMPAIGNS).length, 0, 'only the campaign document is written')
  assert.equal(await subscribersJson(store), before, 'no subscriber record and no event is touched')

  assert.equal((await queueBound()).ok, true)
  for (const status of ['sending', 'sent', 'canceled']) {
    await store.update(CAMPAIGNS, 'c1', { status })
    res = await post({ action: 'set-exclusions', id: 'c1', exclusions: [] })
    assert.deepEqual([res.status, (await res.json()).error], [409, `locked (${status})`])
  }
  for (const status of ['draft', 'approved']) {   // even with the status put back by hand: the queue record freezes the list
    await store.update(CAMPAIGNS, 'c1', { status })
    res = await post({ action: 'set-exclusions', id: 'c1', exclusions: [] })
    assert.deepEqual([res.status, (await res.json()).error], [409, 'locked (queued)'])
  }
  assert.deepEqual((await campaign(store)).exclusions.map((e) => e.recordId), [a], 'the list a campaign was queued with stays')
  assert.equal(captured.length, 0); noViolations()
})

test('A3 an excluded record is left out of the queue and counted, whether named by its address-derived id or its stored id', async () => {
  const { store, calls } = await seed([{ email: 'keep@example.test' }, { email: 'drop@example.test' }, { email: 'legacy@example.test', key: 'nl_legacy_key' }],
    { exclusions: [excl(subscriberDocId('drop@example.test')), excl('nl_legacy_key', { reason: 'owner_decision' })] })
  const before = await subscribersJson(store)
  const q = await queueBound()
  assert.deepEqual([q.ok, q.recipients, q.notQueued], [true, 1, { excluded: 2 }])
  assert.deepEqual((await rowsOf(store)).map((x) => x.email), ['keep@example.test'], 'no row is created for an excluded record')
  assert.deepEqual((await campaign(store)).stats, { recipients: 1, notQueued: { excluded: 2 } })
  const r = await C.drainCampaign('c1')
  assert.deepEqual([r.sent, r.skipped, r.done], [1, 0, true])
  assert.deepEqual(sentTo(), ['keep@example.test'])
  assert.equal(await subscribersJson(store), before, 'excluding someone changes no subscriber record')
  assert.equal(calls.filter((x) => WRITES.has(x.op) && !SEND_PATH_WRITES.includes(x.collection)).length, 0)
  noViolations()
})

test('A4 an exclusion never hides an unsubscribe or an invalid address, and can never add a recipient', async () => {
  const subs = [{ email: 'ok@example.test' }, { email: 'gone@example.test', unsubscribed: true }, { email: '.lead@example.test' }, { email: 'out@example.test' }]
  const ghost = 'nl_' + 'f'.repeat(32)
  const list = [excl(subscriberDocId('gone@example.test')), excl(subscriberDocId('.lead@example.test')), excl(subscriberDocId('out@example.test')), excl(ghost)]
  const { store } = await seed(subs, { exclusions: list })

  const p = await C.previewRecipients('c1')
  assert.deepEqual([p.recipients, p.notQueued], [1, { unsubscribed: 1, invalid_address: 1, excluded: 1 }], 'each record is counted once, under its strongest reason')
  assert.deepEqual(p.exclusions.map((e) => e.effect), ['unsubscribed', 'invalid_address', 'applied', 'no_matching_record'])
  assert.deepEqual([p.blockers, p.binding], [[{ kind: 'exclusion_unmatched', recordId: ghost }], undefined], 'the entry that matches nobody blocks a queue; entries that match a person already left out do not')
  assert.deepEqual(p.recipientIds, [subscriberDocId('ok@example.test')])

  // Take the list away again: the excluded reader comes back; the unsubscribed and the invalid one do not.
  await store.update(CAMPAIGNS, 'c1', { exclusions: [] })
  const without = await C.previewRecipients('c1')
  assert.deepEqual([without.recipients, without.notQueued], [2, { unsubscribed: 1, invalid_address: 1 }])
  // And no list, however written, makes the queue larger than the list-free queue.
  // (Queued without the entry that matches nobody: with it the queue is refused — see the FR-02 tests.)
  await store.update(CAMPAIGNS, 'c1', { exclusions: list.slice(0, 3) })
  const q = await queueBound()
  assert.deepEqual([q.ok, q.recipients], [true, 1])
  assert.ok((await rowsOf(store)).every((x) => x.email === 'ok@example.test'))
})

test('A5 the preflight is read-only, shows ids and never addresses, and is exactly what the queue then holds', async () => {
  const subs = [{ email: 'a@example.test' }, { email: 'b@example.test' }, { email: 'c@example.test' }, { email: 'gone@example.test', unsubscribed: true }, { email: 'B@example.test', key: 'nl_dup' }]
  const { store, calls } = await seed(subs, { exclusions: [excl(subscriberDocId('c@example.test'))] })
  const before = JSON.stringify(await Promise.all([CAMPAIGNS, CAMPAIGN_SENDS, CLAIMS, LOCKS, QUEUES, TRANSITIONS, ...SUBSCRIBER_COLLECTIONS].map((c) => store.query(c, { limit: 1000 }))))

  const res = await post({ action: 'preflight', id: 'c1' })
  const p = await res.json()
  assert.equal(res.status, 200)
  const ids = [subscriberDocId('a@example.test'), subscriberDocId('b@example.test')].sort()
  assert.deepEqual([p.ok, p.status, p.records, p.recipients, p.recipientIds, p.rowsAlreadyQueued, p.truncated], [true, 'approved', 5, 2, ids, 0, false])
  assert.deepEqual(p.notQueued, { unsubscribed: 1, excluded: 1, duplicate_address: 1 })
  assert.equal(p.fingerprint, FP(ids), 'SHA-256 over the sorted record ids')
  assert.ok(!JSON.stringify(p).includes('@'), 'no address in the preflight')
  assert.equal(calls.filter((x) => WRITES.has(x.op)).length, 0, 'the preflight writes nothing')
  assert.equal(JSON.stringify(await Promise.all([CAMPAIGNS, CAMPAIGN_SENDS, CLAIMS, LOCKS, QUEUES, TRANSITIONS, ...SUBSCRIBER_COLLECTIONS].map((c) => store.query(c, { limit: 1000 })))), before)
  assert.equal((await post({ action: 'preflight', id: 'nope' })).status, 404)
  assert.deepEqual([p.binding.recipients, p.binding.fingerprint, p.binding.exclusionsFingerprint, p.blockers], [p.recipients, p.fingerprint, p.exclusionsFingerprint, []], 'the binding is the preflight\'s own values')

  const q = await C.enqueueCampaign('c1', undefined, p.binding)
  assert.deepEqual([q.recipients, q.fingerprint, q.notQueued], [p.recipients, p.fingerprint, p.notQueued], 'the queue is the previewed list')
  assert.deepEqual((await rowsOf(store)).map((x) => x.id.slice('cs_c1_'.length)).sort(), p.recipientIds)

  // The fingerprint depends on who is in the list, not on the order the records come back in.
  const again = await seed([...subs].reverse(), { exclusions: [excl(subscriberDocId('c@example.test'))] })
  assert.equal((await C.previewRecipients('c1')).fingerprint, p.fingerprint)
  await again.store.set(LIST, subscriberDocId('new@example.test'), { email: 'new@example.test', unsubscribed: false })
  assert.notEqual((await C.previewRecipients('c1')).fingerprint, p.fingerprint)
  await seed([...subs].reverse(), { exclusions: [excl(subscriberDocId('c@example.test'))] })
  assert.equal((await queueBound()).fingerprint, p.fingerprint, 'and the queue reports the same fingerprint whichever order it was built in')
  assert.equal(captured.length, 0); noViolations()
})

test('A6 a queue bound to a reviewed preflight is not built if the list has changed since', async () => {
  const { store, calls } = await seed([{ email: 'a@example.test' }, { email: 'b@example.test' }])
  const p = await C.previewRecipients('c1')
  await store.set(LIST, subscriberDocId('late@example.test'), { email: 'late@example.test', unsubscribed: false })   // a sign-up after the review
  calls.length = 0

  let res = await post({ action: 'send', id: 'c1', expect: p.binding })
  let body = await res.json()
  assert.equal(res.status, 409)
  assert.deepEqual([body.ok, body.error, body.recipients], [false, 'recipient_set_changed', 3])
  assert.notEqual(body.fingerprint, p.fingerprint)
  assert.equal(calls.filter((x) => WRITES.has(x.op)).length, 0, 'nothing is queued and nothing is written')
  assert.equal((await campaign(store)).status, 'approved', 'the campaign is still only approved')
  assert.equal((await rowsOf(store)).length, 0)

  // same count, different people: the count alone would not have caught it
  await store.update(LIST, subscriberDocId('a@example.test'), { unsubscribed: true })
  body = await C.enqueueCampaign('c1', undefined, p.binding)
  assert.deepEqual([body.ok, body.error, body.recipients], [false, 'recipient_set_changed', 2])

  for (const expect of [{ ...p.binding, recipients: '2' }, { recipients: 2 }, { fingerprint: p.fingerprint }, { recipients: 2, fingerprint: p.fingerprint }, { ...p.binding, fingerprint: 'abc' }, [], 'yes', { ...p.binding, recipients: -1 }]) {
    res = await post({ action: 'send', id: 'c1', expect })
    assert.deepEqual([res.status, (await res.json()).error], [400, 'invalid_expect'], JSON.stringify(expect))
  }
  assert.equal((await rowsOf(store)).length, 0, 'a malformed expectation is refused, never ignored')

  const fresh = await C.previewRecipients('c1')
  res = await post({ action: 'send', id: 'c1', expect: fresh.binding })
  body = await res.json()
  assert.deepEqual([res.status, body.ok, body.recipients, body.fingerprint, body.bound], [200, true, 2, fresh.fingerprint, true])
  assert.equal((await campaign(store)).status, 'sending')
  assert.equal(captured.length, 0)
})

test('A7 before each delivery the exclusion list is applied again — after the checks it must never replace', async () => {
  // Rows that were queued before any queue record existed (as production code queues them today): the
  // campaign's own list is matched by either id.
  const emails = ['keep@example.test', 'out@example.test', 'both@example.test']
  const { store } = await seed([...emails.map((email) => ({ email })), { email: 'legacy@example.test', key: 'nl_legacy_key' }],
    { status: 'sending', exclusions: [excl(subscriberDocId('out@example.test')), excl(subscriberDocId('both@example.test')), excl('nl_legacy_key')] })
  for (const email of emails) await store.set(CAMPAIGN_SENDS, rowId(email), { id: rowId(email), campaignId: 'c1', email, subscriberId: subscriberDocId(email), status: 'queued', createdAt: '2026-10-02T00:00:00.000Z' })
  await store.set(CAMPAIGN_SENDS, rowId('legacy@example.test'), { id: rowId('legacy@example.test'), campaignId: 'c1', email: 'legacy@example.test', subscriberId: 'nl_legacy_key', status: 'queued', createdAt: '2026-10-02T00:00:00.000Z' })
  await store.update(LIST, subscriberDocId('both@example.test'), { unsubscribed: true })

  const r = await C.drainCampaign('c1')
  assert.deepEqual([r.sent, r.skipped, r.failed, r.done], [1, 3, 0, true])
  assert.deepEqual(sentTo(), ['keep@example.test'])
  assert.equal((await rowFor(store, 'out@example.test')).skipReason, 'excluded')
  assert.equal((await rowFor(store, 'legacy@example.test')).skipReason, 'excluded', 'matched by the record the row was queued from')
  assert.equal((await rowFor(store, 'both@example.test')).skipReason, 'unsubscribed', 'the unsubscribe is what is recorded, not the exclusion')
  const list = await C.listCampaignSends('c1')
  assert.deepEqual(list.byStatus, { sent: 1, skipped: 3 })

  // A queue built by this code has a queue record; the list frozen there is the one applied, by address.
  const next = await seed([...emails.map((email) => ({ email })), { email: 'legacy@example.test', key: 'nl_legacy_key' }], { exclusions: [excl('nl_legacy_key')] })
  assert.deepEqual([(await queueBound()).recipients, (await next.store.get(QUEUES, 'c1')).data.excludedIdentities], [3, [subscriberDocId('legacy@example.test')]])
  await next.store.set(CAMPAIGN_SENDS, rowId('legacy@example.test'), { id: rowId('legacy@example.test'), campaignId: 'c1', email: 'legacy@example.test', subscriberId: 'nl_legacy_key', status: 'queued', attempt: 1, keyGen: 1 })   // a row for the excluded address, however it got there
  await next.store.update(LIST, subscriberDocId('both@example.test'), { unsubscribed: true })
  const d = await C.drainCampaign('c1')
  assert.deepEqual([d.sent, d.skipped, d.done], [2, 2, true])
  assert.equal((await rowFor(next.store, 'legacy@example.test')).skipReason, 'excluded')
  assert.equal((await rowFor(next.store, 'both@example.test')).skipReason, 'unsubscribed')
  assert.deepEqual((await campaign(next.store)).stats, { recipients: 3, notQueued: { excluded: 1 }, sent: 2, failed: 0, skipped: 2 })
  noViolations()
})

test('A8 replacing a draft, when asked for, keeps its reviewed exclusion list', async () => {
  const { store } = await seed([], { status: 'draft' })
  const id = subscriberDocId('one@example.test')
  await C.setCampaignExclusions('c1', [excl(id)], 'owner')
  const res = await post({ action: 'compose-custom', id: 'c1', subject: 'New subject', title: 'New headline', bodyHtml: '<p>New body</p>', replaceDraft: true })
  assert.deepEqual(await res.json(), { created: false, id: 'c1', reason: 'draft-refreshed' })
  const c = await campaign(store)
  assert.deepEqual([c.subject, c.exclusions.map((e) => e.recordId), c.exclusionsSetBy], ['New subject', [id], 'owner'])
})

// ════════════════════════════════════════════════════════════════════════════════
// B · Duplicate-send protection
// ════════════════════════════════════════════════════════════════════════════════
test('B1 even if two runs both get past the lock, each recipient is handed to the provider once: the claim decides', async () => {
  const emails = ['r1@example.test', 'r2@example.test', 'r3@example.test', 'r4@example.test']
  const { store, calls, ctl } = await seed(emails.map((email) => ({ email })))
  await C.enqueueCampaign('c1')
  const before = await subscribersJson(store)
  // Make the lock useless: it reads as released the moment it is taken, so both runs proceed side by side.
  ctl.after = async (call) => { if (call.op === 'create' && call.collection === LOCKS) await store.update(LOCKS, call.id, { releasedAt: 'released early by the test' }) }

  const [a, b] = await Promise.all([C.drainCampaign('c1'), C.drainCampaign('c1')])
  assert.ok(a.ok && b.ok, 'both runs really ran')
  assert.ok(a.sent > 0 && b.sent > 0, 'and both really sent')
  assert.equal(a.sent + b.sent, 4)
  assert.equal((a.held || 0) + (b.held || 0), 4, 'each lost exactly the recipients the other had claimed')
  for (const e of emails) assert.equal(timesSent(e), 1, e)
  assert.ok((await rowsOf(store)).every((x) => x.status === 'sent'))
  assert.equal((await store.query(CLAIMS, { limit: 100 })).length, 4, 'one claim per attempt')
  const c = await campaign(store)
  assert.deepEqual([c.status, c.stats], ['sent', { recipients: 4, notQueued: {}, sent: 4, failed: 0, skipped: 0 }])
  assert.equal(new Set(keys()).size, 4)
  assert.equal(calls.filter((x) => WRITES.has(x.op) && !SEND_PATH_WRITES.includes(x.collection)).length, 0, 'writes stay within the campaign, its rows, the claims and the lock')
  assert.equal(await subscribersJson(store), before)
  noViolations()
})

test('B2 the run lock: a live run refuses a second action; a lock left by a dead run stops counting when it expires', async () => {
  const { store } = await seed([{ email: 'one@example.test' }])
  await C.enqueueCampaign('c1')
  await store.set(LOCKS, 'c1__run1', { campaignId: 'c1', run: 1, runId: 'another-run', startedAt: new Date().toISOString(), expiresAtMs: Date.now() + 200_000 })

  const refused = await C.drainCampaign('c1')
  assert.deepEqual(refused, { ok: false, processed: 0, sent: 0, failed: 0, skipped: 0, done: false, error: 'run_in_progress', retryAfterSeconds: refused.retryAfterSeconds })
  assert.ok(refused.retryAfterSeconds > 190 && refused.retryAfterSeconds <= 200)
  assert.equal(captured.length, 0)
  assert.deepEqual((await store.query(LOCKS, { limit: 10 })).map((l) => [l.id, l.data.runId, l.data.releasedAt]), [['c1__run1', 'another-run', undefined]], 'a refused action neither takes a lock nor touches the one that is held')
  assert.equal((await store.query(CLAIMS, { limit: 10 })).length, 0)
  assert.deepEqual(await withDailyJob(() => C.processCampaignSends()), { enabled: true, processed: 0, sent: 0, failed: 0, skipped: 0, campaignsCompleted: 0 }, 'the daily job respects it too')
  assert.equal(captured.length, 0)

  await store.update(LOCKS, 'c1__run1', { expiresAtMs: Date.now() - 1 })
  const ran = await C.drainCampaign('c1')
  assert.deepEqual([ran.ok, ran.sent, ran.done], [true, 1, true])
  assert.match((await lockDoc(store, 2)).releasedAt, /^\d{4}-\d\d-\d\dT/, 'it took the next number in the chain and marked it released at the end')
  assert.deepEqual([(await lockDoc(store, 1)).runId, (await lockDoc(store, 1)).releasedAt], ['another-run', undefined], 'the dead run\'s lock document is left exactly as it was')
  assert.equal((await store.query(LOCKS, { limit: 10 })).length, 2, 'nothing is deleted')
  assert.equal(timesSent('one@example.test'), 1)
})

test('B3 a run that fails part-way releases its lock and abandons the attempt it had not delivered, so the next action can go on', async () => {
  const { store, ctl } = await seed([{ email: 'r1@example.test' }, { email: 'r2@example.test' }])
  await C.enqueueCampaign('c1')
  let crash = true
  ctl.fault = (call) => {   // the store fails while recipient 2 is being re-checked, before the provider is contacted
    if (crash && call.op === 'get' && call.collection === LIST && call.id === subscriberDocId('r2@example.test')) { crash = false; throw new Error('simulated store error') }
  }
  await assert.rejects(() => C.drainCampaign('c1'), /simulated store error/)
  assert.ok((await lockDoc(store, 1)).releasedAt, 'the lock is released although the run failed')
  assert.deepEqual([(await rowFor(store, 'r2@example.test')).status, (await rowFor(store, 'r2@example.test')).attempt], ['queued', 2], 'nothing was handed to the provider, so the row moves on to a fresh attempt')
  assert.equal((await rowFor(store, 'r1@example.test')).attempt, 1, 'the delivered row is untouched')

  const retry = await C.drainCampaign('c1')
  assert.deepEqual(retry, { ok: true, processed: 1, sent: 1, failed: 0, skipped: 0, done: true })
  assert.deepEqual([timesSent('r1@example.test'), timesSent('r2@example.test')], [1, 1])
  assert.deepEqual((await store.query(CLAIMS, { limit: 10 })).map((d) => d.id).sort(), [`${rowId('r1@example.test')}__a1`, `${rowId('r2@example.test')}__a1`, `${rowId('r2@example.test')}__a2`].sort(), 'the abandoned claim is kept as a record; nothing is deleted')
  assert.equal(keys().at(-1), `${rowId('r2@example.test')}/k1`, 'the provider key is unchanged: no request had been made with it')
})

test('B4 no definite answer from the provider: the recipient is uncertain, the run stops, and nothing retries it by itself', async () => {
  const { store } = await seed([{ email: 'r1@example.test' }, { email: 'r2@example.test' }, { email: 'r3@example.test' }])
  await C.enqueueCampaign('c1')
  onSend = async (p) => { if (p.to[0] === 'r2@example.test') throw new Error('socket hang up') }   // the request left; no answer came back

  const first = await C.drainCampaign('c1')
  assert.deepEqual(first, { ok: true, processed: 2, sent: 1, failed: 0, skipped: 0, done: false, uncertain: 1, remaining: 1, stopped: 'uncertain_outcome' })
  let row = await rowFor(store, 'r2@example.test')
  assert.deepEqual([row.status, row.uncertainReason], ['uncertain', 'no_definite_answer'])
  assert.match(row.error, /socket hang up/)
  assert.ok(row.attemptedAtMs > Date.now() - 60_000)
  assert.ok(!row.sentAt, 'it is not recorded as sent')
  assert.equal((await rowFor(store, 'r3@example.test')).status, 'queued', 'the run did not go on sending into an unclear connection')
  assert.equal(timesSent('r3@example.test'), 0)
  assert.deepEqual((await campaign(store)).stats, { recipients: 3, notQueued: {}, sent: 1, failed: 0, skipped: 0, uncertain: 1 })

  onSend = null
  assert.deepEqual(await C.requeueFailedSends('c1'), { ok: true, requeued: 0 }, 'requeue-failed takes definite refusals only')
  const second = await C.drainCampaign('c1')
  assert.deepEqual(second, { ok: true, processed: 1, sent: 1, failed: 0, skipped: 0, done: true })
  await C.drainCampaign('c1'); await C.requeueFailedSends('c1'); await C.drainCampaign('c1')
  await withDailyJob(() => C.processCampaignSends())
  assert.deepEqual([timesSent('r1@example.test'), timesSent('r2@example.test'), timesSent('r3@example.test')], [1, 1, 1])
  row = await rowFor(store, 'r2@example.test')
  assert.equal(row.status, 'uncertain', 'it stays uncertain until a person decides')
  const c = await campaign(store)
  assert.deepEqual(c.stats, { recipients: 3, notQueued: {}, sent: 2, failed: 0, skipped: 0, uncertain: 1 })

  const list = await C.listCampaignSends('c1')
  assert.deepEqual(list.byStatus, { sent: 2, uncertain: 1 })
  const shown = list.rows.find((x) => x.status === 'uncertain')
  assert.deepEqual([shown.recordId, shown.uncertainReason], [subscriberDocId('r2@example.test'), 'no_definite_answer'])
  assert.ok(list.rows.every((x) => x.email.includes('***@')), 'the listing still masks addresses')
  noViolations()
})

test('B5 only an answer that proves a refusal counts as failed; any other non-success is uncertain', async () => {
  for (const [status, expected] of [[400, 'failed'], [401, 'failed'], [403, 'failed'], [404, 'failed'], [422, 'failed'], [429, 'failed'], [451, 'failed'],
    [408, 'uncertain'], [409, 'uncertain'], [500, 'uncertain'], [502, 'uncertain'], [503, 'uncertain']]) {
    const { store } = await seed([{ email: 'one@example.test' }])
    await C.enqueueCampaign('c1')
    onSend = async () => refuse(status, 'provider answer')
    const r = await C.drainCampaign('c1')
    const row = await rowFor(store, 'one@example.test')
    assert.equal(row.status, expected, `HTTP ${status}`)
    assert.deepEqual([r.failed, r.uncertain || 0], expected === 'failed' ? [1, 0] : [0, 1], `HTTP ${status}`)
    assert.match(row.error, /provider answer/)
    assert.deepEqual(await C.requeueFailedSends('c1'), { ok: true, requeued: expected === 'failed' ? 1 : 0 }, `HTTP ${status}`)
  }
})

test('B6 a definite refusal can be retried safely: a new attempt, a new provider key, one message', async () => {
  const { store } = await seed([{ email: 'one@example.test' }])
  await C.enqueueCampaign('c1')
  let n = 0
  onSend = async () => (++n === 1 ? refuse(429, 'Too many requests') : undefined)
  const first = await C.drainCampaign('c1')
  assert.deepEqual([first.sent, first.failed, first.done], [0, 1, true])
  assert.deepEqual(await C.requeueFailedSends('c1'), { ok: true, requeued: 1 })
  const row = await rowFor(store, 'one@example.test')
  assert.deepEqual([row.status, row.attempt, row.keyGen], ['queued', 2, 2])
  assert.equal((await campaign(store)).status, 'sending')

  const again = await C.drainCampaign('c1')
  assert.deepEqual([again.sent, again.failed, again.done], [1, 0, true])
  const id = rowId('one@example.test')
  assert.deepEqual(keys(), [`${id}/k1`, `${id}/k2`], 'the provider never sees a refused key again')
  assert.deepEqual((await store.query(CLAIMS, { limit: 10 })).map((d) => d.id).sort(), [`${id}__a1`, `${id}__a2`])
  assert.deepEqual((await campaign(store)).stats, { recipients: 1, notQueued: {}, sent: 1, failed: 0, skipped: 0 })
})

test('B7 every campaign delivery carries its own provider key; nothing else does, and nothing else about the request changes', async () => {
  const { store } = await seed([{ email: 'one@example.test' }, { email: 'two@example.test' }])
  await C.enqueueCampaign('c1')
  await C.drainCampaign('c1')
  assert.deepEqual(keys().slice().sort(), [`${rowId('one@example.test')}/k1`, `${rowId('two@example.test')}/k1`].sort())
  assert.ok(keys().every((k) => k.length <= 256))
  assert.deepEqual(Object.keys(sentHeaders[0]).sort(), ['Authorization', 'Idempotency-Key', 'content-type'])
  assert.deepEqual(Object.keys(captured[0]), ['from', 'to', 'subject', 'html', 'text', 'reply_to', 'headers', 'tags'], 'the key is a request header, not part of the message')

  await C.sendCampaignTest('c1', 'preview-inbox@example.test')
  assert.deepEqual(Object.keys(sentHeaders.at(-1)).sort(), ['Authorization', 'content-type'], 'the single-recipient preview carries no key')
  await N.sendListEmail({ to: 'reader@example.test', subject: 'S', title: 'T', bodyHtml: '<p>B</p>' })
  assert.deepEqual(Object.keys(sentHeaders.at(-1)).sort(), ['Authorization', 'content-type'], 'nor does any other list email')

  // A key must fit the provider's 256 characters: a very long campaign id is hashed, deterministically.
  const longId = 'c-' + 'x'.repeat(240)
  await store.set(CAMPAIGNS, longId, { id: longId, brand: 'scamcheck', status: 'approved', subject: 'S', title: 'T', bodyHtml: '<p>B</p>', createdAt: '2026-10-01T00:00:00.000Z' })
  await store.update(LIST, subscriberDocId('two@example.test'), { unsubscribed: true })
  await C.enqueueCampaign(longId)
  await C.drainCampaign(longId)
  const expected = 'asq-nl/' + createHash('sha256').update(`${rowId('one@example.test', longId)}/k1`).digest('hex')
  assert.equal(keys().at(-1), expected)
})

test('B8 an uncertain recipient is settled only by an explicit decision that records its evidence', async () => {
  const setup = async () => {
    const ctx = await seed([{ email: 'one@example.test' }])
    await C.enqueueCampaign('c1')
    onSend = async () => { throw new Error('socket hang up') }
    await C.drainCampaign('c1')
    onSend = null
    assert.equal((await rowFor(ctx.store, 'one@example.test')).status, 'uncertain')
    assert.equal((await campaign(ctx.store)).status, 'sent')
    return ctx
  }
  const rec = subscriberDocId('one@example.test')
  const why = 'provider dashboard, Emails page, read 2026-10-15 10:00 UTC: this message shows as delivered'

  // refusals: nothing changes
  let { store } = await setup()
  for (const [input, error, status] of [
    [{ recordId: 'one@example.test', outcome: 'sent', evidence: why }, 'record_id_required', 400],
    [{ outcome: 'sent', evidence: why }, 'record_id_required', 400],
    [{ recordId: rec, outcome: 'probably', evidence: why }, 'invalid_outcome', 400],
    [{ recordId: rec, outcome: 'sent' }, 'evidence_required', 400],
    [{ recordId: rec, outcome: 'sent', evidence: 'looked ok' }, 'evidence_required', 400],
    [{ recordId: rec, outcome: 'sent', evidence: 'delivered to one@example.test per dashboard' }, 'evidence_contains_address', 400],
    [{ recordId: 'nl_' + 'e'.repeat(32), outcome: 'sent', evidence: why }, 'row_not_found', 404],
  ]) {
    const res = await post({ action: 'resolve-uncertain', id: 'c1', ...input })
    assert.deepEqual([res.status, (await res.json()).error], [status, error], JSON.stringify(input))
  }
  assert.equal((await post({ action: 'resolve-uncertain', id: 'nope', recordId: rec, outcome: 'sent', evidence: why })).status, 404)
  assert.equal((await rowFor(store, 'one@example.test')).status, 'uncertain')

  // 'sent': recorded as sent, with who decided and on what; nothing is sent
  let res = await post({ action: 'resolve-uncertain', id: 'c1', recordId: rec, outcome: 'sent', evidence: why })
  assert.deepEqual([res.status, await res.json()], [200, { ok: true, status: 'sent' }])
  let row = await rowFor(store, 'one@example.test')
  assert.deepEqual([row.status, row.resolution, row.resolutionEvidence, row.resolvedBy], ['sent', 'sent', why, 'admin'])
  assert.match(row.resolvedAt, /^\d{4}-\d\d-\d\dT/)
  assert.deepEqual((await campaign(store)).stats, { recipients: 1, notQueued: {}, sent: 1, failed: 0, skipped: 0 })
  assert.equal(captured.length, 1, 'resolving sends nothing')
  res = await post({ action: 'resolve-uncertain', id: 'c1', recordId: rec, outcome: 'retry', evidence: why })
  assert.deepEqual([res.status, (await res.json()).error], [409, 'not_uncertain (sent)'], 'a settled row cannot be reopened this way')

  // 'retry' inside the provider's key window: a new attempt that carries the SAME key
  ;({ store } = await setup())
  const absent = 'provider dashboard, Emails page, read 2026-10-15 10:00 UTC: no message to this recipient is listed'
  assert.deepEqual(await C.resolveUncertain('c1', { recordId: rec, outcome: 'retry', evidence: absent }), { ok: true, status: 'queued', providerKeyWindow: 'open' })
  row = await rowFor(store, 'one@example.test')
  assert.deepEqual([row.status, row.attempt, row.keyGen, row.resolution], ['queued', 2, 1, 'retry'])
  assert.equal((await campaign(store)).status, 'sending')
  const r = await C.drainCampaign('c1')
  assert.deepEqual([r.sent, r.done], [1, true])
  assert.deepEqual(keys(), [`${rowId('one@example.test')}/k1`, `${rowId('one@example.test')}/k1`], 'the provider is given the chance to recognise the repeat')
  assert.deepEqual((await campaign(store)).stats, { recipients: 1, notQueued: {}, sent: 1, failed: 0, skipped: 0 })

  // 'retry' after the window: the key no longer protects, so it needs an explicit acceptance of that
  ;({ store } = await setup())
  await store.update(CAMPAIGN_SENDS, rowId('one@example.test'), { keyFirstUsedAtMs: Date.now() - 24 * 3_600_000 })
  res = await post({ action: 'resolve-uncertain', id: 'c1', recordId: rec, outcome: 'retry', evidence: absent })
  assert.deepEqual([res.status, await res.json()], [409, { ok: false, error: 'provider_key_window_expired', providerKeyWindow: 'expired' }])
  assert.equal((await rowFor(store, 'one@example.test')).status, 'uncertain')
  assert.deepEqual(await C.resolveUncertain('c1', { recordId: rec, outcome: 'retry', evidence: absent, acceptDuplicateRisk: 'yes' }), { ok: false, error: 'provider_key_window_expired', providerKeyWindow: 'expired' }, 'only a literal true accepts the risk')
  assert.deepEqual(await C.resolveUncertain('c1', { recordId: rec, outcome: 'retry', evidence: absent, acceptDuplicateRisk: true }), { ok: true, status: 'queued', providerKeyWindow: 'expired' })
})

test('B9 a run stops taking recipients when its time is up, well before its lock could expire', async () => {
  const { store } = await seed([{ email: 'r1@example.test' }, { email: 'r2@example.test' }, { email: 'r3@example.test' }])
  await C.enqueueCampaign('c1')
  const realNow = Date.now
  let skew = 0
  Date.now = () => realNow() + skew
  try {
    onSend = async () => { skew = 241_000 }   // four minutes pass while the first message is in flight
    const r = await C.drainCampaign('c1')
    assert.deepEqual(r, { ok: true, processed: 1, sent: 1, failed: 0, skipped: 0, done: false, remaining: 2, stopped: 'time_budget' })
  } finally { Date.now = realNow }
  assert.ok((await lockDoc(store, 1)).releasedAt)
  onSend = null
  const rest = await C.drainCampaign('c1')
  assert.deepEqual([rest.processed, rest.sent, rest.done], [2, 2, true])
  assert.deepEqual(sentTo(), ['r1@example.test', 'r2@example.test', 'r3@example.test'])
})

test('B10 sending in batches: each call says what is left, totals follow the rows, and the campaign is sent only at the end', async () => {
  const emails = ['r1@example.test', 'r2@example.test', 'r3@example.test']
  const { store } = await seed(emails.map((email) => ({ email })))
  await C.enqueueCampaign('c1')
  for (const batch of [0, 201, 1.5, '5', -1, true]) {
    const res = await post({ action: 'drain', id: 'c1', batch })
    assert.deepEqual([res.status, (await res.json()).error], [400, 'invalid_batch'], String(batch))
  }
  assert.equal(captured.length, 0)

  let res = await (await post({ action: 'drain', id: 'c1', batch: 2 })).json()
  assert.deepEqual(res, { ok: true, processed: 2, sent: 2, failed: 0, skipped: 0, done: false, remaining: 1 })
  let c = await campaign(store)
  assert.deepEqual([c.status, c.sentAt, c.stats], ['sending', undefined, { recipients: 3, notQueued: {}, sent: 2, failed: 0, skipped: 0 }])
  res = await (await post({ action: 'drain', id: 'c1', batch: 2 })).json()
  assert.deepEqual(res, { ok: true, processed: 1, sent: 1, failed: 0, skipped: 0, done: true })
  c = await campaign(store)
  assert.deepEqual([c.status, c.stats], ['sent', { recipients: 3, notQueued: {}, sent: 3, failed: 0, skipped: 0 }])
  for (const e of emails) assert.equal(timesSent(e), 1, e)
  res = await (await post({ action: 'drain', id: 'c1', batch: 2 })).json()
  assert.deepEqual([res.ok, res.error], [false, 'not_sending (sent)'])
})

test('B11 the daily job, when enabled, goes through the same claim: an attempt another run holds is left alone', async () => {
  const { store } = await seed([{ email: 'r1@example.test' }, { email: 'r2@example.test' }])
  await C.enqueueCampaign('c1')
  await store.set(CLAIMS, `${rowId('r1@example.test')}__a1`, { sendId: rowId('r1@example.test'), campaignId: 'c1', attempt: 1, runId: 'another-run', claimedAtMs: Date.now() })
  const res = await withDailyJob(() => C.processCampaignSends())
  assert.deepEqual(res, { enabled: true, processed: 1, sent: 1, failed: 0, skipped: 0, campaignsCompleted: 0 })
  assert.deepEqual(sentTo(), ['r2@example.test'])
  assert.deepEqual([keys()[0], Object.keys(sentHeaders[0]).sort()], [`${rowId('r2@example.test')}/k1`, ['Authorization', 'Idempotency-Key', 'content-type']])
  assert.ok((await lockDoc(store, 1)).releasedAt)

  const ctx = await seed([{ email: 'a@example.test' }, { email: 'b@example.test' }])
  await C.enqueueCampaign('c1')
  onSend = async () => { throw new Error('connection reset') }
  const unclear = await withDailyJob(() => C.processCampaignSends())
  assert.deepEqual(unclear, { enabled: true, processed: 1, sent: 0, failed: 0, skipped: 0, campaignsCompleted: 0, uncertain: 1 })
  assert.deepEqual((await rowsOf(ctx.store)).map((x) => x.status).sort(), ['queued', 'uncertain'], 'it stops at the first unclear outcome as well')
})

test('B12 queueing twice at the same moment creates each row once and never overwrites a row that exists', async () => {
  const emails = ['r1@example.test', 'r2@example.test', 'r3@example.test']
  const { store } = await seed(emails.map((email) => ({ email })))
  const [a, b] = await Promise.all([C.enqueueCampaign('c1'), C.enqueueCampaign('c1')])
  assert.ok(a.ok && b.ok)
  assert.equal(a.recipients + b.recipients, 3, 'each row was created by exactly one of the two')
  const rows = await rowsOf(store)
  assert.deepEqual([rows.length, rows.every((x) => x.status === 'queued' && x.attempt === 1 && x.keyGen === 1)], [3, true])
  assert.equal((await campaign(store)).stats.recipients, 3, 'and the stored count is the rows that exist, whichever call wrote last')

  await C.drainCampaign('c1')
  await store.update(CAMPAIGNS, 'c1', { status: 'approved' })   // even if a sent campaign is reset by hand and queued again
  const again = await C.enqueueCampaign('c1')
  assert.deepEqual([again.recipients, again.alreadyQueued], [0, 3])
  assert.ok((await rowsOf(store)).every((x) => x.status === 'sent'), 'a sent row is never turned back into a queued one')
  await C.drainCampaign('c1')
  for (const e of emails) assert.equal(timesSent(e), 1, e)
})

test('B13 the store self-check reports whether create-if-absent really lets one caller win', async () => {
  const { store } = await seed([])
  let res = await post({ action: 'selfcheck' })
  assert.deepEqual([res.status, await res.json()], [200, { ok: true, store: 'memory', sequential: [true, false], concurrentWinners: 1 }])
  assert.equal((await store.query(C.STORE_SELFCHECKS, { limit: 10 })).length, 2, 'its two probe documents stay, in a collection of their own')
  assert.deepEqual(await Promise.all([CAMPAIGNS, CAMPAIGN_SENDS, CLAIMS, LOCKS, LIST].map(async (c) => (await store.query(c, { limit: 10 })).length)), [1, 0, 0, 0, 0], 'and it touches nothing else')
  assert.equal(captured.length, 0)

  // a store whose create always "succeeds" is exactly the fault this exists to catch
  setStore(new Proxy(store, { get: (t, p) => (p === 'create' ? async () => true : typeof t[p] === 'function' ? t[p].bind(t) : t[p]) }))
  res = await post({ action: 'selfcheck' })
  assert.deepEqual([res.status, await res.json()], [500, { ok: false, store: 'memory', sequential: [true, true], concurrentWinners: 5 }])
})

test('B14 without a working create-if-absent the send path refuses to run rather than send unprotected', async () => {
  const { store } = await seed([{ email: 'one@example.test' }])
  await C.enqueueCampaign('c1')
  setStore(new Proxy(store, { get: (t, p) => (p === 'create' ? undefined : typeof t[p] === 'function' ? t[p].bind(t) : t[p]) }))
  await assert.rejects(() => C.drainCampaign('c1'), /create is not a function/)
  await assert.rejects(() => withDailyJob(() => C.processCampaignSends()), /create is not a function/)
  assert.equal(captured.length, 0)
  assert.equal((await rowFor(store, 'one@example.test')).status, 'queued')

  // and if the claim cannot be created because the store errors, nothing is sent either
  const ctx = await seed([{ email: 'one@example.test' }])
  await C.enqueueCampaign('c1')
  ctx.ctl.fault = (call) => { if (call.op === 'create' && call.collection === CLAIMS) throw new Error('simulated store error') }
  await assert.rejects(() => C.drainCampaign('c1'), /simulated store error/)
  assert.equal(captured.length, 0, 'no claim, no delivery')
})

test('B15 LIMIT: exactly-once is not claimed — if the provider accepted and the answer was lost, the recipient is uncertain, not re-sent and not known to be sent', async () => {
  const { store } = await seed([{ email: 'one@example.test' }])
  await C.enqueueCampaign('c1')
  let acceptedByProvider = 0
  onSend = async () => { acceptedByProvider++; throw new Error('connection reset after the request was delivered') }
  const r = await C.drainCampaign('c1')
  assert.deepEqual([r.sent, r.uncertain, r.done], [0, 1, true])
  assert.equal(acceptedByProvider, 1, 'the provider has the message')
  const row = await rowFor(store, 'one@example.test')
  assert.equal(row.status, 'uncertain', 'this code cannot know that; it records what it does know')
  assert.deepEqual((await campaign(store)).stats, { recipients: 1, notQueued: {}, sent: 0, failed: 0, skipped: 0, uncertain: 1 }, 'so the campaign total undercounts by one until a person resolves it')
  onSend = async () => { acceptedByProvider++ }
  await C.requeueFailedSends('c1'); await C.drainCampaign('c1')
  assert.equal(acceptedByProvider, 1, 'at most once per attempt is what is guaranteed')
})

test('B16 a run marks only its own lock released, and nothing in the send path deletes', async () => {
  const { store, calls } = await seed([{ email: 'one@example.test' }, { email: 'two@example.test' }])
  await C.enqueueCampaign('c1')
  // while this run is sending, its lock runs out of time and another run takes the next number
  let once = true
  onSend = async () => {
    if (!once) return
    once = false
    await store.update(LOCKS, 'c1__run1', { expiresAtMs: Date.now() - 1 })
    await store.set(LOCKS, 'c1__run2', { campaignId: 'c1', run: 2, runId: 'the-run-that-took-over', startedAt: new Date().toISOString(), expiresAtMs: Date.now() + 300_000 })
  }
  const r = await C.drainCampaign('c1')
  assert.deepEqual([r.ok, r.sent], [true, 2])
  assert.ok((await lockDoc(store, 1)).releasedAt)
  assert.deepEqual([(await lockDoc(store, 2)).runId, (await lockDoc(store, 2)).releasedAt], ['the-run-that-took-over', undefined], 'the other run still holds the campaign')
  const refused = await C.drainCampaign('c1')
  assert.equal(refused.error, 'not_sending (sent)')
  await C.requeueFailedSends('c1'); await C.resolveUncertain('c1', { recordId: subscriberDocId('one@example.test'), outcome: 'sent', evidence: 'synthetic evidence for the test' })
  await C.storeSelfCheck(); await C.previewRecipients('c1')
  assert.equal(calls.filter((x) => x.op === 'delete').length, 0, 'no delete anywhere in the campaign engine')
})
