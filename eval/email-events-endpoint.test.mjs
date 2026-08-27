// eval/email-events-endpoint.test.mjs
//
// Tests for GET /api/admin/email-events — aggregate email telemetry, no PII.
// Offline: MemoryStore, network trip-wire armed, nothing sent or written.
//
// Run: node --test --import ./eval/hooks.mjs eval/email-events-endpoint.test.mjs
//
// The three states this endpoint exists to separate:
//   unavailable      — the store threw; nothing is known
//   no_events        — the query succeeded and found nothing in scope
//   events_available — rows exist
// Collapsing "broken" into "zero" is the specific failure this suite guards.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

// requireAdmin captures ADMIN_API_TOKEN at module load — set it BEFORE importing.
process.env.ADMIN_API_TOKEN = 'test-token-not-a-real-secret'

const B = 'C:/Users/Acer/Desktop/ai-execution-lab/'
const imp = (p) => import(pathToFileURL(B + p).href)

const realFetch = globalThis.fetch
globalThis.fetch = (...a) => { throw new Error('NETWORK ATTEMPTED: ' + String(a[0]).slice(0, 80)) }
process.on('exit', () => { globalThis.fetch = realFetch })

const { setStore } = await imp('lib/store/adapter.ts')
const { MemoryStore } = await imp('lib/store/memory-store.ts')
const { EMAIL_EVENTS } = await imp('lib/email/events.ts')
const { GET } = await imp('app/api/admin/email-events/route.ts')

const T0 = Date.parse('2026-08-27T04:00:00.000Z')

async function seed(events) {
  const store = new MemoryStore()
  setStore(store)
  let i = 0
  for (const e of events) {
    await store.set(EMAIL_EVENTS, `ev_${String(i).padStart(4, '0')}`, {
      type: e.type, email: e.email ?? `r${i}@example.test`,
      ...(e.campaignId ? { campaignId: e.campaignId } : {}),
      ts: e.ts ?? T0 + i * 1000,
    })
    i++
  }
  return store
}
async function query(qs = '') {
  const res = await GET(new Request('https://lab.asquaresolution.com/api/admin/email-events' + qs, {
    headers: { authorization: 'Bearer test-token-not-a-real-secret' },
  }))
  assert.equal(res.status, 200)
  return res.json()
}

const n = (count, type, extra = {}) => Array.from({ length: count }, () => ({ type, ...extra }))

// ── Auth ────────────────────────────────────────────────────────────────────
test('unauthenticated requests are rejected', async () => {
  const res = await GET(new Request('https://x/api/admin/email-events'))
  assert.equal(res.status, 401)
  assert.equal((await res.json()).error, 'unauthorized')
})

// ── The three states ────────────────────────────────────────────────────────
test('an empty collection reports no_events — NOT unavailable', async () => {
  await seed([])
  const r = await query()
  assert.equal(r.status, 'no_events')
  assert.equal(r.summary.total, 0)
  assert.equal(r.distinctRecipients, 0)
  assert.equal(r.firstEventAt, null)
  assert.match(r.attribution.note, /No events stored/)
})

test('a store failure reports unavailable — and never looks like zero', async () => {
  setStore({
    name: 'exploding',
    query: async () => { throw new Error('FAILED_PRECONDITION: index required') },
    get: async () => null, set: async () => '', update: async () => {}, delete: async () => {}, increment: async () => 0,
  })
  const r = await query()
  assert.equal(r.status, 'unavailable')
  assert.match(r.reason, /FAILED_PRECONDITION/)
  // The distinction that matters: an operator must not read this as "0 delivered".
  assert.ok(!('summary' in r), 'unavailable must not carry a summary that could be mistaken for real zeroes')
})

test('rows present reports events_available with real counts', async () => {
  await seed([...n(50, 'sent'), ...n(47, 'delivered'), ...n(12, 'opened'), ...n(3, 'clicked'), ...n(2, 'bounced')])
  const r = await query()
  assert.equal(r.status, 'events_available')
  assert.equal(r.summary.total, 114)
  assert.equal(r.summary.byType.delivered, 47)
  assert.equal(r.summary.deliveryRate, 94)
  assert.equal(r.summary.openRate, 25.5)
  assert.equal(r.window.scanned, 114)
  assert.equal(r.window.truncated, false)
})

