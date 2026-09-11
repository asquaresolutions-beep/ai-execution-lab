// eval/newsletter-test-send.test.mjs
//
// Offline tests for (1) the single-recipient TEST send and (2) campaign CANCELLATION.
//
// The store is wrapped in a proxy that records every get/set/update/query/delete/
// increment call, so "test mode never reads the subscriber list" is asserted from
// OBSERVED access, not inferred from reading the code. The Resend fetch is stubbed:
// it performs no I/O, and a request to any other host is recorded as a violation
// (throwing would be swallowed by send()'s try/catch). Nothing leaves the machine.
//
// Run: node --test --import ./eval/hooks.mjs eval/newsletter-test-send.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// The modules under test capture these at load — set BEFORE importing. Obvious fakes.
process.env.RESEND_API_KEY = 'test-key-not-a-real-secret'
process.env.ADMIN_API_TOKEN = 'test-token-not-a-real-secret'
delete process.env.WEEKLY_DIGEST_ENABLED
process.env.NEWSLETTER_TEST_RECIPIENTS = 'Verify@Example.Test, second-inbox@example.test'

// Repo root, derived from this file's location.
const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const imp = (p) => import(pathToFileURL(B + p).href)

const RESEND_URL = 'https://api.resend.com/emails'
let captured = []
let violations = []
globalThis.fetch = async (url, init) => {
  const u = String(url)
  if (u !== RESEND_URL) { violations.push(u); return new Response('{}', { status: 500 }) }
  captured.push(JSON.parse(String(init?.body ?? '{}')))
  return new Response(JSON.stringify({ id: 'msg_test' }), { status: 200, headers: { 'content-type': 'application/json' } })
}

const { setStore } = await imp('lib/store/adapter.ts')
const { MemoryStore } = await imp('lib/store/memory-store.ts')
const C = await imp('lib/newsletter/campaigns.ts')
const { CAMPAIGNS, CAMPAIGN_SENDS } = C
const { POST } = await imp('app/api/admin/campaigns/route.ts')

const SUBSCRIBER_COLLECTIONS = ['newsletter', 'lab_subscribers', 'subscribers']
const DATA_OPS = ['get', 'set', 'update', 'query', 'delete', 'increment']
const WRITES = new Set(['set', 'update', 'delete', 'increment'])

/** Wrap a store so every data call is recorded as { op, collection, id }. */
function recording(store) {
  const calls = []
  const proxy = new Proxy(store, {
    get(target, prop) {
      const v = Reflect.get(target, prop)
      if (typeof v !== 'function' || !DATA_OPS.includes(String(prop))) return v
      return (...args) => {
        calls.push({ op: String(prop), collection: args[0], id: typeof args[1] === 'string' ? args[1] : undefined })
        return v.apply(target, args)
      }
    },
  })
  return { proxy, calls }
}

/** Fresh store: one campaign in `status`, two real-looking subscribers, and an unrelated queued row. */
async function seed(status = 'approved') {
  const store = new MemoryStore()
  await store.set(CAMPAIGNS, 'c-test', {
    id: 'c-test', brand: 'scamcheck', status, subject: 'Real subject', title: 'Title', bodyHtml: '<p>Body</p>',
    createdAt: '2026-09-01T00:00:00.000Z', ...(status === 'draft' ? {} : { approvedAt: '2026-09-02T00:00:00.000Z' }),
  })
  await store.set('newsletter', 'nl_one', { email: 'one@example.test', unsubscribed: false })
  await store.set('newsletter', 'nl_two', { email: 'two@example.test', unsubscribed: false })
  await store.set(CAMPAIGN_SENDS, 'cs_unrelated', { id: 'cs_unrelated', campaignId: 'unrelated', email: 'x@example.test', status: 'queued' })
  const { proxy, calls } = recording(store)
  setStore(proxy)
  captured = []; violations = []
  return { store, calls }
}

/** Serialise every collection a send could touch — read through the RAW store, so it is not recorded. */
async function snapshot(store) {
  const out = {}
  for (const c of [CAMPAIGNS, CAMPAIGN_SENDS, ...SUBSCRIBER_COLLECTIONS]) out[c] = await store.query(c, { limit: 1000 })
  return JSON.stringify(out)
}

const post = (body, auth = true) => POST(new Request('https://lab.example.test/api/admin/campaigns', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(auth ? { authorization: 'Bearer test-token-not-a-real-secret' } : {}) },
  body: JSON.stringify(body),
}))

