// eval/newsletter-send-switch.test.mjs   (asq-campaign-send-switch-v1)
//
// Offline tests for the production send switch — no campaign recipient reaches the provider unless
// CAMPAIGN_SENDS_ENABLED is exactly 'true' on a production deployment (VERCEL_ENV === 'production') — on every
// path that sends a campaign: drainCampaign, the admin route's "drain" action and the daily job
// (processCampaignSends).
//
// The store is a MemoryStore behind a proxy that records every data call. The provider request is stubbed: no
// I/O; any other request is recorded as a violation. Nothing leaves the machine.
//
// Run: node --test --import ./eval/hooks.mjs eval/newsletter-send-switch.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

process.env.RESEND_API_KEY = 'test-key-not-a-real-secret'
process.env.ADMIN_API_TOKEN = 'test-token-not-a-real-secret'
delete process.env.CAMPAIGN_SENDS_ENABLED
delete process.env.VERCEL_ENV
delete process.env.WEEKLY_DIGEST_ENABLED

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const imp = (p) => import(pathToFileURL(B + p).href)

const RESEND_URL = 'https://api.resend.com/emails'
let captured = [], violations = []
globalThis.fetch = async (url, init) => {
  const u = String(url)
  if (u !== RESEND_URL || String(init?.method || 'GET').toUpperCase() !== 'POST') { violations.push(`${init?.method || 'GET'} ${u}`); return new Response('{}', { status: 500 }) }
  captured.push(JSON.parse(String(init?.body ?? '{}')))
  return new Response(JSON.stringify({ id: 'msg_test' }), { status: 200, headers: { 'content-type': 'application/json' } })
}

const { setStore } = await imp('lib/store/adapter.ts')
const { MemoryStore } = await imp('lib/store/memory-store.ts')
const C = await imp('lib/newsletter/campaigns.ts')
const { subscriberDocId } = await imp('lib/newsletter/subscribers.ts')
const { POST } = await imp('app/api/admin/campaigns/route.ts')
const { CAMPAIGNS, CAMPAIGN_SENDS } = C
const LIST = 'newsletter', EVENTS = 'email_events'
const WRITES = new Set(['set', 'create', 'update', 'delete', 'increment'])
const DATA_OPS = ['get', 'set', 'create', 'update', 'query', 'delete', 'increment']