// ── Attribution: historical vs tagged ───────────────────────────────────────
test('untagged events are reported as historical, not as a broken webhook', async () => {
  await seed([...n(30, 'sent'), ...n(28, 'delivered')])          // no campaignId anywhere
  const r = await query()
  assert.equal(r.attribution.totalEventsStored, 58)
  assert.equal(r.attribution.taggedWithCampaignId, 0)
  assert.equal(r.attribution.untagged, 58)
  assert.equal(r.attribution.taggingActive, false)
  assert.match(r.attribution.note, /predate campaign tagging/)
  assert.deepEqual(r.attribution.campaigns, {})
})

test('tagged events mark tagging active and are broken out per campaign', async () => {
  await seed([
    ...n(10, 'delivered'),                                        // historical
    ...n(5, 'delivered', { campaignId: 'camp-a' }),
    ...n(2, 'opened', { campaignId: 'camp-a' }),
    ...n(3, 'delivered', { campaignId: 'camp-b' }),
  ])
  const r = await query()
  assert.equal(r.attribution.taggingActive, true)
  assert.equal(r.attribution.taggedWithCampaignId, 10)
  assert.equal(r.attribution.untagged, 10)
  assert.deepEqual(r.attribution.campaigns, { 'camp-a': 7, 'camp-b': 3 })
  assert.match(r.attribution.note, /10 of 20 events carry a campaignId/)
})

// ── THE BASELINE-CAMPAIGN GUARANTEE ─────────────────────────────────────────
test('the already-sent campaign gets NO invented attribution', async () => {
  // Its 50 emails went out before tagging shipped, so no stored event names it.
  // The endpoint must NOT fall back to "all untagged events" and present them as
  // this campaign's results — that would fabricate a delivery report.
  await seed([...n(50, 'sent'), ...n(48, 'delivered'), ...n(9, 'opened')])
  const r = await query('?campaignId=scamcheck-fake-screenshot-2026-08-26')

  assert.equal(r.status, 'no_events')
  assert.equal(r.summary.total, 0, 'scoped summary must be empty, not the global 107')
  assert.equal(r.summary.deliveryRate, 0)
  assert.equal(r.distinctRecipients, 0)
  // …while still telling the operator that 107 events DO exist and why none match.
  assert.equal(r.attribution.totalEventsStored, 107)
  assert.match(r.attribution.scopeNote, /cannot be attributed/)
  assert.match(r.attribution.scopeNote, /NOT evidence of zero delivery/)
})

test('a scoped query returns ONLY that campaign, never a global fallback', async () => {
  await seed([
    ...n(20, 'delivered'),                                        // untagged noise
    ...n(6, 'delivered', { campaignId: 'camp-a' }),
    ...n(4, 'delivered', { campaignId: 'camp-b' }),
  ])
  const a = await query('?campaignId=camp-a')
  assert.equal(a.status, 'events_available')
  assert.equal(a.summary.total, 6)
  assert.equal(a.campaignId, 'camp-a')

  const missing = await query('?campaignId=camp-zzz')
  assert.equal(missing.status, 'no_events')
  assert.equal(missing.summary.total, 0)
  assert.match(missing.attribution.scopeNote, /no stored event in this window carries this campaignId/i)
})

// ── PII ─────────────────────────────────────────────────────────────────────
test('NO subscriber address appears anywhere in the response', async () => {
  const addresses = ['alice@example.test', 'bob@example.test', 'carol@example.test']
  await seed([
    { type: 'delivered', email: addresses[0], campaignId: 'camp-a' },
    { type: 'opened', email: addresses[0], campaignId: 'camp-a' },
    { type: 'delivered', email: addresses[1], campaignId: 'camp-a' },
    { type: 'bounced', email: addresses[2], campaignId: 'camp-a' },
  ])
  const r = await query('?campaignId=camp-a')
  assert.equal(r.distinctRecipients, 3, 'recipients are a COUNT')

  const blob = JSON.stringify(r)
  for (const a of addresses) assert.ok(!blob.includes(a), `response leaked ${a}`)
  assert.ok(!blob.includes('@example.test'), 'no address fragment may appear')
  assert.ok(!('recent' in r) && !('rows' in r) && !('events' in r), 'no row-level array may be returned')
})

