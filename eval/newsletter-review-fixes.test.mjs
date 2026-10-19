// eval/newsletter-review-fixes.test.mjs   (asq-newsletter-send-safety-v3)
//
// One regression test, or more, for each finding of the agent review of candidate
// 6a8285480c6ad469 that this change fixes: IR-01 to IR-06, with IR-16 (a test gap) and
// IR-17 (a stray edit). Each test first sets up the situation the reviewer demonstrated,
// then asserts that the defect no longer happens AND that the refusal or recovery leaves
// everything in a usable state. Failure and recovery paths are tested, not only success.
// The FR-01 and FR-02 tests were added with the final patch that followed the second agent
// review (of candidate 619c85524f6cdd23); the second IR-04 test was rewritten then, because it
// had asserted the FR-01 sequence as correct.
//
// Same harness as the other two newsletter test files: an in-memory store behind a proxy
// that records every data call and can inject a fault or an after-effect, and a stubbed
// provider that performs no I/O. Every address and list is synthetic.
//
// What these tests do NOT claim: anything about the production database or the provider
// (both are stand-ins here), and anything about which real addresses belong on a list.
//
// Run: node --test --import ./eval/hooks.mjs eval/newsletter-review-fixes.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

process.env.RESEND_API_KEY = 'test-key-not-a-real-secret'
// This suite exercises campaign sending: the production send switch (asq-campaign-send-switch-v1) is set ON
// for this test process only. eval/newsletter-send-switch.test.mjs covers it OFF.
process.env.CAMPAIGN_SENDS_ENABLED = 'true'
process.env.VERCEL_ENV = 'production'
process.env.ADMIN_API_TOKEN = 'test-token-not-a-real-secret'
delete process.env.WEEKLY_DIGEST_ENABLED
delete process.env.PUBLIC_APP_URL
delete process.env.MAIL_PHYSICAL_ADDRESS
delete process.env.EMAIL_FROM

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const imp = (p) => import(pathToFileURL(B + p).href)

const RESEND_URL = 'https://api.resend.com/emails'
let captured = []; let sentHeaders = []; let violations = []; let onSend = null
globalThis.fetch = async (url, init) => {
  const u = String(url)
  if (u !== RESEND_URL || String(init?.method || 'GET').toUpperCase() !== 'POST') { violations.push(`${init?.method || 'GET'} ${u}`); return new Response('{}', { status: 500 }) }
  const payload = JSON.parse(String(init?.body ?? '{}'))
  captured.push(payload); sentHeaders.push({ ...(init?.headers || {}) })
  const scripted = onSend ? await onSend(payload, init?.headers?.['Idempotency-Key']) : undefined
  return scripted || new Response(JSON.stringify({ id: 'msg_test' }), { status: 200, headers: { 'content-type': 'application/json' } })
}
const refuse = (status, message) => new Response(JSON.stringify({ message }), { status, headers: { 'content-type': 'application/json' } })

const { setStore } = await imp('lib/store/adapter.ts')
const { MemoryStore } = await imp('lib/store/memory-store.ts')
const S = await imp('lib/newsletter/subscribers.ts')
const C = await imp('lib/newsletter/campaigns.ts')
const { POST } = await imp('app/api/admin/campaigns/route.ts')
const { GET: METRICS_GET } = await imp('app/api/admin/newsletter-metrics/route.ts')
const { CAMPAIGNS, CAMPAIGN_SENDS, CAMPAIGN_SEND_CLAIMS: CLAIMS, CAMPAIGN_RUN_LOCKS: LOCKS, CAMPAIGN_QUEUES: QUEUES, CAMPAIGN_SEND_TRANSITIONS: TRANSITIONS } = C
const { subscriberDocId } = S

const LIST = 'newsletter'
const SUBSCRIBER_COLLECTIONS = ['newsletter', 'lab_subscribers', 'subscribers']
const EVENTS = 'email_events'
const DATA_OPS = ['get', 'set', 'create', 'update', 'query', 'delete', 'increment']
const WRITES = new Set(['set', 'create', 'update', 'delete', 'increment'])