function instrument(store) {
  const calls = [], ctl = { fault: null }
  const proxy = new Proxy(store, {
    get(t, prop) {
      const v = Reflect.get(t, prop)
      if (typeof v !== 'function' || !DATA_OPS.includes(String(prop))) return v
      return (...args) => { const call = { op: String(prop), collection: args[0] }; calls.push(call); if (ctl.fault) ctl.fault(call, args); return v.apply(t, args) }
    },
  })
  return { proxy, calls, ctl }
}
/** An approved campaign c1, queued for the given addresses; optional stored provider events per address. */
async function queued(emails, events = {}) {
  const store = new MemoryStore()
  await store.set(CAMPAIGNS, 'c1', { id: 'c1', brand: 'scamcheck', status: 'approved', subject: 'Subject', title: 'Headline', bodyHtml: '<p>Body</p>', createdAt: '2026-10-01T00:00:00.000Z', approvedAt: '2026-10-02T00:00:00.000Z' })
  for (const email of emails) await store.set(LIST, subscriberDocId(email), { email, source: 'test-seed' })
  for (const [email, list] of Object.entries(events)) for (const [type, daysAgo, extra] of list) await store.set(EVENTS, null, { type, email, ts: Date.now() - daysAgo * 86_400_000, ...(extra || {}) })
  setStore(store)
  const q = await C.enqueueCampaign('c1')
  assert.equal(q.ok, true, `sanity: the queue was built (${JSON.stringify(q)})`)
  const { proxy, calls, ctl } = instrument(store)
  setStore(proxy)
  captured = []; violations = []
  return { store, calls, ctl }
}
const on = () => { process.env.CAMPAIGN_SENDS_ENABLED = 'true'; process.env.VERCEL_ENV = 'production' }
const setEnv = (sw, env) => { if (sw === undefined) delete process.env.CAMPAIGN_SENDS_ENABLED; else process.env.CAMPAIGN_SENDS_ENABLED = sw; if (env === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = env }
const statuses = async (store) => (await store.query(CAMPAIGN_SENDS, { limit: 100 })).map((r) => r.data.status).sort()
const post = (body) => POST(new Request('https://lab.example.test/api/admin/campaigns', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer test-token-not-a-real-secret' }, body: JSON.stringify(body) }))

// ══ 1 · The switch itself ════════════════════════════════════════════════════
test('campaignSendsEnabled: on ONLY for CAMPAIGN_SENDS_ENABLED exactly "true" on a production deployment', () => {
  const cases = [
    [undefined, undefined, false], ['true', undefined, false], [undefined, 'production', false],
    ['true', 'preview', false], ['true', 'development', false], ['TRUE', 'production', false], ['1', 'production', false],
    ['yes', 'production', false], [' true', 'production', false], ['true', 'Production', false], ['true', 'production', true],
  ]
  for (const [sw, env, want] of cases) { setEnv(sw, env); assert.equal(C.campaignSendsEnabled(), want, `switch ${JSON.stringify(sw)}, VERCEL_ENV ${JSON.stringify(env)}`) }
  setEnv(undefined, undefined)
})

for (const [label, sw, env] of [['switch unset (the default)', undefined, undefined], ['switch on but a PREVIEW deployment', 'true', 'preview'], ['production but switch "TRUE"', 'TRUE', 'production']]) {
  test(`drainCampaign — ${label}: refused before anything is read, locked or claimed; nothing sent`, async () => {
    const { store, calls } = await queued(['a@example.test', 'b@example.test'])
    setEnv(sw, env); calls.length = 0
    const r = await C.drainCampaign('c1')
    assert.deepEqual([r.ok, r.error, r.sent, r.processed], [false, 'campaign_sends_disabled', 0, 0])
    assert.equal(captured.length, 0, 'no provider request'); assert.equal(violations.length, 0)
    assert.deepEqual(calls, [], 'not one store call: no read, no lock, no claim')
    assert.deepEqual(await statuses(store), ['queued', 'queued'])
    setEnv(undefined, undefined)
  })
}

test('admin route "drain" with the switch off: HTTP 423 campaign_sends_disabled, nothing sent', async () => {
  const { store } = await queued(['a@example.test'])
  setEnv(undefined, undefined)
  const res = await post({ action: 'drain', id: 'c1', batch: 20 })
  assert.equal(res.status, 423)
  const j = await res.json(); assert.deepEqual([j.ok, j.error], [false, 'campaign_sends_disabled'])
  assert.equal(captured.length, 0); assert.deepEqual(await statuses(store), ['queued'])
})

test('admin route "drain" on a preview deployment with the switch set: still HTTP 423', async () => {
  await queued(['a@example.test'])
  setEnv('true', 'preview')
  const res = await post({ action: 'drain', id: 'c1' })
  assert.equal(res.status, 423); assert.equal(captured.length, 0)
  setEnv(undefined, undefined)
})

test('daily job (processCampaignSends) with WEEKLY_DIGEST_ENABLED on but the switch off: nothing read or sent', async () => {
  const { store, calls } = await queued(['a@example.test', 'b@example.test'])
  process.env.WEEKLY_DIGEST_ENABLED = 'true'; setEnv(undefined, undefined); calls.length = 0
  const r = await C.processCampaignSends()
  assert.equal(r.sendsDisabled, true); assert.equal(r.sent, 0); assert.equal(r.processed, 0)
  assert.deepEqual(calls, []); assert.equal(captured.length, 0)
  assert.deepEqual(await statuses(store), ['queued', 'queued'])
  delete process.env.WEEKLY_DIGEST_ENABLED
})

test('daily job on a preview deployment with both settings on: nothing sent', async () => {
  await queued(['a@example.test'])
  process.env.WEEKLY_DIGEST_ENABLED = 'true'; setEnv('true', 'preview')
  const r = await C.processCampaignSends()
  assert.equal(r.sent, 0); assert.equal(captured.length, 0)
  delete process.env.WEEKLY_DIGEST_ENABLED; setEnv(undefined, undefined)
})

test('positive control: switch on in production — drainCampaign sends as before', async () => {
  const { store } = await queued(['a@example.test', 'b@example.test'])
  on()
  const r = await C.drainCampaign('c1')
  assert.deepEqual([r.ok, r.sent, r.skipped, r.failed], [true, 2, 0, 0])
  assert.equal(captured.length, 2); assert.deepEqual(await statuses(store), ['sent', 'sent'])
  setEnv(undefined, undefined)
})

test('the single-recipient preview (test-send) is not a campaign send and is not affected by the switch', async () => {
  await queued([])
  process.env.NEWSLETTER_TEST_RECIPIENTS = 'preview-inbox@example.test'; setEnv(undefined, undefined)
  const r = await C.sendCampaignTest('c1', 'preview-inbox@example.test')
  assert.equal(r.ok, true); assert.equal(captured.length, 1); assert.equal(captured[0].to[0], 'preview-inbox@example.test')
  delete process.env.NEWSLETTER_TEST_RECIPIENTS
})