test('distinct recipients de-duplicates repeat events from one address', async () => {
  await seed([
    { type: 'sent', email: 'same@example.test', campaignId: 'c' },
    { type: 'delivered', email: 'same@example.test', campaignId: 'c' },
    { type: 'opened', email: 'SAME@example.test', campaignId: 'c' },   // case variant
    { type: 'delivered', email: 'other@example.test', campaignId: 'c' },
  ])
  const r = await query('?campaignId=c')
  assert.equal(r.summary.total, 4)
  assert.equal(r.distinctRecipients, 2)
})

// ── Malformed rows (the parser defect's fingerprint) ────────────────────────
test('junk rows written by the old parser are counted, not silently counted as people', async () => {
  await seed([
    { type: 'delivered', email: 'real@example.test' },
    { type: 'delivered', email: 'undefined' },      // what webhook.ts used to write
    { type: 'delivered', email: '' },
  ])
  const r = await query()
  assert.equal(r.summary.total, 3)
  assert.equal(r.malformedRecipientRows, 2)
  assert.equal(r.distinctRecipients, 1, 'only the real address counts as a recipient')
})

// ── Window / limit handling ─────────────────────────────────────────────────
test('the newest events are scanned, and truncation is explicit', async () => {
  const events = Array.from({ length: 120 }, (_, i) => ({ type: 'delivered', ts: T0 + i * 1000 }))
  await seed(events)
  const r = await query('?limit=50')
  assert.equal(r.window.limit, 50)
  assert.equal(r.window.scanned, 50)
  assert.equal(r.window.truncated, true, 'truncation must be visible, never silent')
  // ordered ts desc → the newest 50, i.e. ts index 70..119
  assert.equal(r.lastEventAt, new Date(T0 + 119 * 1000).toISOString())
  assert.equal(r.firstEventAt, new Date(T0 + 70 * 1000).toISOString())
})

test('an absent or invalid limit falls back to the default, never to zero', async () => {
  await seed(n(5, 'delivered'))
  // Number(null) === 0 would have scanned nothing — the same trap fixed in
  // newsletter-metrics. Absent, blank, non-numeric and <=0 must all default.
  for (const qs of ['', '?limit=', '?limit=notanumber', '?limit=0', '?limit=-10']) {
    const r = await query(qs)
    assert.equal(r.window.limit, 2000, `limit ${JSON.stringify(qs)} must default`)
    assert.equal(r.window.scanned, 5)
  }
  const capped = await query('?limit=99999')
  assert.equal(capped.window.limit, 5000, 'limit must be capped')
})

test('first/last timestamps are scoped to the requested campaign', async () => {
  await seed([
    { type: 'delivered', ts: T0, campaignId: 'old' },
    { type: 'delivered', ts: T0 + 60_000, campaignId: 'new' },
    { type: 'opened', ts: T0 + 120_000, campaignId: 'new' },
  ])
  const r = await query('?campaignId=new')
  assert.equal(r.firstEventAt, new Date(T0 + 60_000).toISOString())
  assert.equal(r.lastEventAt, new Date(T0 + 120_000).toISOString())
})

// ── Read-only ───────────────────────────────────────────────────────────────
test('the endpoint writes nothing', async () => {
  const store = await seed([...n(3, 'delivered'), ...n(1, 'opened')])
  const before = (await store.query(EMAIL_EVENTS, { limit: 999 })).length
  await query()
  await query('?campaignId=camp-a')
  const after = await store.query(EMAIL_EVENTS, { limit: 999 })
  assert.equal(after.length, before, 'no row added or removed')
  for (const coll of ['campaigns', 'campaign_sends', 'newsletter']) {
    assert.equal((await store.query(coll, { limit: 10 })).length, 0, `${coll} must be untouched`)
  }
})
