// eval/webhook-event-storage.test.mjs   (asq-webhook-store-v1)
//
// POST /api/webhooks/resend must not acknowledge an event it failed to store: the provider retries a non-2xx
// answer, so the event arrives again instead of being lost. Offline: MemoryStore, no network.
//
// Run: node --test --import ./eval/hooks.mjs eval/webhook-event-storage.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const SECRET_BYTES = Buffer.from('test-webhook-secret-not-a-real-one')
process.env.RESEND_WEBHOOK_SECRET = 'whsec_' + SECRET_BYTES.toString('base64')

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const imp = (p) => import(pathToFileURL(B + p).href)

const realFetch = globalThis.fetch
globalThis.fetch = (...a) => { throw new Error('NETWORK ATTEMPTED: ' + String(a[0]).slice(0, 80)) }
process.on('exit', () => { globalThis.fetch = realFetch })

const { setStore } = await imp('lib/store/adapter.ts')
const { MemoryStore } = await imp('lib/store/memory-store.ts')
const { EMAIL_EVENTS, recordEmailEvent } = await imp('lib/email/events.ts')
const { POST } = await imp('app/api/webhooks/resend/route.ts')

/** A request signed the way the provider signs it (Svix: HMAC-SHA256 over `${id}.${timestamp}.${body}`). */
function signed(payload, { tamper = false } = {}) {
  const body = JSON.stringify(payload), id = 'msg_test_1', ts = '1794600000'
  const sig = createHmac('sha256', SECRET_BYTES).update(`${id}.${ts}.${body}`).digest('base64')
  return new Request('https://app.example.test/api/webhooks/resend', {
    method: 'POST', body: tamper ? body + ' ' : body,
    headers: { 'content-type': 'application/json', 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': `v1,${sig}` },
  })
}
const delivered = { type: 'email.delivered', created_at: '2026-11-14T07:00:05.000Z', data: { to: ['reader@example.test'], email_id: 'm1', tags: { welcomeKey: 'welcome-nl_x-step1' } } }

/** A store whose event writes fail, and which records every other write (the error report). */
function failingStore() {
  const real = new MemoryStore()
  const store = Object.create(real)
  store.set = async (collection, id, data) => { if (collection === EMAIL_EVENTS) throw new Error('store down'); return real.set(collection, id, data) }
  return { real, store }
}

test('a stored event is acknowledged with 200 and carries the welcome key', async () => {
  const store = new MemoryStore(); setStore(store)
  const res = await POST(signed(delivered))
  assert.equal(res.status, 200); assert.deepEqual(await res.json(), { ok: true, type: 'delivered' })
  const rows = await store.query(EMAIL_EVENTS, {})
  assert.equal(rows.length, 1); assert.equal(rows[0].data.welcomeKey, 'welcome-nl_x-step1'); assert.equal(rows[0].data.email, 'reader@example.test')
})

test('an event that could not be stored is NOT acknowledged: 503, so the provider retries', async () => {
  const { real, store } = failingStore(); setStore(store)
  const res = await POST(signed(delivered))
  assert.equal(res.status, 503); assert.deepEqual(await res.json(), { error: 'event_not_stored' })
  assert.equal((await real.query(EMAIL_EVENTS, {})).length, 0)
})

test('the retry, once the store is back, stores the event exactly once', async () => {
  const { store } = failingStore(); setStore(store)
  assert.equal((await POST(signed(delivered))).status, 503)
  const healthy = new MemoryStore(); setStore(healthy)
  assert.equal((await POST(signed(delivered))).status, 200)
  assert.equal((await healthy.query(EMAIL_EVENTS, {})).length, 1)
})

test('a store that is down for everything (the error report fails too) still answers 503, never 200 and never a crash', async () => {
  const dead = new MemoryStore()
  for (const op of ['set', 'create', 'update', 'increment']) dead[op] = async () => { throw new Error('store down') }
  setStore(dead)
  const res = await POST(signed(delivered))
  assert.equal(res.status, 503)
})

test('unchanged: a bad signature is 401, an unsupported event type is acknowledged and stored nowhere', async () => {
  const store = new MemoryStore(); setStore(store)
  assert.equal((await POST(signed(delivered, { tamper: true }))).status, 401)
  const res = await POST(signed({ type: 'email.scheduled', created_at: '2026-11-14T07:00:05.000Z', data: { to: ['reader@example.test'] } }))
  assert.equal(res.status, 200); assert.deepEqual(await res.json(), { ok: true, ignored: true })
  assert.equal((await store.query(EMAIL_EVENTS, {})).length, 0)
})

test('recordEmailEvent stays best-effort for its other caller (the unsubscribe link): a failed write returns "" and does not throw', async () => {
  const { store } = failingStore(); setStore(store)
  assert.equal(await recordEmailEvent({ type: 'unsubscribed', email: 'reader@example.test', ts: 1 }), '')
})