// ── 1 · Test send: the happy path ───────────────────────────────────────────
test('an allowlisted recipient gets exactly one [TEST] email, rendered like real list mail', async () => {
  await seed('approved')
  const r = await C.sendCampaignTest('c-test', 'verify@example.test')
  assert.deepEqual(r, { ok: true })
  assert.equal(violations.length, 0)
  assert.equal(captured.length, 1, 'exactly one provider request')
  const body = captured[0]
  assert.deepEqual(body.to, ['verify@example.test'])
  assert.equal(body.subject, '[TEST] Real subject')
  assert.ok(!('tags' in body), 'a test send must never carry campaign attribution')
  assert.match(body.headers['List-Unsubscribe'], /^<https:\/\/[^>]+\/api\/newsletter\/unsubscribe\?id=nl_[0-9a-f]{32}>/)
  assert.equal(body.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
  assert.ok(body.reply_to, 'the preview must carry the real Reply-To')
  assert.match(body.html, /<p>Body<\/p>/)
})

test('allowlist matching is case-insensitive and the address is normalised before sending', async () => {
  await seed('approved')
  const r = await C.sendCampaignTest('c-test', '  VERIFY@example.TEST ')
  assert.equal(r.ok, true)
  assert.deepEqual(captured[0].to, ['verify@example.test'])
})

// ── 2 · Test send: isolation, observed rather than inferred ─────────────────
test('test mode reads ONLY the named campaign — no subscriber list, no queue, no writes', async () => {
  const { calls } = await seed('approved')
  await C.sendCampaignTest('c-test', 'verify@example.test')
  assert.deepEqual(calls, [{ op: 'get', collection: CAMPAIGNS, id: 'c-test' }])
})

test('campaign state, queue and subscribers are byte-identical after a test send — in every status', async () => {
  for (const status of ['draft', 'approved', 'sending', 'sent', 'canceled']) {
    const { store, calls } = await seed(status)
    const before = await snapshot(store)
    const r = await C.sendCampaignTest('c-test', 'verify@example.test')
    assert.equal(r.ok, true, `a ${status} campaign can be previewed`)
    assert.equal(await snapshot(store), before, `${status}: nothing may change`)
    assert.equal(calls.filter((c) => WRITES.has(c.op)).length, 0, `${status}: no store writes`)
    assert.equal(calls.filter((c) => SUBSCRIBER_COLLECTIONS.includes(c.collection) || c.collection === CAMPAIGN_SENDS).length, 0,
      `${status}: subscriber collections and the queue must never be touched`)
  }
})

// ── 3 · Test send: rejections happen BEFORE the store is touched ────────────
test('bad recipients are rejected with no provider request and no store access at all', async () => {
  const cases = [
    [undefined, 'recipient_required'],
    [null, 'recipient_required'],
    ['', 'recipient_required'],
    ['   ', 'recipient_required'],
    [['verify@example.test'], 'recipient_required'],
    [['verify@example.test', 'second-inbox@example.test'], 'recipient_required'],
    [{ email: 'verify@example.test' }, 'recipient_required'],
    ['verify@example.test,second-inbox@example.test', 'single_recipient_only'],
    ['verify@example.test;second-inbox@example.test', 'single_recipient_only'],
    ['verify@example.test second-inbox@example.test', 'single_recipient_only'],
    ['not-an-email', 'invalid_recipient'],
    ['verify@example', 'invalid_recipient'],
    ['one@example.test', 'recipient_not_allowlisted'],       // a REAL subscriber — still refused
    ['someone-else@example.test', 'recipient_not_allowlisted'],
  ]
  for (const [to, error] of cases) {
    const { calls } = await seed('approved')
    const r = await C.sendCampaignTest('c-test', to)
    assert.deepEqual(r, { ok: false, error }, `to=${JSON.stringify(to)}`)
    assert.equal(captured.length, 0, `to=${JSON.stringify(to)} must not send`)
    assert.equal(calls.length, 0, `to=${JSON.stringify(to)} must not touch the store`)
  }
})

test('with no allowlist configured, every test send is refused', async () => {
  const saved = process.env.NEWSLETTER_TEST_RECIPIENTS
  try {
    for (const v of [undefined, '', ' , ']) {
      if (v === undefined) delete process.env.NEWSLETTER_TEST_RECIPIENTS
      else process.env.NEWSLETTER_TEST_RECIPIENTS = v
      const { calls } = await seed('approved')
      assert.deepEqual(await C.sendCampaignTest('c-test', 'verify@example.test'), { ok: false, error: 'test_recipients_not_configured' })
      assert.equal(captured.length, 0)
      assert.equal(calls.length, 0)
    }
  } finally {
    process.env.NEWSLETTER_TEST_RECIPIENTS = saved
  }
})

test('an unknown campaign sends nothing', async () => {
  await seed('approved')
  assert.deepEqual(await C.sendCampaignTest('does-not-exist', 'verify@example.test'), { ok: false, error: 'not_found' })
  assert.equal(captured.length, 0)
})

// ── 4 · Test send through the admin route ───────────────────────────────────
test('route: test-send needs auth, an id and one recipient — and never falls through to enqueue', async () => {
  const { store, calls } = await seed('approved')
  const before = await snapshot(store)
  assert.equal((await post({ action: 'test-send', id: 'c-test', to: 'verify@example.test' }, false)).status, 401)
  assert.equal((await post({ action: 'test-send', to: 'verify@example.test' })).status, 400)
  const noTo = await post({ action: 'test-send', id: 'c-test' })
  assert.equal(noTo.status, 400)
  assert.deepEqual(await noTo.json(), { ok: false, error: 'recipient_required' })
  const many = await post({ action: 'test-send', id: 'c-test', to: ['verify@example.test', 'second-inbox@example.test'] })
  assert.equal(many.status, 400)
  const outsider = await post({ action: 'test-send', id: 'c-test', to: 'one@example.test' })
  assert.equal(outsider.status, 400)
  assert.equal(captured.length, 0)
  assert.equal(calls.length, 0)
  assert.equal(await snapshot(store), before, 'the approved campaign must not have been enqueued')
})

test('route: a valid test-send returns 200 and the approved campaign stays un-enqueued', async () => {
  const { store } = await seed('approved')
  const before = await snapshot(store)
  const res = await post({ action: 'test-send', id: 'c-test', to: 'verify@example.test' })
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true })
  assert.equal(captured.length, 1)
  assert.equal(await snapshot(store), before)
})

