// eval/store-create-if-absent.test.mjs   (asq-newsletter-send-safety-v2)
//
// DocumentStore.create — "create only if absent; the first caller wins". The campaign send
// path's protection against sending twice rests on it, so both backends are checked here:
//   • MemoryStore, by behaviour;
//   • FirestoreStore, by the request it makes and how it reads each possible answer.
//
// The Firestore part runs against a STUBBED fetch. It shows that the adapter asks Firestore
// for a create (which Firestore refuses when the id is taken) and that it treats only a
// success as "created" and only an explicit ALREADY_EXISTS as "not created" — every other
// answer throws. It does NOT show how the live database behaves; that is what the admin
// `selfcheck` action is for, after deployment. No request leaves the machine.
//
// Run: node --test --import ./eval/hooks.mjs eval/store-create-if-absent.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

// Read by the Firestore adapter at load — set BEFORE importing. Obvious fakes. FIREBASE_API_KEY
// is left unset so getStore() would still choose the in-memory store.
process.env.FIREBASE_PROJECT_ID = 'demo-project-not-real'
process.env.FIREBASE_ACCESS_TOKEN = 'test-token-not-a-real-secret'
delete process.env.FIREBASE_API_KEY
delete process.env.FIREBASE_DATABASE_ID

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const imp = (p) => import(pathToFileURL(B + p).href)

let requests = []
let answer = () => new Response('{}', { status: 200 })
globalThis.fetch = async (url, init) => { requests.push({ url: String(url), method: init?.method || 'GET', headers: init?.headers || {}, body: init?.body ? JSON.parse(String(init.body)) : undefined }); return answer() }

const { MemoryStore } = await imp('lib/store/memory-store.ts')
const { FirestoreStore } = await imp('lib/store/firestore-adapter.ts')

test('memory store: create writes a new document and reports true', async () => {
  const store = new MemoryStore()
  assert.equal(await store.create('things', 'a', { n: 1 }), true)
  assert.deepEqual((await store.get('things', 'a')).data, { n: 1, id: 'a' })
})

test('memory store: create never overwrites — an existing document is left exactly as it was', async () => {
  const store = new MemoryStore()
  await store.set('things', 'a', { n: 1, status: 'sent' })
  assert.equal(await store.create('things', 'a', { n: 2, status: 'queued' }), false)
  assert.deepEqual((await store.get('things', 'a')).data, { n: 1, status: 'sent', id: 'a' })
  assert.equal(await store.create('things', 'b', { n: 3 }), true, 'other ids are unaffected')
  assert.equal(await store.create('other', 'a', { n: 4 }), true, 'and so are other collections')
})

test('memory store: of many callers creating the same id at once, exactly one wins', async () => {
  const store = new MemoryStore()
  const results = await Promise.all(Array.from({ length: 50 }, (_, i) => store.create('claims', 'same-id', { caller: i })))
  assert.equal(results.filter(Boolean).length, 1)
  const winner = results.indexOf(true)
  assert.equal((await store.get('claims', 'same-id')).data.caller, winner, 'and the document is the winner\'s')
  assert.equal((await store.query('claims', { limit: 100 })).length, 1)
})

test('firestore adapter: create is a createDocument request for that id, carrying the document', async () => {
  requests = []; answer = () => new Response(JSON.stringify({ name: 'x' }), { status: 200 })
  const ok = await new FirestoreStore().create('campaign_send_claims', 'cs_c1_nl_abc__a1', { sendId: 'cs_c1_nl_abc', attempt: 1, claimedAtMs: 1760000000000, fresh: true })
  assert.equal(ok, true)
  assert.equal(requests.length, 1)
  const r = requests[0]
  assert.equal(r.method, 'POST', 'a create, not the PATCH that set() and update() use to create-or-replace')
  assert.equal(r.url, 'https://firestore.googleapis.com/v1/projects/demo-project-not-real/databases/(default)/documents/campaign_send_claims?documentId=cs_c1_nl_abc__a1')
  assert.equal(r.headers.authorization, 'Bearer test-token-not-a-real-secret')
  assert.deepEqual(r.body, { fields: { sendId: { stringValue: 'cs_c1_nl_abc' }, attempt: { integerValue: '1' }, claimedAtMs: { integerValue: '1760000000000' }, fresh: { booleanValue: true }, id: { stringValue: 'cs_c1_nl_abc__a1' } } })
})

test('firestore adapter: the document id is escaped in the request', async () => {
  requests = []; answer = () => new Response('{}', { status: 200 })
  await new FirestoreStore().create('campaign_run_locks', 'weekly digest&x=1', { runId: 'r' })
  assert.ok(requests[0].url.endsWith('/campaign_run_locks?documentId=weekly%20digest%26x%3D1'))
})

test('firestore adapter: only an explicit ALREADY_EXISTS means "not created"', async () => {
  answer = () => new Response(JSON.stringify({ error: { code: 409, message: 'Document already exists: projects/demo/databases/(default)/documents/campaign_send_claims/x', status: 'ALREADY_EXISTS' } }), { status: 409 })
  assert.equal(await new FirestoreStore().create('campaign_send_claims', 'x', { a: 1 }), false)
})

test('firestore adapter: every other answer throws, so it can never be read as "created" or as "someone else has it"', async () => {
  const cases = [
    [409, { error: { code: 409, status: 'ABORTED', message: 'contention' } }],
    [400, { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'bad id' } }],
    [400, { error: { code: 400, status: 'FAILED_PRECONDITION', message: 'precondition' } }],
    [401, { error: { code: 401, status: 'UNAUTHENTICATED' } }],
    [403, { error: { code: 403, status: 'PERMISSION_DENIED' } }],
    [404, { error: { code: 404, status: 'NOT_FOUND' } }],
    [429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED' } }],
    [500, { error: { code: 500, status: 'INTERNAL' } }],
    [503, { error: { code: 503, status: 'UNAVAILABLE' } }],
  ]
  for (const [status, body] of cases) {
    answer = () => new Response(JSON.stringify(body), { status })
    await assert.rejects(() => new FirestoreStore().create('campaign_send_claims', 'x', { a: 1 }), new RegExp(`Firestore create ${status}`), `HTTP ${status} ${body.error.status}`)
  }
  answer = () => { throw new Error('network down') }
  await assert.rejects(() => new FirestoreStore().create('campaign_send_claims', 'x', { a: 1 }), /network down/)
})

test('firestore adapter: set() and update() are unchanged — still PATCH on the named document', async () => {
  requests = []; answer = () => new Response('{}', { status: 200 })
  const store = new FirestoreStore()
  await store.set('campaigns', 'c1', { status: 'draft' })
  await store.update('campaigns', 'c1', { status: 'approved' })
  assert.deepEqual(requests.map((r) => [r.method, r.url]), [
    ['PATCH', 'https://firestore.googleapis.com/v1/projects/demo-project-not-real/databases/(default)/documents/campaigns/c1'],
    ['PATCH', 'https://firestore.googleapis.com/v1/projects/demo-project-not-real/databases/(default)/documents/campaigns/c1?updateMask.fieldPaths=status'],
  ])
})