function instrument(store) {
  const calls = []
  const ctl = { fault: null, before: null, after: null }
  const proxy = new Proxy(store, {
    get(target, prop) {
      const v = Reflect.get(target, prop)
      if (typeof v !== 'function' || !DATA_OPS.includes(String(prop))) return v
      return async (...args) => {
        const call = { op: String(prop), collection: args[0], id: typeof args[1] === 'string' ? args[1] : undefined }
        calls.push(call)
        if (ctl.fault) ctl.fault(call, args)
        if (ctl.before) await ctl.before(call, args)
        const result = await v.apply(target, args)
        if (ctl.after) await ctl.after(call, args, result)
        return result
      }
    },
  })
  return { proxy, calls, ctl }
}

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
const rid = (email) => subscriberDocId(email)
const rowId = (email, id = 'c1') => `cs_${id}_${rid(email)}`
const rowsOf = async (store, id = 'c1') => (await store.query(CAMPAIGN_SENDS, { where: [{ field: 'campaignId', op: '==', value: id }], limit: 1000 })).map((r) => r.data)
const rowFor = async (store, email, id = 'c1') => (await store.get(CAMPAIGN_SENDS, rowId(email, id)))?.data
const campaign = async (store, id = 'c1') => (await store.get(CAMPAIGNS, id)).data
const subscribersJson = async (store) => JSON.stringify(await Promise.all([...SUBSCRIBER_COLLECTIONS, EVENTS].map((c) => store.query(c, { limit: 1000 }))))
const everything = async (store) => JSON.stringify(await Promise.all([CAMPAIGNS, CAMPAIGN_SENDS, CLAIMS, LOCKS, QUEUES, TRANSITIONS, ...SUBSCRIBER_COLLECTIONS, EVENTS].map((c) => store.query(c, { limit: 1000 }))))
const writes = (calls) => calls.filter((x) => WRITES.has(x.op))
const sentTo = () => captured.map((p) => p.to[0])
const timesSent = (email) => sentTo().filter((x) => x === email).length
const keys = () => sentHeaders.map((h) => h['Idempotency-Key'])
const post = async (body) => { const res = await POST(new Request('https://lab.example.test/api/admin/campaigns', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer test-token-not-a-real-secret' }, body: JSON.stringify(body) })); return { status: res.status, body: await res.json() } }
const withClock = async (fn) => { const real = Date.now; const clock = { skew: 0 }; Date.now = () => real() + clock.skew; try { return await fn(clock) } finally { Date.now = real } }
const H = 3_600_000

const EVIDENCE = 'synthetic fixture: provider suppression export 2026-10-10, sha256 0123abcd, row origin bounce'
const excl = (recordId, extra = {}) => ({ recordId, reason: 'provider_suppression', evidence: EVIDENCE, reviewedAt: '2026-10-10T09:30:00.000Z', ...extra })
const WHY = 'synthetic evidence: provider dashboard read 2026-10-12 10:00 UTC, nothing listed for this recipient'
/** The binding a preflight would return for these values, dated now. */
const bindingFrom = (p, at = new Date().toISOString()) => ({ recipients: p.recipients, fingerprint: p.fingerprint, exclusionsFingerprint: p.exclusionsFingerprint, preflightAt: at })
/** Queue the way the admin route does: against the binding of a preflight taken now. */
const queueBound = async (id = 'c1') => { const p = await C.previewRecipients(id); return C.enqueueCampaign(id, undefined, p.binding) }

// ════════════════════════════════════════════════════════════════════════════════
// IR-01 · the queue must be bound to a current preflight
// ════════════════════════════════════════════════════════════════════════════════
test('IR-01 the send action builds no queue without a binding — absent or null — and its answer is not a success', async () => {
  // The reviewer's case: a reviewed list, then a sign-up and a replaced list, then `send` with no binding.
  const { store, calls } = await seed([{ email: 'a@example.test' }, { email: 'b@example.test' }, { email: 'c@example.test' }], { exclusions: [excl(rid('c@example.test'))] })
  const pre = (await post({ action: 'preflight', id: 'c1' })).body
  assert.deepEqual([pre.recipients, pre.exclusions.map((e) => e.effect)], [2, ['applied']])
  await store.set(LIST, rid('late@example.test'), { email: 'late@example.test', unsubscribed: false })
  assert.equal((await post({ action: 'set-exclusions', id: 'c1', exclusions: [] })).status, 200)
  calls.length = 0

  for (const body of [{ action: 'send', id: 'c1' }, { action: 'send', id: 'c1', expect: null }]) {
    const res = await post(body)
    assert.deepEqual([res.status, res.body], [400, { ok: false, error: 'binding_required' }], JSON.stringify(body))
  }
  assert.equal(writes(calls).length, 0, 'nothing is written')
  assert.deepEqual([(await campaign(store)).status, (await rowsOf(store)).length, (await store.query(QUEUES, { limit: 10 })).length], ['approved', 0, 0])
  assert.deepEqual((await post({ action: 'cancel', id: 'c1' })).body, { ok: true, status: 'canceled' }, 'and the campaign is not stuck: it can still be cancelled or corrected')
  assert.equal(captured.length, 0)
})

test('IR-01 a malformed binding is refused, never read as "no binding" and never repaired', async () => {
  const { store, calls } = await seed([{ email: 'a@example.test' }, { email: 'b@example.test' }])
  const good = (await C.previewRecipients('c1')).binding
  calls.length = 0
  const bad = [
    'yes', 7, true, [], [good], {},
    { ...good, recipients: String(good.recipients) }, { ...good, recipients: -1 }, { ...good, recipients: 1.5 }, { ...good, recipients: undefined },
    { ...good, fingerprint: 'abc' }, { ...good, fingerprint: good.fingerprint.toUpperCase() }, { ...good, fingerprint: undefined },
    { ...good, exclusionsFingerprint: undefined }, { ...good, exclusionsFingerprint: 'zz' },
    { ...good, preflightAt: undefined }, { ...good, preflightAt: 'yesterday' }, { ...good, preflightAt: 1760000000000 },
  ]
  for (const expect of bad) {
    const res = await post({ action: 'send', id: 'c1', expect })
    assert.deepEqual([res.status, res.body.ok, res.body.error], [400, false, 'invalid_expect'], JSON.stringify(expect))
  }
  // the engine itself also refuses a binding that is not complete and well formed
  for (const expect of [{}, { recipients: 2, fingerprint: good.fingerprint }, { ...good, preflightAt: 'yesterday' }]) {
    assert.equal((await C.enqueueCampaign('c1', undefined, expect)).error, 'invalid_binding', JSON.stringify(expect))
  }
  assert.equal(writes(calls).length, 0)
  assert.deepEqual([(await campaign(store)).status, (await rowsOf(store)).length], ['approved', 0])
})

test('IR-01 a binding is refused when the recipients changed, when the list changed, and when it is stale or from the future', async () => {
  const subs = [{ email: 'a@example.test' }, { email: 'b@example.test' }, { email: 'c@example.test' }]
  const list = [excl(rid('c@example.test'))]

  // (a) a sign-up after the preflight
  let { store, calls } = await seed(subs, { exclusions: list })
  let pre = await C.previewRecipients('c1')
  await store.set(LIST, rid('late@example.test'), { email: 'late@example.test', unsubscribed: false })
  calls.length = 0
  let res = await post({ action: 'send', id: 'c1', expect: pre.binding })
  assert.deepEqual([res.status, res.body.ok, res.body.error, res.body.recipients], [409, false, 'recipient_set_changed', 3])
  assert.notEqual(res.body.fingerprint, pre.fingerprint)

  // (b) the same count, different people
  await store.update(LIST, rid('a@example.test'), { unsubscribed: true })
  res = await post({ action: 'send', id: 'c1', expect: pre.binding })
  assert.deepEqual([res.status, res.body.error, res.body.recipients], [409, 'recipient_set_changed', 2])

  // (c) the list was replaced after the preflight — even by one that selects the same people
  ;({ store, calls } = await seed(subs, { exclusions: list }))
  pre = await C.previewRecipients('c1')
  await C.setCampaignExclusions('c1', [excl(rid('c@example.test'), { evidence: 'a different piece of evidence, entered after the preflight was reviewed' })])
  calls.length = 0
  res = await post({ action: 'send', id: 'c1', expect: pre.binding })
  assert.deepEqual([res.status, res.body.error, res.body.recipients, res.body.fingerprint], [409, 'exclusions_changed', 2, pre.fingerprint], 'the people are the same; the reviewed list is not')

  // (d) a preflight that is too old, and one dated in the future
  const fresh = await C.previewRecipients('c1')
  for (const [at, label] of [[new Date(Date.now() - 31 * 60_000).toISOString(), '31 minutes old'], [new Date(Date.now() + 10 * 60_000).toISOString(), '10 minutes in the future']]) {
    res = await post({ action: 'send', id: 'c1', expect: { ...fresh.binding, preflightAt: at } })
    assert.deepEqual([res.status, res.body.ok, res.body.error], [409, false, 'binding_stale'], label)
  }
  assert.equal(writes(calls).length, 0, 'none of these wrote anything')
  assert.deepEqual([(await campaign(store)).status, (await rowsOf(store)).length, (await store.query(QUEUES, { limit: 10 })).length], ['approved', 0, 0])

  // and the binding of a preflight taken now does build the queue
  res = await post({ action: 'send', id: 'c1', expect: (await C.previewRecipients('c1')).binding })
  assert.deepEqual([res.status, res.body.ok, res.body.recipients, res.body.bound], [200, true, 2, true])
})

test('IR-01 what a queue was bound to is recorded, and from then on the exclusion list cannot be altered', async () => {
  const { store, calls } = await seed([{ email: 'keep@example.test' }, { email: 'out@example.test' }, { email: 'other@example.test' }], { exclusions: [excl(rid('out@example.test'))] })
  const pre = (await post({ action: 'preflight', id: 'c1' })).body
  assert.deepEqual(Object.keys(pre.binding).sort(), ['exclusionsFingerprint', 'fingerprint', 'preflightAt', 'recipients'])
  assert.deepEqual(pre.blockers, [])
  const res = await post({ action: 'send', id: 'c1', expect: pre.binding })
  assert.equal(res.status, 200)

  const record = (await store.get(QUEUES, 'c1')).data
  assert.deepEqual([record.bound, record.recipients, record.fingerprint, record.exclusionsFingerprint, record.preflightAt], [true, 2, pre.fingerprint, pre.exclusionsFingerprint, pre.binding.preflightAt])
  assert.deepEqual([record.exclusions.map((e) => e.recordId), record.excludedIdentities], [[rid('out@example.test')], [rid('out@example.test')]])
  const c = await campaign(store)
  assert.deepEqual([c.queuedWith.bound, c.queuedWith.fingerprint, c.queuedWith.recipients], [true, pre.fingerprint, 2])

  // through the action: refused while sending, and refused if the status is put back by hand
  let again = await post({ action: 'set-exclusions', id: 'c1', exclusions: [] })
  assert.deepEqual([again.status, again.body.error], [409, 'locked (sending)'])
  await store.update(CAMPAIGNS, 'c1', { status: 'approved' })
  calls.length = 0
  again = await post({ action: 'set-exclusions', id: 'c1', exclusions: [] })
  assert.deepEqual([again.status, again.body.error], [409, 'locked (queued)'], 'the queue record, not the status, is what freezes the list')
  assert.equal(writes(calls).length, 0, 'and the refusal comes before anything is written')
  await store.update(CAMPAIGNS, 'c1', { status: 'sending' })

  // by writing to the campaign directly: the send path reads the frozen list, so who is sent to does not change
  await store.update(CAMPAIGNS, 'c1', { exclusions: [excl(rid('other@example.test'))] })
  await store.set(CAMPAIGN_SENDS, rowId('out@example.test'), { id: rowId('out@example.test'), campaignId: 'c1', email: 'out@example.test', subscriberId: rid('out@example.test'), status: 'queued', attempt: 1, keyGen: 1 })   // and even a row slipped in for the excluded reader
  const r = await C.drainCampaign('c1')
  assert.deepEqual([r.sent, r.skipped, r.done], [2, 1, true])
  assert.deepEqual(sentTo().sort(), ['keep@example.test', 'other@example.test'])
  assert.equal((await rowFor(store, 'out@example.test')).skipReason, 'excluded')
  assert.equal((await store.get(QUEUES, 'c1')).data.exclusions[0].recordId, rid('out@example.test'), 'the queue record is never rewritten')
})

test('IR-01 a list change that races the queue action cannot change who is sent to, and is told it came too late', async () => {
  // (a) a write to the campaign's list lands just after the queue froze it
  let { store, ctl } = await seed([{ email: 'keep@example.test' }, { email: 'out@example.test' }], { exclusions: [excl(rid('out@example.test'))] })
  const pre = await C.previewRecipients('c1')
  ctl.after = async (call) => { if (call.op === 'create' && call.collection === QUEUES) await store.update(CAMPAIGNS, 'c1', { exclusions: [] }) }
  assert.equal((await C.enqueueCampaign('c1', undefined, pre.binding)).ok, true)
  ctl.after = null
  assert.deepEqual((await campaign(store)).exclusions.map((e) => e.recordId), [rid('out@example.test')], 'the campaign\'s copy is put back to the frozen list')
  await C.drainCampaign('c1')
  assert.deepEqual(sentTo(), ['keep@example.test'])

  // (b) set-exclusions passes its checks, and a queue is built before its write lands
  ;({ store, ctl } = await seed([{ email: 'keep@example.test' }, { email: 'out@example.test' }], { exclusions: [excl(rid('out@example.test'))] }))
  let once = true
  ctl.after = async (call) => {
    if (!once || call.op !== 'update' || call.collection !== CAMPAIGNS) return
    once = false
    await store.create(QUEUES, 'c1', { campaignId: 'c1', campaignCreatedAt: '2026-10-01T00:00:00.000Z', recipients: 1, fingerprint: 'f'.repeat(64), exclusionsFingerprint: 'e'.repeat(64), exclusions: [excl(rid('out@example.test'))], excludedIdentities: [rid('out@example.test')], bound: true, queuedAt: new Date().toISOString() })
  }
  assert.deepEqual(await C.setCampaignExclusions('c1', []), { ok: false, error: 'locked (queued)' })
  assert.deepEqual((await campaign(store)).exclusions.map((e) => e.recordId), [rid('out@example.test')], 'and the late write is undone')
})

test('IR-01 inside the engine a campaign that carries a list is never queued unbound, and the admin route is the only caller', async () => {
  for (const exclusions of [[excl(rid('b@example.test'))], []]) {
    const { store, calls } = await seed([{ email: 'a@example.test' }, { email: 'b@example.test' }], { exclusions })
    calls.length = 0
    const r = await C.enqueueCampaign('c1')
    assert.deepEqual([r.ok, r.error], [false, 'binding_required'], `list of ${exclusions.length}`)
    assert.equal(writes(calls).length, 0)
    assert.equal((await campaign(store)).status, 'approved')
  }
  // a campaign that has never been given a list can still be queued from code without a binding
  // (an existing test relies on it); the queue record says so
  const { store } = await seed([{ email: 'a@example.test' }])
  const r = await C.enqueueCampaign('c1')
  assert.deepEqual([r.ok, r.recipients, r.bound], [true, 1, false])
  assert.equal((await store.get(QUEUES, 'c1')).data.bound, false)

  // static: nothing in the application queues a campaign except the admin route, which refuses before it calls
  const walk = (dir) => readdirSync(B + dir).flatMap((n) => (statSync(`${B}${dir}/${n}`).isDirectory() ? walk(`${dir}/${n}`) : [`${dir}/${n}`]))
  const code = (f) => readFileSync(B + f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')   // a mention in a comment is not a call
  const callers = [...walk('app'), ...walk('lib')].filter((f) => /\.(ts|tsx)$/.test(f) && /\benqueueCampaign\(/.test(code(f)))
  assert.deepEqual(callers.sort(), ['app/api/admin/campaigns/route.ts', 'lib/newsletter/campaigns.ts'])
  const route = code('app/api/admin/campaigns/route.ts')
  assert.equal((route.match(/\benqueueCampaign\(/g) || []).length, 1)
  assert.ok(route.indexOf("error: 'binding_required'") > 0 && route.indexOf("error: 'binding_required'") < route.indexOf('await enqueueCampaign('), 'the refusal comes before the call')
})

// ════════════════════════════════════════════════════════════════════════════════
// IR-02 · a campaign id is used once
// ════════════════════════════════════════════════════════════════════════════════
test('IR-02 a campaign id that already has rows is refused before anything is written', async () => {
  // The reviewer's case: a row left by an earlier use of the same campaign id.
  const { store, calls } = await seed([{ email: 'old@example.test' }, { email: 'new@example.test' }])
  const old = { id: rowId('old@example.test'), campaignId: 'c1', email: 'old@example.test', status: 'sent', sentAt: '2026-09-11T09:00:00.000Z', createdAt: '2026-09-11T08:00:00.000Z' }
  await store.set(CAMPAIGN_SENDS, old.id, old)
  const before = await everything(store)

  const pre = await C.previewRecipients('c1')
  assert.deepEqual([pre.recipients, pre.rowsAlreadyQueued, pre.blockers, pre.binding], [2, 1, [{ kind: 'campaign_id_in_use' }], undefined], 'the preflight says so and offers no binding')
  calls.length = 0
  const res = await post({ action: 'send', id: 'c1', expect: bindingFrom(pre) })   // even with every value the preflight reported
  assert.deepEqual([res.status, res.body.ok, res.body.error], [409, false, 'campaign_id_in_use'])
  assert.equal((await C.enqueueCampaign('c1')).error, 'campaign_id_in_use', 'and from code, unbound')
  assert.equal(writes(calls).length, 0)
  assert.equal(await everything(store), before, 'no queue record, no row, no change to the campaign or its totals; the old row is as it was')
  assert.equal(captured.length, 0)
})

test('IR-02 a queue record left under the id by another campaign refuses the queue', async () => {
  const { store } = await seed([{ email: 'a@example.test' }])
  assert.equal((await queueBound()).ok, true)
  await C.drainCampaign('c1')
  // the campaign document is replaced by a new one under the same id, for the same people
  await store.set(CAMPAIGNS, 'c1', { id: 'c1', brand: 'scamcheck', status: 'approved', subject: 'A different issue', title: 'T', bodyHtml: '<p>B</p>', createdAt: '2026-10-09T00:00:00.000Z' })
  const pre = await C.previewRecipients('c1')
  assert.deepEqual([pre.blockers, pre.binding], [[{ kind: 'campaign_id_in_use' }], undefined])
  const res = await post({ action: 'send', id: 'c1', expect: bindingFrom(pre) })
  assert.deepEqual([res.status, res.body.error], [409, 'campaign_id_in_use'])
  assert.equal((await campaign(store)).status, 'approved')
  assert.equal(timesSent('a@example.test'), 1, 'the earlier campaign\'s delivery is all there is')
})

test('IR-02 storing an issue under an id in use is refused: a draft is replaced only on request, anything else never', async () => {
  const { store } = await seed([], { status: 'draft', subject: 'An older draft', bodyHtml: '<p>older body</p>' })
  const input = { action: 'compose-custom', id: 'c1', subject: 'New subject', title: 'New', bodyHtml: '<p>new body</p>' }
  const before = await everything(store)
  let res = await post(input)
  assert.deepEqual([res.status, res.body], [409, { ok: false, error: 'campaign_id_in_use', created: false, id: 'c1', reason: 'id-in-use (draft)' }])
  assert.equal(await everything(store), before, 'the older draft is untouched')
  for (const replaceDraft of ['yes', 1, 'true']) assert.deepEqual([(res = await post({ ...input, replaceDraft })).status, res.body.error], [400, 'invalid_replace_draft'])
  assert.equal((await post({ ...input, replaceDraft: false })).status, 409)

  res = await post({ ...input, replaceDraft: true })
  assert.deepEqual([res.status, res.body], [200, { created: false, id: 'c1', reason: 'draft-refreshed' }])
  assert.equal((await campaign(store)).subject, 'New subject')

  // approved, sending, sent or cancelled: never replaced, with or without the request
  for (const status of ['approved', 'sending', 'sent', 'canceled']) {
    await store.update(CAMPAIGNS, 'c1', { status })
    res = await post({ ...input, subject: 'Third', replaceDraft: true })
    assert.deepEqual([res.body.created, res.body.reason], [false, `not-draft (${status})`])
    assert.equal((await campaign(store)).subject, 'New subject')
  }

  // an id with no campaign but with rows, or with a queue record, left by something earlier
  await store.set(CAMPAIGN_SENDS, 'cs_ghost_nl_x', { id: 'cs_ghost_nl_x', campaignId: 'ghost', email: 'x@example.test', status: 'sent' })
  res = await post({ ...input, id: 'ghost' })
  assert.deepEqual([res.status, res.body.error, res.body.reason], [409, 'campaign_id_in_use', 'id-in-use (queue)'])
  await store.set(QUEUES, 'ghost2', { campaignId: 'ghost2' })
  res = await post({ ...input, id: 'ghost2' })
  assert.deepEqual([res.status, res.body.reason], [409, 'id-in-use (queue)'])
  assert.deepEqual([await store.get(CAMPAIGNS, 'ghost'), await store.get(CAMPAIGNS, 'ghost2')], [null, null])

  res = await post({ ...input, id: 'fresh' })
  assert.deepEqual([res.status, res.body], [200, { created: true, id: 'fresh' }], 'an unused id is created as before')
})

test('IR-02 two requests storing the same new campaign id at once: exactly one creates it, and its content is not overwritten', async () => {
  const { store } = await seed([])
  const make = (n) => C.composeCustomIssue({ id: 'same-id', subject: `Subject ${n}`, title: `Title ${n}`, bodyHtml: `<p>${n}</p>` })
  const results = await Promise.all([make(1), make(2), make(3)])
  assert.equal(results.filter((r) => r.created).length, 1)
  assert.ok(results.filter((r) => !r.created).every((r) => r.reason === 'id-in-use (created meanwhile)'))
  const winner = results.findIndex((r) => r.created) + 1
  const stored = await campaign(store, 'same-id')
  assert.deepEqual([stored.subject, stored.bodyHtml, stored.status], [`Subject ${winner}`, `<p>${winner}</p>`, 'draft'])
})

test('IR-02 two queue actions at once build one queue, each row once, and both answers agree', async () => {
  const emails = ['r1@example.test', 'r2@example.test', 'r3@example.test']
  const { store } = await seed(emails.map((email) => ({ email })), { exclusions: [] })
  const pre = await C.previewRecipients('c1')
  const [a, b] = await Promise.all([post({ action: 'send', id: 'c1', expect: pre.binding }), post({ action: 'send', id: 'c1', expect: pre.binding })])
  assert.deepEqual([a.status, b.status, a.body.ok, b.body.ok], [200, 200, true, true])
  assert.equal(a.body.recipients + b.body.recipients, 3, 'each row was created by exactly one of the two')
  assert.deepEqual([(await rowsOf(store)).length, (await store.query(QUEUES, { limit: 10 })).length, (await campaign(store)).stats.recipients], [3, 1, 3])
  await C.drainCampaign('c1')
  for (const e of emails) assert.equal(timesSent(e), 1, e)
})

test('IR-02 a queue action that loses the race to a queue built for a different list is refused, and does not overwrite that queue', async () => {
  const { store, ctl } = await seed([{ email: 'a@example.test' }, { email: 'b@example.test' }], { exclusions: [] })
  const pre = await C.previewRecipients('c1')
  // Between this action's look for a queue record and its attempt to create one, another action creates it — for other recipients.
  const theirs = { campaignId: 'c1', campaignCreatedAt: '2026-10-01T00:00:00.000Z', recipients: 1, fingerprint: 'a'.repeat(64), exclusionsFingerprint: pre.exclusionsFingerprint, exclusions: [], excludedIdentities: [], bound: true, queuedAt: '2026-10-12T00:00:00.000Z' }
  let once = true
  ctl.before = async (call) => { if (once && call.op === 'create' && call.collection === QUEUES) { once = false; await store.create(QUEUES, 'c1', theirs) } }
  const r = await C.enqueueCampaign('c1', undefined, pre.binding)
  ctl.before = null
  assert.deepEqual([r.ok, r.error], [false, 'queue_exists_for_other_recipients'])
  assert.deepEqual((await store.get(QUEUES, 'c1')).data, { ...theirs, id: 'c1' }, 'the queue record that was there first is exactly as it was')
  assert.deepEqual([(await rowsOf(store)).length, (await campaign(store)).status], [0, 'approved'])
})

test('IR-02 a half-built queue is completed for the same recipients or not at all — and is never left stuck', async () => {
  const emails = ['a@example.test', 'b@example.test', 'c@example.test']
  const interrupt = async () => {
    const ctx = await seed(emails.map((email) => ({ email })), { exclusions: [] })
    let crash = true
    ctx.ctl.fault = (call) => { if (crash && call.op === 'create' && call.collection === CAMPAIGN_SENDS && call.id === rowId('b@example.test')) { crash = false; throw new Error('simulated store error') } }
    await assert.rejects(() => queueBound(), /simulated store error/)
    ctx.ctl.fault = null
    assert.deepEqual([(await campaign(ctx.store)).status, (await rowsOf(ctx.store)).length, (await ctx.store.query(QUEUES, { limit: 10 })).length], ['approved', 1, 1])
    return ctx
  }

  // (a) the list is unchanged: a fresh preflight and the same action finish it
  let { store } = await interrupt()
  let pre = await C.previewRecipients('c1')
  assert.deepEqual([pre.blockers, pre.queued, pre.rowsAlreadyQueued], [[], true, 1])
  let res = await post({ action: 'send', id: 'c1', expect: pre.binding })
  assert.deepEqual([res.status, res.body.ok, res.body.recipients, res.body.alreadyQueued], [200, true, 2, 1])
  await C.drainCampaign('c1')
  for (const e of emails) assert.equal(timesSent(e), 1, e)

  // (b) someone signed up in between: the half-built queue is not completed for a different list
  ;({ store } = await interrupt())
  await store.set(LIST, rid('late@example.test'), { email: 'late@example.test', unsubscribed: false })
  pre = await C.previewRecipients('c1')
  assert.deepEqual([pre.blockers, pre.binding], [[{ kind: 'queue_exists_for_other_recipients' }], undefined])
  res = await post({ action: 'send', id: 'c1', expect: bindingFrom(pre) })
  assert.deepEqual([res.status, res.body.ok, res.body.error], [409, false, 'queue_exists_for_other_recipients'])
  assert.equal((await rowsOf(store)).length, 1, 'no further row')
  // the way out: cancel, and store the issue again under a new id
  assert.deepEqual((await post({ action: 'cancel', id: 'c1' })).body, { ok: true, status: 'canceled' })
  assert.equal((await C.drainCampaign('c1')).error, 'not_sending (canceled)')
  assert.equal(captured.length, 0)
})

// ════════════════════════════════════════════════════════════════════════════════
// IR-03 · a recipient is an address, not a record
// ════════════════════════════════════════════════════════════════════════════════
test('IR-03 an exclusion given by a stored record id excludes the ADDRESS: a second record cannot keep it eligible', async () => {
  // The reviewer's case.
  const email = 'dup@example.test'
  const { store, calls } = await seed([{ email, key: 'legacy_doc_1' }, { email }, { email: 'keep@example.test' }], { exclusions: [excl('legacy_doc_1', { reason: 'spam_complaint' })] })
  const before = await subscribersJson(store)
  const pre = await C.previewRecipients('c1')
  assert.deepEqual(pre.exclusions.map((e) => e.effect), ['applied'])
  assert.deepEqual([pre.recipients, pre.notQueued, pre.recipientIds, pre.duplicateAddresses], [1, { excluded: 2 }, [rid('keep@example.test')], 1], 'both records of the excluded address are left out')
  const q = await C.enqueueCampaign('c1', undefined, pre.binding)
  assert.deepEqual([q.ok, q.recipients], [true, 1])
  const r = await C.drainCampaign('c1')
  assert.deepEqual([r.sent, r.skipped], [1, 0])
  assert.equal(timesSent(email), 0, 'the excluded address is not sent to')
  assert.deepEqual((await store.get(QUEUES, 'c1')).data.excludedIdentities, [rid(email)], 'what is frozen is the address, whichever id named it')

  // the same whichever of the two ids is used, and whichever order the records are read in
  for (const [subs, id] of [[[{ email }, { email, key: 'legacy_doc_1' }], 'legacy_doc_1'], [[{ email, key: 'legacy_doc_1' }, { email }], rid(email)], [[{ email, key: 'legacy_doc_1' }, { email: 'DUP@Example.Test', key: 'legacy_doc_2' }], 'legacy_doc_2']]) {
    await seed(subs, { exclusions: [excl(id)] })
    const p = await C.previewRecipients('c1')
    assert.deepEqual([p.recipients, p.notQueued, p.exclusions[0].effect], [0, { excluded: 2 }, 'applied'], id)
  }
  assert.equal(await subscribersJson(store), before, 'no subscriber record is merged, deleted or changed')
  assert.equal(calls.filter((x) => WRITES.has(x.op) && SUBSCRIBER_COLLECTIONS.includes(x.collection)).length, 0)
})

test('IR-03 normalisation is exactly "trim, then lower-case": such records are one recipient, and nothing else is folded together', async () => {
  const { store } = await seed([
    { email: 'Reader@Example.Test', key: 'k1' }, { email: '  reader@example.test  ', key: 'k2' }, { email: 'READER@EXAMPLE.TEST', key: 'k3' },
    { email: 'rea.der@example.test' }, { email: 'reader+news@example.test' }, { email: 'reader@sub.example.test' },
  ])
  const p = await C.previewRecipients('c1')
  assert.deepEqual([p.records, p.recipients, p.notQueued, p.duplicateAddresses], [6, 4, { duplicate_address: 2 }, 1])
  assert.deepEqual(p.recipientIds, ['reader@example.test', 'rea.der@example.test', 'reader+news@example.test', 'reader@sub.example.test'].map(rid).sort(), 'a dot, a +tag or another domain is a different recipient')
  assert.equal(rid('  Reader@Example.Test '), rid('reader@example.test'), 'the identity of an address is its address-derived id')
  await C.enqueueCampaign('c1')
  const rows = await rowsOf(store)
  assert.deepEqual(rows.map((x) => x.email).sort(), ['rea.der@example.test', 'reader+news@example.test', 'reader@example.test', 'reader@sub.example.test'], 'the queued address is the normalised one')
  assert.equal(rows.find((x) => x.email === 'reader@example.test').subscriberId, 'k1', 'queued from the first record read; the others are untouched')
})

test('IR-03 the address queued and handed to the provider is the normalised one even when the record read first holds it padded; no record is changed', async () => {
  // The padded record is read FIRST for one address and is the ONLY record for the other.
  const { store } = await seed([{ email: '  Padded@Example.Test  ', key: 'k1' }, { email: 'padded@example.test', key: 'k2' }, { email: ' Solo@Example.Test ', key: 'k3' }])
  const before = await subscribersJson(store)
  const q = await queueBound()
  assert.deepEqual([q.ok, q.recipients, q.notQueued], [true, 2, { duplicate_address: 1 }])
  const rows = await rowsOf(store)
  assert.deepEqual(rows.map((x) => `${x.email}|${x.subscriberId}|${x.id}`).sort(), [`padded@example.test|k1|${rowId('padded@example.test')}`, `solo@example.test|k3|${rowId('solo@example.test')}`], 'the row holds the address without surrounding whitespace, under the id derived from it')
  const r = await C.drainCampaign('c1')
  assert.deepEqual([r.sent, r.skipped], [2, 0])
  assert.deepEqual(sentTo().sort(), ['padded@example.test', 'solo@example.test'], 'the provider is given exactly the normalised address')
  assert.equal(await subscribersJson(store), before, 'the stored records keep their addresses exactly as they were')
})

test('IR-03 an address with several records is ruled by the strictest: an unsubscribe on any one leaves all of them out', async () => {
  const { store } = await seed([{ email: 'two@example.test', key: 'legacy_a', unsubscribed: true }, { email: 'two@example.test' }, { email: 'Two@example.test', key: 'legacy_b' }, { email: 'one@example.test' }])
  const p = await C.previewRecipients('c1')
  assert.deepEqual([p.recipients, p.notQueued, p.recipientIds], [1, { unsubscribed: 3 }, [rid('one@example.test')]])
  const res = await METRICS_GET(new Request('https://lab.example.test/api/admin/newsletter-metrics', { headers: { authorization: 'Bearer test-token-not-a-real-secret' } }))
  const { audience } = await res.json()
  assert.deepEqual([audience.eligible, audience.unsubscribed, audience.duplicateEmail], [1, 3, 0], 'the admin audience count applies the same rule')
  // …whichever of the records is read first
  await seed([{ email: 'two@example.test' }, { email: 'Two@example.test', key: 'legacy_b' }, { email: 'two@example.test', key: 'legacy_a', unsubscribed: true }, { email: 'one@example.test' }])
  const lastRead = await C.previewRecipients('c1')
  assert.deepEqual([lastRead.recipients, lastRead.notQueued], [1, { unsubscribed: 3 }])
  const mirror = await (await METRICS_GET(new Request('https://lab.example.test/api/admin/newsletter-metrics', { headers: { authorization: 'Bearer test-token-not-a-real-secret' } }))).json()
  assert.deepEqual([mirror.audience.eligible, mirror.audience.unsubscribed], [1, 3])
  await seed([{ email: 'two@example.test', key: 'legacy_a', unsubscribed: true }, { email: 'two@example.test' }, { email: 'Two@example.test', key: 'legacy_b' }, { email: 'one@example.test' }])
  const q = await C.enqueueCampaign('c1')
  assert.equal(q.recipients, audience.eligible)
  await C.drainCampaign('c1')
  assert.deepEqual(sentTo(), ['one@example.test'])
  // an unsubscribe AND an exclusion on the same address: the unsubscribe is what is reported
  await seed([{ email: 'two@example.test', key: 'legacy_a', unsubscribed: true }, { email: 'two@example.test' }], { exclusions: [excl(rid('two@example.test'))] })
  const both = await C.previewRecipients('c1')
  assert.deepEqual([both.notQueued, both.exclusions[0].effect], [{ unsubscribed: 2 }, 'unsubscribed'])
  assert.equal((await store.get(LIST, 'legacy_a')).data.unsubscribed, true)
})

test('IR-03 an exclusion that could mean two addresses is not guessed at: the preflight flags it and the queue is refused', async () => {
  // A record holding X's address is stored under the id derived from Y's address, and Y has a record elsewhere.
  const X = 'x@example.test'; const Y = 'y@example.test'
  const { store, calls } = await seed([{ email: X, key: rid(Y) }, { email: Y, key: 'legacy_y' }, { email: 'z@example.test' }], { exclusions: [excl(rid(Y))] })
  const before = await everything(store)
  const pre = await C.previewRecipients('c1')
  assert.deepEqual([pre.blockers, pre.binding, pre.exclusions[0].effect], [[{ kind: 'exclusion_ambiguous', recordId: rid(Y) }], undefined, 'ambiguous'])
  calls.length = 0
  const res = await post({ action: 'send', id: 'c1', expect: bindingFrom(pre) })
  assert.deepEqual([res.status, res.body.ok, res.body.error, res.body.ambiguous], [409, false, 'identity_ambiguous', [rid(Y)]])
  assert.equal(writes(calls).length, 0)
  assert.equal(await everything(store), before)

  // naming each address by an id that can only mean that address resolves it
  assert.equal((await C.setCampaignExclusions('c1', [excl('legacy_y')])).ok, true)
  const clear = await C.previewRecipients('c1')
  assert.deepEqual([clear.blockers, clear.recipients, clear.notQueued, clear.exclusions[0].effect], [[], 2, { excluded: 1 }, 'applied'])
  assert.deepEqual(clear.recipientIds, [rid(X), rid('z@example.test')].sort())
})

// ════════════════════════════════════════════════════════════════════════════════
// IR-04 · the provider key's 24 hours run from its first use
// ════════════════════════════════════════════════════════════════════════════════
test('IR-04 a later retry cannot move the start of the window: past 24 hours from the first uncertain outcome every retry needs the risk accepted', async () => {
  await withClock(async (clock) => {
    // The reviewer's case, with a provider that behaves as documented: a key is kept 24 hours from its first use.
    const { store } = await seed([{ email: 'one@example.test' }])
    await C.enqueueCampaign('c1')
    const firstUse = new Map(); let delivered = 0; let mode = 'accept-then-lose-answer'
    onSend = async (_p, key) => {
      if (mode === 'never-arrives') throw new Error('connect ETIMEDOUT')
      const seen = firstUse.get(key)
      if (seen === undefined || Date.now() - seen >= 24 * H) { firstUse.set(key, Date.now()); delivered++ }
      if (mode === 'accept-then-lose-answer') throw new Error('socket hang up')
      return undefined
    }
    const t0 = Date.now()
    await C.drainCampaign('c1')                                                   // T0: accepted, answer lost
    let row = await rowFor(store, 'one@example.test')
    assert.deepEqual([row.status, delivered], ['uncertain', 1])
    assert.ok(Math.abs(row.keyFirstUsedAtMs - t0) < 5_000, 'the first use of the key is recorded')
    const first = row.keyFirstUsedAtMs

    clock.skew = 20 * H                                                           // T0 + 20 h: inside the window
    assert.deepEqual(await C.resolveUncertain('c1', { recordId: rid('one@example.test'), outcome: 'retry', evidence: WHY }), { ok: true, status: 'queued', providerKeyWindow: 'open' })
    mode = 'never-arrives'
    await C.drainCampaign('c1')
    row = await rowFor(store, 'one@example.test')
    assert.deepEqual([row.status, row.keyGen, row.attempt, row.uncertainRetries], ['uncertain', 1, 2, 1])
    assert.equal(row.keyFirstUsedAtMs, first, 'a second uncertain outcome does not move the start')
    assert.ok(row.attemptedAtMs > first + 19 * H, 'although the latest attempt is 20 hours later')

    clock.skew = 30 * H                                                           // T0 + 30 h: the key was first used 30 hours ago
    const input = { recordId: rid('one@example.test'), outcome: 'retry', evidence: WHY }
    assert.deepEqual(await C.resolveUncertain('c1', input), { ok: false, error: 'provider_key_window_expired', providerKeyWindow: 'expired' })
    const viaRoute = await post({ action: 'resolve-uncertain', id: 'c1', ...input })
    assert.deepEqual([viaRoute.status, viaRoute.body.error], [409, 'provider_key_window_expired'])
    row = await rowFor(store, 'one@example.test')
    assert.deepEqual([row.status, (await campaign(store)).status, delivered], ['uncertain', 'sent', 1], 'refused: nothing changed and nothing was sent')

    // only with the risk explicitly accepted, and that is what the record of the decision says
    assert.deepEqual(await C.resolveUncertain('c1', { ...input, acceptDuplicateRisk: true }), { ok: true, status: 'queued', providerKeyWindow: 'expired' })
    const decisions = (await store.query(TRANSITIONS, { limit: 10 })).map((d) => d.data).sort((a, b) => a.attempt - b.attempt)
    assert.deepEqual(decisions.map((d) => [d.kind, d.attempt, d.outcome, d.providerKeyWindow, d.acceptDuplicateRisk, d.evidence]), [['resolve', 1, 'retry', 'open', false, WHY], ['resolve', 2, 'retry', 'expired', true, WHY]], 'each decision is kept, not overwritten by the next')
    mode = 'ok'
    await C.drainCampaign('c1')
    assert.deepEqual([(await rowFor(store, 'one@example.test')).status, new Set(keys()).size], ['sent', 1])
  })
})

test('IR-04 a new key starts a new window, and an uncertain outcome is never retried by anything automatic', async () => {
  await withClock(async (clock) => {
    const { store } = await seed([{ email: 'one@example.test' }])
    await C.enqueueCampaign('c1')
    let n = 0
    onSend = async () => { n++; if (n === 1) return refuse(429, 'Too many requests'); throw new Error('socket hang up') }
    await C.drainCampaign('c1')                                                   // definitely refused under key 1; no attempt under it was ever uncertain
    assert.deepEqual([(await rowFor(store, 'one@example.test')).status, (await rowFor(store, 'one@example.test')).keyFirstUsedAtMs], ['failed', undefined])
    clock.skew = 40 * H
    assert.deepEqual(await C.requeueFailedSends('c1'), { ok: true, requeued: 1 })
    await C.drainCampaign('c1')                                                   // uncertain under key 2, 40 hours later
    const row = await rowFor(store, 'one@example.test')
    assert.deepEqual([row.status, row.keyGen], ['uncertain', 2])
    assert.ok(row.keyFirstUsedAtMs > Date.now() - 60_000, 'the window belongs to the key in use, not to the one before it')
    assert.equal((await C.resolveUncertain('c1', { recordId: rid('one@example.test'), outcome: 'retry', evidence: WHY })).providerKeyWindow, 'open')
    await C.drainCampaign('c1')                                                   // the decided retry: uncertain again
    const settled = captured.length
    for (let i = 0; i < 3; i++) { await C.drainCampaign('c1'); await C.requeueFailedSends('c1') }
    process.env.WEEKLY_DIGEST_ENABLED = 'true'
    try { await C.processCampaignSends() } finally { delete process.env.WEEKLY_DIGEST_ENABLED }
    const after = await rowFor(store, 'one@example.test')
    assert.deepEqual([after.status, after.keyGen, captured.length], ['uncertain', 2, settled], 'no run, no requeue-failed and no daily job makes a request or issues a key')
    assert.equal((await store.query(TRANSITIONS, { limit: 20 })).filter((d) => d.data.kind === 'resolve').length, 1, 'the one retry that was decided is the one on record')
  })
})

// ════════════════════════════════════════════════════════════════════════════════
// FR-01 (second review) · a refused retry must never lead to a new provider key
// ════════════════════════════════════════════════════════════════════════════════
test('FR-01 a refused retry of an uncertain delivery returns to uncertain: requeue-failed gives it no new key, and only a recorded decision sends again', async () => {
  await withClock(async (clock) => {
    // The second reviewer's case, with a provider that behaves as documented: a key is remembered 24 hours from its first use.
    const { store } = await seed([{ email: 'one@example.test' }, { email: 'two@example.test' }])
    await C.enqueueCampaign('c1')
    const firstUse = new Map(); const delivered = []; let mode = 'accept-then-lose-answer'
    onSend = async (p, key) => {
      if (mode === 'quota') return refuse(429, 'Too many requests')
      const seen = firstUse.get(key)
      if (seen === undefined || Date.now() - seen >= 24 * H) { firstUse.set(key, Date.now()); delivered.push(p.to[0]) }
      if (mode === 'accept-then-lose-answer') throw new Error('socket hang up')
      return undefined
    }
    let r = await C.drainCampaign('c1')                                            // one: accepted, answer lost → the run stops
    assert.deepEqual([r.uncertain, r.stopped, delivered], [1, 'uncertain_outcome', ['one@example.test']])
    const first = (await rowFor(store, 'one@example.test')).keyFirstUsedAtMs

    clock.skew = 2 * H                                                             // inside the window, so no risk is asked about
    assert.deepEqual(await C.resolveUncertain('c1', { recordId: rid('one@example.test'), outcome: 'retry', evidence: WHY }), { ok: true, status: 'queued', providerKeyWindow: 'open' })
    mode = 'quota'
    r = await C.drainCampaign('c1')                                                // the retry is definitely refused
    let one = await rowFor(store, 'one@example.test')
    assert.deepEqual([one.status, one.uncertainReason, one.keyGen, one.attempt, one.keyFirstUsedAtMs], ['uncertain', 'refused_after_uncertain', 1, 2, first], 'not failed: the earlier attempt under this key may have been accepted')
    assert.deepEqual([r.failed, r.uncertain, r.stopped], [0, 1, 'uncertain_outcome'])
    r = await C.drainCampaign('c1')                                                // two: refused too, and it has no uncertain history
    assert.deepEqual([(await rowFor(store, 'two@example.test')).status, r.failed], ['failed', 1])

    // requeue-failed — the documented remedy for quota refusals — moves on the plain failure only
    assert.deepEqual(await C.requeueFailedSends('c1'), { ok: true, requeued: 1 })
    one = await rowFor(store, 'one@example.test')
    assert.deepEqual([one.status, one.keyGen, one.keyFirstUsedAtMs], ['uncertain', 1, first], 'no new key, and the record of the key\'s first use is intact')
    const two = await rowFor(store, 'two@example.test')
    assert.deepEqual([two.status, two.keyGen], ['queued', 2])

    clock.skew = 20 * H; mode = 'ok'
    const before = captured.length
    r = await C.drainCampaign('c1')
    process.env.WEEKLY_DIGEST_ENABLED = 'true'
    try { await C.processCampaignSends() } finally { delete process.env.WEEKLY_DIGEST_ENABLED }
    assert.deepEqual([r.sent, sentTo().slice(before)], [1, ['two@example.test']], 'only the other recipient is sent to')
    assert.deepEqual([(await campaign(store)).status, (await campaign(store)).stats.uncertain], ['sent', 1], 'and the totals still show one unresolved recipient')

    // the explicit, recorded decision: retry with the SAME key, which the provider recognises
    assert.equal((await C.resolveUncertain('c1', { recordId: rid('one@example.test'), outcome: 'retry', evidence: WHY })).ok, true)
    await C.drainCampaign('c1')
    assert.equal((await rowFor(store, 'one@example.test')).status, 'sent')
    assert.deepEqual([...delivered].sort(), ['one@example.test', 'two@example.test'], 'each person received exactly one copy')
    assert.deepEqual([...new Set(keys().filter((k) => k.startsWith(rowId('one@example.test'))))], [`${rowId('one@example.test')}/k1`], 'every request for the uncertain recipient carried the one key')
  })
})

test('FR-01 requeue-failed never gives a new key to a failed row whose present key was used in an uncertain attempt: it goes back to uncertain and is reported', async () => {
  const { store } = await seed([{ email: 'one@example.test' }, { email: 'two@example.test' }])
  await C.enqueueCampaign('c1')
  onSend = async () => refuse(429, 'Too many requests')
  await C.drainCampaign('c1')                                                     // both definitely refused
  // A state this code no longer produces but must still handle: failed, although the key's first use is on record.
  await store.update(CAMPAIGN_SENDS, rowId('one@example.test'), { keyFirstUsedAtMs: Date.now() - 2 * H })
  assert.deepEqual(await C.requeueFailedSends('c1'), { ok: true, requeued: 1, heldUncertain: 1 })
  const one = await rowFor(store, 'one@example.test'); const two = await rowFor(store, 'two@example.test')
  assert.deepEqual([one.status, one.uncertainReason, one.keyGen, one.attempt], ['uncertain', 'refused_after_uncertain', 1, 1])
  assert.deepEqual([two.status, two.keyGen, two.attempt], ['queued', 2, 2])
  assert.deepEqual((await campaign(store)).stats, { recipients: 2, notQueued: {}, sent: 0, failed: 0, skipped: 0, uncertain: 1 }, 'the totals say what the rows say')
  assert.equal((await store.query(TRANSITIONS, { limit: 10 })).filter((d) => d.data.sendId === rowId('one@example.test')).length, 0, 'no requeue was recorded for it')
  onSend = null
  await C.drainCampaign('c1'); await C.requeueFailedSends('c1'); await C.drainCampaign('c1')
  assert.deepEqual([timesSent('one@example.test'), timesSent('two@example.test')], [1, 2], 'the held recipient gets no further request')
  // it is not a dead end: the explicit decision still settles it
  assert.deepEqual(await C.resolveUncertain('c1', { recordId: rid('one@example.test'), outcome: 'sent', evidence: WHY }), { ok: true, status: 'sent' })
})

// ════════════════════════════════════════════════════════════════════════════════
// FR-02 (second review) · an exclusion that matches nobody must block the queue
// ════════════════════════════════════════════════════════════════════════════════
test('FR-02 an exclusion that matches no subscriber record blocks the queue and is named: nothing is built until the list is corrected', async () => {
  const ghost = 'nl_' + 'f'.repeat(32)                                            // for example the id of a mistyped address
  const { store, calls } = await seed([{ email: 'keep@example.test' }, { email: 'meant@example.test' }], { exclusions: [excl(ghost)] })
  const before = await everything(store)
  const pre = await C.previewRecipients('c1')
  assert.deepEqual([pre.recipients, pre.exclusions.map((e) => e.effect), pre.blockers, pre.binding], [2, ['no_matching_record'], [{ kind: 'exclusion_unmatched', recordId: ghost }], undefined], 'the preflight names it and offers no binding')
  calls.length = 0
  const res = await post({ action: 'send', id: 'c1', expect: bindingFrom(pre) })   // even with every value the preflight reported
  assert.deepEqual([res.status, res.body.ok, res.body.error, res.body.unmatched], [409, false, 'exclusion_unmatched', [ghost]])
  assert.equal(writes(calls).length, 0)
  assert.equal(await everything(store), before, 'no queue record and no row; the campaign is still approved')
  assert.equal(captured.length, 0)

  // corrected: the entry now names the person it was meant for
  assert.equal((await C.setCampaignExclusions('c1', [excl(rid('meant@example.test'))])).ok, true)
  const fixed = await C.previewRecipients('c1')
  assert.deepEqual([fixed.blockers, fixed.exclusions.map((e) => e.effect), fixed.recipients], [[], ['applied'], 1])
  const ok = await post({ action: 'send', id: 'c1', expect: fixed.binding })
  assert.deepEqual([ok.status, ok.body.ok, ok.body.recipients], [200, true, 1])
  await C.drainCampaign('c1')
  assert.deepEqual(sentTo(), ['keep@example.test'])
})

test('FR-02 only an entry that matches nobody blocks: one that matches a person already left out does not, and a half-built queue is not held up by a record deleted since', async () => {
  // matched, but that person is unsubscribed: reported as such, and nobody can be sent to by mistake
  await seed([{ email: 'keep@example.test' }, { email: 'gone@example.test', unsubscribed: true }], { exclusions: [excl(rid('gone@example.test'))] })
  let pre = await C.previewRecipients('c1')
  assert.deepEqual([pre.exclusions.map((e) => e.effect), pre.blockers, typeof pre.binding], [['unsubscribed'], [], 'object'])
  assert.equal((await C.enqueueCampaign('c1', undefined, pre.binding)).ok, true)

  // a queue cut off part-way; an excluded person's record is deleted before the queue is completed
  const emails = ['a@example.test', 'b@example.test', 'out@example.test']
  const ctx = await seed(emails.map((email) => ({ email })), { exclusions: [excl(rid('out@example.test'))] })
  let crash = true
  ctx.ctl.fault = (call) => { if (crash && call.op === 'create' && call.collection === CAMPAIGN_SENDS && call.id === rowId('b@example.test')) { crash = false; throw new Error('simulated store error') } }
  await assert.rejects(() => queueBound(), /simulated store error/)
  ctx.ctl.fault = null
  await ctx.store.delete(LIST, rid('out@example.test'))
  pre = await C.previewRecipients('c1')
  assert.deepEqual([pre.queued, pre.exclusions.map((e) => e.effect), pre.blockers], [true, ['no_matching_record'], []], 'reported, and not a blocker for this campaign\'s own half-built queue')
  const res = await post({ action: 'send', id: 'c1', expect: pre.binding })
  assert.deepEqual([res.status, res.body.ok, res.body.recipients, res.body.alreadyQueued], [200, true, 1, 1])
  await C.drainCampaign('c1')
  assert.deepEqual(sentTo().sort(), ['a@example.test', 'b@example.test'], 'the excluded address is still not sent to')
})

// ════════════════════════════════════════════════════════════════════════════════
// IR-05 · overlapping requeue-failed actions
// ════════════════════════════════════════════════════════════════════════════════
test('IR-05 two overlapping requeue-failed actions around a send run cannot turn a delivered row back into a queued one', async () => {
  // The reviewer's case: the slower action has read the failed rows; before it writes, the other
  // action completes and a run delivers the retried row.
  const { store, ctl } = await seed([{ email: 'one@example.test' }])
  await C.enqueueCampaign('c1')
  let n = 0
  onSend = async () => (++n === 1 ? refuse(429, 'Too many requests') : undefined)
  await C.drainCampaign('c1')
  assert.equal((await rowFor(store, 'one@example.test')).status, 'failed')

  let once = true
  ctl.after = async (call, args) => {
    if (!once || call.op !== 'query' || call.collection !== CAMPAIGN_SENDS || !args[1]?.where?.some((w) => w.value === 'failed')) return
    once = false
    assert.deepEqual(await C.requeueFailedSends('c1'), { ok: true, requeued: 1 })
    const d = await C.drainCampaign('c1')
    assert.deepEqual([d.sent, d.done], [1, true])
  }
  assert.deepEqual(await C.requeueFailedSends('c1'), { ok: true, requeued: 0 }, 'the slower action finds the row is no longer failed and leaves it')
  ctl.after = null

  const row = await rowFor(store, 'one@example.test')
  assert.deepEqual([row.status, row.attempt, row.keyGen], ['sent', 2, 2], 'the delivered row still reads as sent')
  assert.deepEqual([(await campaign(store)).status, (await campaign(store)).stats], ['sent', { recipients: 1, notQueued: {}, sent: 1, failed: 0, skipped: 0 }])
  assert.equal((await C.drainCampaign('c1')).error, 'not_sending (sent)')
  assert.equal(captured.length, 2, 'one refused request and one accepted request, and no more')
  assert.deepEqual((await store.query(TRANSITIONS, { limit: 10 })).map((d) => [d.id, d.data.kind]), [[`${rowId('one@example.test')}__a1__requeue`, 'requeue']], 'the one requeue that happened is on record')
})

test('IR-05 a failed attempt is moved on once however many requeue actions arrive together, and a stale list is never acted on', async () => {
  const emails = ['r1@example.test', 'r2@example.test']
  const { store } = await seed(emails.map((email) => ({ email })))
  await C.enqueueCampaign('c1')
  const refusedOnce = new Set()
  onSend = async (p) => { if (!refusedOnce.has(p.to[0])) { refusedOnce.add(p.to[0]); return refuse(429, 'Too many requests') } }
  await C.drainCampaign('c1')
  const results = await Promise.all([C.requeueFailedSends('c1'), C.requeueFailedSends('c1'), C.requeueFailedSends('c1')])
  assert.ok(results.every((r) => r.ok))
  const rows = await rowsOf(store)
  assert.deepEqual(rows.map((x) => [x.status, x.attempt, x.keyGen]), [['queued', 2, 2], ['queued', 2, 2]], 'each row moved exactly one attempt and one key on')
  assert.equal((await store.query(TRANSITIONS, { limit: 10 })).length, 2, 'one transition record per failed attempt')
  const d = await C.drainCampaign('c1')
  assert.deepEqual([d.sent, d.done], [2, true])
  for (const e of emails) assert.equal(timesSent(e), 2, `${e}: the refused request and the delivered one`)
  assert.deepEqual(await C.requeueFailedSends('c1'), { ok: true, requeued: 0 })
  assert.ok((await rowsOf(store)).every((x) => x.status === 'sent'))
})

test('IR-05 even when the other action and a send run finish between this action\'s check and its write, the delivered row is not requeued', async () => {
  const { store, ctl } = await seed([{ email: 'one@example.test' }])
  await C.enqueueCampaign('c1')
  let n = 0
  onSend = async () => (++n === 1 ? refuse(429, 'Too many requests') : undefined)
  await C.drainCampaign('c1')
  // This action has read the row again and found it still failed. Just before it records its transition,
  // another requeue action completes and a run delivers the row.
  let once = true
  ctl.before = async (call) => {
    if (!once || call.op !== 'create' || call.collection !== TRANSITIONS) return
    once = false
    assert.deepEqual(await C.requeueFailedSends('c1'), { ok: true, requeued: 1 })
    assert.deepEqual([(await C.drainCampaign('c1')).sent], [1])
  }
  assert.deepEqual(await C.requeueFailedSends('c1'), { ok: true, requeued: 0 }, 'it lost the transition record, looked again, and left the row alone')
  ctl.before = null
  const row = await rowFor(store, 'one@example.test')
  assert.deepEqual([row.status, row.attempt, row.keyGen, captured.length], ['sent', 2, 2, 2])
  const d = await C.drainCampaign('c1')
  assert.ok(d.error === 'not_sending (sent)' || (d.ok && d.sent === 0 && d.done), 'nothing is left to send')
  assert.equal(captured.length, 2)
})

// ════════════════════════════════════════════════════════════════════════════════
// IR-06 · an action cut off between its writes
// ════════════════════════════════════════════════════════════════════════════════
const uncertainOne = async () => {
  const ctx = await seed([{ email: 'one@example.test' }])
  await C.enqueueCampaign('c1')
  onSend = async () => { throw new Error('socket hang up') }
  await C.drainCampaign('c1')
  onSend = null
  assert.deepEqual([(await rowFor(ctx.store, 'one@example.test')).status, (await campaign(ctx.store)).status], ['uncertain', 'sent'])
  return ctx
}
const failOnce = (ctl, match) => { let once = true; ctl.fault = (call, args) => { if (once && match(call, args)) { once = false; throw new Error('simulated store error') } } }

test('IR-06 resolve "retry" cut off at any of its writes leaves no recipient out of reach: repeating the action finishes it', async () => {
  const input = { recordId: rid('one@example.test'), outcome: 'retry', evidence: WHY }

  // (a) the reviewer's case: the write to the campaign fails
  let { store, ctl } = await uncertainOne()
  failOnce(ctl, (call) => call.op === 'update' && call.collection === CAMPAIGNS)
  await assert.rejects(() => C.resolveUncertain('c1', input), /simulated store error/)
  assert.deepEqual([(await rowFor(store, 'one@example.test')).status, (await campaign(store)).status], ['uncertain', 'sent'], 'nothing was changed: the row is not left queued in a campaign marked sent')
  assert.deepEqual(await C.resolveUncertain('c1', input), { ok: true, status: 'queued', providerKeyWindow: 'open' })
  assert.deepEqual([(await C.drainCampaign('c1')).sent, (await rowFor(store, 'one@example.test')).status], [1, 'sent'])

  // (b) the campaign is reopened and the decision recorded, then the write to the row fails
  ;({ store, ctl } = await uncertainOne())
  failOnce(ctl, (call) => call.op === 'update' && call.collection === CAMPAIGN_SENDS)
  await assert.rejects(() => C.resolveUncertain('c1', input), /simulated store error/)
  assert.deepEqual([(await rowFor(store, 'one@example.test')).status, (await campaign(store)).status], ['uncertain', 'sending'], 'the campaign is open; the recipient has not been touched')
  const idle = await C.drainCampaign('c1')
  assert.deepEqual([idle.sent, idle.done, captured.length], [0, true, 1], 'a run finds nothing to send and closes the campaign again; the uncertain recipient is not resent')
  // a different decision for the same attempt is refused; the same one finishes what was begun
  const other = await post({ action: 'resolve-uncertain', id: 'c1', recordId: input.recordId, outcome: 'sent', evidence: WHY })
  assert.deepEqual([other.status, other.body.error], [409, 'already_resolved (retry)'])
  assert.deepEqual(await C.resolveUncertain('c1', input), { ok: true, status: 'queued', providerKeyWindow: 'open' })
  assert.deepEqual([(await rowFor(store, 'one@example.test')).attempt, (await campaign(store)).status], [2, 'sending'])
  assert.deepEqual([(await C.drainCampaign('c1')).sent, (await store.query(TRANSITIONS, { limit: 10 })).length], [1, 1])
  assert.deepEqual(keys(), [`${rowId('one@example.test')}/k1`, `${rowId('one@example.test')}/k1`])
})

test('IR-06 a "sent" decision cut off before the totals were written is finished by repeating it', async () => {
  const input = { recordId: rid('one@example.test'), outcome: 'sent', evidence: WHY }
  const { store, ctl } = await uncertainOne()
  failOnce(ctl, (call) => call.op === 'update' && call.collection === CAMPAIGNS)
  await assert.rejects(() => C.resolveUncertain('c1', input), /simulated store error/)
  assert.deepEqual([(await rowFor(store, 'one@example.test')).status, (await campaign(store)).stats.uncertain], ['sent', 1], 'the row is settled; the totals are one behind')
  assert.deepEqual(await C.resolveUncertain('c1', input), { ok: true, status: 'sent' })
  assert.deepEqual((await campaign(store)).stats, { recipients: 1, notQueued: {}, sent: 1, failed: 0, skipped: 0 })
  assert.equal((await C.resolveUncertain('c1', { ...input, outcome: 'retry' })).error, 'not_uncertain (sent)', 'and it cannot then be reopened as a retry')
  assert.equal(captured.length, 1)
})

test('IR-06 requeue-failed cut off part-way leaves the campaign open, and a waiting row found in a campaign marked sent is reopened', async () => {
  const emails = ['r1@example.test', 'r2@example.test']
  const { store, ctl } = await seed(emails.map((email) => ({ email })))
  await C.enqueueCampaign('c1')
  const refusedOnce = new Set()
  onSend = async (p) => { if (!refusedOnce.has(p.to[0])) { refusedOnce.add(p.to[0]); return refuse(429, 'Too many requests') } }
  await C.drainCampaign('c1')
  assert.equal((await campaign(store)).status, 'sent')

  // the write to the second row fails
  failOnce(ctl, (call, args) => call.op === 'update' && call.collection === CAMPAIGN_SENDS && call.id === rowId('r2@example.test') && args[2]?.status === 'queued')
  await assert.rejects(() => C.requeueFailedSends('c1'), /simulated store error/)
  assert.deepEqual([(await campaign(store)).status, (await rowsOf(store)).map((x) => x.status)], ['sending', ['queued', 'failed']], 'the campaign was reopened first, so the row already requeued is within reach')
  assert.deepEqual(await C.requeueFailedSends('c1'), { ok: true, requeued: 1 }, 'repeating it requeues the one that was left')
  const d = await C.drainCampaign('c1')
  assert.deepEqual([d.sent, d.done], [2, true])

  // a state left by a version that wrote in the other order: a queued row in a campaign marked sent
  const ctx = await seed([{ email: 'one@example.test' }])
  await C.enqueueCampaign('c1')
  await ctx.store.update(CAMPAIGNS, 'c1', { status: 'sent' })
  assert.equal((await C.drainCampaign('c1')).error, 'not_sending (sent)')
  assert.deepEqual(await C.requeueFailedSends('c1'), { ok: true, requeued: 0, reopened: true })
  assert.deepEqual([(await C.drainCampaign('c1')).sent, timesSent('one@example.test'), (await campaign(ctx.store)).status], [1, 1, 'sent'])
  // it reopens nothing when nothing is waiting, and never touches an uncertain row
  assert.deepEqual(await C.requeueFailedSends('c1'), { ok: true, requeued: 0 })
  const u = await uncertainOne()
  assert.deepEqual(await C.requeueFailedSends('c1'), { ok: true, requeued: 0 })
  assert.deepEqual([(await rowFor(u.store, 'one@example.test')).status, (await campaign(u.store)).status], ['uncertain', 'sent'])
})

// ════════════════════════════════════════════════════════════════════════════════
// IR-16 and IR-17
// ════════════════════════════════════════════════════════════════════════════════
test('IR-16 a row whose outcome was recorded after the run read the queue is not marked uncertain, however old its claim', async () => {
  const { store, ctl } = await seed([{ email: 'one@example.test' }])
  await C.enqueueCampaign('c1')
  // another run claimed this attempt long ago…
  await store.set(CLAIMS, `${rowId('one@example.test')}__a1`, { sendId: rowId('one@example.test'), campaignId: 'c1', attempt: 1, runId: 'another-run', claimedAtMs: Date.now() - 20 * 60_000 })
  // …and records its outcome just after this run has read the queued rows
  let once = true
  ctl.after = async (call, args) => {
    if (!once || call.op !== 'query' || call.collection !== CAMPAIGN_SENDS || !args[1]?.where?.some((w) => w.value === 'queued')) return
    once = false
    await store.update(CAMPAIGN_SENDS, rowId('one@example.test'), { status: 'sent', sentAt: new Date().toISOString() })
  }
  const r = await C.drainCampaign('c1')
  assert.deepEqual([r.processed, r.sent, r.uncertain, r.held, r.done], [0, 0, undefined, 1, true])
  assert.equal((await rowFor(store, 'one@example.test')).status, 'sent', 'the recorded outcome stands')
  assert.equal(captured.length, 0)
})

test('IR-17 the database adapter\'s update request is written as it is in production', () => {
  const src = readFileSync(B + 'lib/store/firestore-adapter.ts', 'utf8')
  assert.ok(src.includes("    const mask = Object.keys(patch).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')"))
  assert.ok(!src.includes('const mask =Object'))
})