// ── 5 · Structural guard ────────────────────────────────────────────────────
test('static: sendCampaignTest has no path to the subscriber list, the queue, attribution or a write', () => {
  const src = readFileSync(B + 'lib/newsletter/campaigns.ts', 'utf8')
  const start = src.indexOf('export async function sendCampaignTest(')
  assert.ok(start > 0, 'sendCampaignTest must exist')
  const body = src.slice(start, src.indexOf('\n}\n', start))
  for (const forbidden of [/BRAND_LIST/, /CAMPAIGN_SENDS/, /enqueueCampaign/, /drainCampaign/, /\.query\(/, /\.set\(/, /\.update\(/, /\.delete\(/, /campaignId/]) {
    assert.ok(!forbidden.test(body), `sendCampaignTest must not reference ${forbidden}`)
  }
})

// ── 6 · Cancellation ────────────────────────────────────────────────────────
test('cancel: an approved campaign becomes canceled, keeps its content, and nothing is queued or sent', async () => {
  const { store, calls } = await seed('approved')
  assert.deepEqual(await C.cancelCampaign('c-test'), { ok: true, status: 'canceled' })
  const doc = (await store.get(CAMPAIGNS, 'c-test')).data
  assert.equal(doc.status, 'canceled')
  assert.ok(!Number.isNaN(Date.parse(doc.canceledAt)), 'canceledAt must be an ISO timestamp')
  assert.equal(doc.canceledBy, 'admin')
  assert.equal(doc.subject, 'Real subject')
  assert.equal(doc.bodyHtml, '<p>Body</p>')
  assert.equal(doc.approvedAt, '2026-09-02T00:00:00.000Z', 'approval history is preserved')
  assert.equal(captured.length, 0)
  assert.equal(calls.filter((c) => SUBSCRIBER_COLLECTIONS.includes(c.collection)).length, 0, 'subscriber collections are never touched')
  assert.deepEqual(calls.filter((c) => c.collection === CAMPAIGN_SENDS).map((c) => c.op), ['query'], 'the queue is only READ (failed-row check)')
  assert.deepEqual(calls.filter((c) => WRITES.has(c.op)).map((c) => [c.op, c.collection, c.id]), [['update', CAMPAIGNS, 'c-test']],
    'the only write is the status update on that one campaign')
})

test('cancel: refuses a campaign that still owns FAILED rows — requeue could otherwise resurrect it', async () => {
  const { store } = await seed('approved')
  await store.set(CAMPAIGN_SENDS, 'cs_c-test_f', { id: 'cs_c-test_f', campaignId: 'c-test', email: 'one@example.test', status: 'failed' })
  const before = await snapshot(store)
  assert.deepEqual(await C.cancelCampaign('c-test'), { ok: false, error: 'has_failed_sends' })
  assert.equal(await snapshot(store), before, 'a refused cancel changes nothing')
})

test('cancel: a draft can be canceled', async () => {
  const { store } = await seed('draft')
  assert.equal((await C.cancelCampaign('c-test')).ok, true)
  assert.equal((await store.get(CAMPAIGNS, 'c-test')).data.status, 'canceled')
})

test('cancel: refuses a SENT campaign — delivery history is never rewritten', async () => {
  const { store } = await seed('sent')
  const before = await snapshot(store)
  assert.deepEqual(await C.cancelCampaign('c-test'), { ok: false, error: 'already_sent' })
  assert.equal(await snapshot(store), before)
})

test('cancel: refuses an in-flight SENDING campaign', async () => {
  const { store } = await seed('sending')
  const before = await snapshot(store)
  assert.deepEqual(await C.cancelCampaign('c-test'), { ok: false, error: 'in_flight (sending)' })
  assert.equal(await snapshot(store), before)
})

test('cancel: idempotent — a repeat is a no-op that keeps the original canceledAt and canceledBy', async () => {
  const { store } = await seed('approved')
  await C.cancelCampaign('c-test')
  const first = (await store.get(CAMPAIGNS, 'c-test')).data
  assert.deepEqual(await C.cancelCampaign('c-test', 'someone-else'), { ok: true, status: 'canceled', alreadyCanceled: true })
  const again = (await store.get(CAMPAIGNS, 'c-test')).data
  assert.equal(again.canceledAt, first.canceledAt)
  assert.equal(again.canceledBy, 'admin')
})

test('cancel: an unknown campaign', async () => {
  await seed('approved')
  assert.deepEqual(await C.cancelCampaign('nope'), { ok: false, error: 'not_found' })
})

test('after cancel no send path remains: approve, enqueue, drain, requeue and the cron all leave it canceled', async () => {
  const { store } = await seed('approved')
  await C.cancelCampaign('c-test')
  // Even a stray queued row for this campaign must never be sent.
  await store.set(CAMPAIGN_SENDS, 'cs_c-test_stray', { id: 'cs_c-test_stray', campaignId: 'c-test', email: 'one@example.test', status: 'queued' })
  assert.equal((await C.approveCampaign('c-test')).ok, false)
  assert.equal((await C.enqueueCampaign('c-test')).ok, false)
  assert.equal((await C.drainCampaign('c-test')).ok, false)
  assert.equal((await C.requeueFailedSends('c-test')).requeued, 0)
  process.env.WEEKLY_DIGEST_ENABLED = 'true'
  try {
    assert.equal((await C.processCampaignSends()).sent, 0)
  } finally {
    delete process.env.WEEKLY_DIGEST_ENABLED
  }
  assert.equal((await store.get(CAMPAIGNS, 'c-test')).data.status, 'canceled')
  assert.equal((await store.get(CAMPAIGN_SENDS, 'cs_c-test_stray')).data.status, 'queued')
  assert.equal(captured.length, 0)
})

test('route: cancel needs auth and an id, and cancels only the named campaign', async () => {
  const { store } = await seed('approved')
  await store.set(CAMPAIGNS, 'c-other', { id: 'c-other', brand: 'scamcheck', status: 'approved', subject: 'o', title: 'o', bodyHtml: '<p>o</p>', createdAt: '2026-09-01T00:00:00.000Z' })
  assert.equal((await post({ action: 'cancel', id: 'c-test' }, false)).status, 401)
  assert.equal((await post({ action: 'cancel' })).status, 400)
  const res = await post({ action: 'cancel', id: 'c-test' })
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true, status: 'canceled' })
  assert.equal((await store.get(CAMPAIGNS, 'c-test')).data.status, 'canceled')
  assert.equal((await store.get(CAMPAIGNS, 'c-other')).data.status, 'approved')
  assert.equal(captured.length, 0)
})

test('route: existing behaviour is unchanged — an unknown action is still rejected', async () => {
  await seed('approved')
  const res = await post({ action: 'definitely-not-an-action', id: 'c-test' })
  assert.equal(res.status, 400)
  assert.deepEqual(await res.json(), { ok: false, error: 'bad_action' })
})
