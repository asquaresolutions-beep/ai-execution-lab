// eval/newsletter-daily-quota.test.mjs   (asq-shared-daily-quota-v1)
//
// Offline tests for the ONE daily send budget shared by campaign sends (drainCampaign,
// processCampaignSends) and the welcome drip (lib/email/daily-quota.ts):
//   Q1–Q3  the reading itself: what counts, what does not, fail-closed reads;
//   Q4–Q8  campaign loops: stop BEFORE claiming when the budget is used up or unreadable,
//          rows stay queued with the same attempt and key, the next UTC day carries on,
//          each recipient is sent once; the daily cron path honours the same check;
//   Q9–Q11 the two senders yield to each other; concurrent runs at the boundary;
//   Q12–Q13 wiring: shared constants agree; the check sits before every claim.
//
// An in-memory store behind a proxy that can fail a chosen call, and a stubbed provider
// that performs no I/O (any other request is a violation) and can write the event the
// provider's webhook would store. Every address is synthetic. Nothing leaves the machine.
//
// What these tests do NOT claim: that the provider's real daily limit is 100 or resets at
// 00:00 UTC (documented, and read from the owner's dashboard on 13 Oct 2026), or that
// on-demand mail sent after the last attempt stays within the reserve.
//
// Run: node --test --import ./eval/hooks.mjs eval/newsletter-daily-quota.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'

process.env.RESEND_API_KEY = 'test-key-not-a-real-secret'
process.env.CAMPAIGN_SENDS_ENABLED = 'true'
process.env.VERCEL_ENV = 'production'
process.env.ADMIN_API_TOKEN = 'test-token-not-a-real-secret'
delete process.env.WEEKLY_DIGEST_ENABLED
delete process.env.PUBLIC_APP_URL
delete process.env.MAIL_PHYSICAL_ADDRESS
delete process.env.EMAIL_FROM
delete process.env.FIREBASE_PROJECT_ID   // never the production store
delete process.env.FIREBASE_API_KEY

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const imp = (p) => import(pathToFileURL(B + p).href)

// ── Provider stub ───────────────────────────────────────────────────────────
const RESEND_URL = 'https://api.resend.com/emails'
const provider = { requests: [], violations: [], webhook: true, real: null, respond: null }
globalThis.fetch = async (url, init) => {
  const u = String(url)
  const method = String(init?.method || 'GET').toUpperCase()
  if (u !== RESEND_URL || method !== 'POST') { provider.violations.push(`${method} ${u}`); return new Response('{}', { status: 500 }) }
  const body = JSON.parse(String(init?.body ?? '{}'))
  const to = Array.isArray(body.to) ? body.to[0] : body.to
  const campaignTag = (body.tags || []).find((t) => /campaign/i.test(String(t.name)))
  const req = { n: provider.requests.length + 1, to, key: (init?.headers || {})['Idempotency-Key'] ?? null, campaignId: campaignTag ? String(campaignTag.value) : null }
  provider.requests.push(req)
  const status = provider.respond ? provider.respond(req) : 200
  if (status < 300 && provider.webhook && provider.real) {
    // What the webhook stores for an accepted message: campaign mail carries its campaign id.
    await provider.real.set('email_events', null, { type: 'sent', email: String(to).toLowerCase(), ts: Date.now(), messageId: `msg_q_${req.n}`, campaignId: req.campaignId })
  }
  return new Response(JSON.stringify(status < 300 ? { id: `msg_q_${req.n}` } : { message: `refused ${status}` }), { status, headers: { 'content-type': 'application/json' } })
}

const { setStore, applyQuery } = await imp('lib/store/adapter.ts')
const { MemoryStore } = await imp('lib/store/memory-store.ts')
const S = await imp('lib/newsletter/subscribers.ts')
const C = await imp('lib/newsletter/campaigns.ts')
const Q = await imp('lib/email/daily-quota.ts')
const W = await imp('lib/newsletter/welcome-claims.ts')
const { processWelcomeSequence, WELCOME_LIMITS } = await imp('lib/newsletter/welcome-sequence.ts')
const { POST } = await imp('app/api/admin/campaigns/route.ts')
const { CAMPAIGNS, CAMPAIGN_SENDS, CAMPAIGN_SEND_CLAIMS: CLAIMS } = C
const { subscriberDocId } = S

const LIST = 'newsletter', EVENTS = 'email_events', DRIP = W.WELCOME_SEND_CLAIMS
const DAY = 86_400_000, MIN = 60_000
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

// ── Store: in-memory, Firestore-like read order, one injectable fault ───────
function harness() {
  const real = new MemoryStore()
  const calls = []
  const ctl = { fault: null }
  const wrap = (op, fn) => async (...args) => {
    const call = { op, collection: args[0], args }
    calls.push(call)
    if (ctl.fault) ctl.fault(call)
    return fn(...args)
  }
  const store = {
    name: 'firestore-like',
    set: wrap('set', (c, id, d) => real.set(c, id, d)),
    create: wrap('create', (c, id, d) => real.create(c, id, d)),
    update: wrap('update', (c, id, p) => real.update(c, id, p)),
    delete: wrap('delete', (c, id) => real.delete(c, id)),
    increment: wrap('increment', (c, id, f, by) => real.increment(c, id, f, by)),
    get: wrap('get', (c, id) => real.get(c, id)),
    query: wrap('query', async (collection, opts = {}) => {
      let rows = (await real.query(collection, {})).sort(byId)
      if (opts.orderBy) rows = rows.filter((r) => r.data[opts.orderBy.field] !== undefined)
      return applyQuery(applyQuery(rows, opts), opts)
    }),
  }
  setStore(store)
  Object.assign(provider, { requests: [], violations: [], webhook: true, real, respond: null })
  return { real, store, calls, ctl }
}

/** `n` provider-reported messages not attributed to a campaign, earlier today (or at `ts`). */
async function otherMail(h, n, ts = Date.now() - 5 * MIN) {
  for (let i = 0; i < n; i++) await h.real.set(EVENTS, null, { type: 'sent', email: `other${i}@example.test`, ts: ts - i, messageId: `other_${ts}_${i}`, campaignId: null })
}

/** An approved campaign `c1` queued, the way the admin route does it, to the given addresses. */
async function queuedCampaign(h, emails) {
  await h.real.set(CAMPAIGNS, 'c1', {
    id: 'c1', brand: 'scamcheck', status: 'approved', subject: 'Subject line', title: 'Headline', bodyHtml: '<p>Body</p>',
    createdAt: '2026-10-01T00:00:00.000Z', approvedAt: '2026-10-02T00:00:00.000Z',
  })
  for (const email of emails) await h.real.set(LIST, subscriberDocId(email), { email, unsubscribed: false, source: 'test-seed' })
  const p = await C.previewRecipients('c1')
  const q = await C.enqueueCampaign('c1', undefined, p.binding)
  assert.equal(q.ok, true, `enqueue: ${JSON.stringify(q)}`)
}

/** Welcome subscribers due for step 1 (signed up 3 days ago). */
async function dueSubscribers(h, n) {
  process.env.WELCOME_SEQUENCE_ENABLED = 'true'
  process.env.WELCOME_SEQUENCE_SINCE = new Date(Date.now() - 365 * DAY).toISOString()
  const out = []
  for (let i = 0; i < n; i++) {
    const email = `drip${i}@example.test`
    const id = subscriberDocId(email)
    await h.real.set(LIST, id, { email, createdAt: new Date(Date.now() - 3 * DAY - i * MIN).toISOString(), consent: true, list: 'asquare-newsletter' })
    out.push({ id, email })
  }
  return out
}
const dripOpts = () => { let t = 0; return { clock: () => t, sleep: async (ms) => { t += ms } } }

const rows = async (h) => (await h.real.query(CAMPAIGN_SENDS, { where: [{ field: 'campaignId', op: '==', value: 'c1' }], limit: 1000 })).map((r) => ({ id: r.id, ...r.data }))
const claimCount = async (h) => (await h.real.query(CLAIMS, { limit: 10000 })).length
const noViolations = () => assert.equal(provider.violations.length, 0, `unexpected request(s): ${provider.violations.join(', ')}`)
const post = (body) => POST(new Request('https://lab.example.test/api/admin/campaigns', {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer test-token-not-a-real-secret' }, body: JSON.stringify(body),
}))

// ════════════════════════════════════════════════════════════════════════════════
// The reading
// ════════════════════════════════════════════════════════════════════════════════
test('Q1 the reading: other mail, drip attempts and campaign attempts each count once; campaign events, yesterday and non-sends do not', async () => {
  const h = harness()
  const now = Date.now()
  const day = W.utcDayStart(now)
  assert.deepEqual(await Q.readDailyQuota(now), { limit: 100, reserve: 40, otherSendsToday: 0, dripAttemptsToday: 0, campaignAttemptsToday: 0, remaining: 60 })

  const ev = (data) => h.real.set(EVENTS, null, { email: 'x@example.test', campaignId: null, ...data })
  for (let i = 0; i < 5; i++) await ev({ type: 'sent', ts: day + 1000 + i, messageId: `m${i}` })   // 5 messages
  await ev({ type: 'sent', ts: day + 2000, messageId: 'm0' })                                     // same message again: not a new send
  await ev({ type: 'suppressed', ts: day + 3000, messageId: 'm_sup' })                            // the provider counted it: 6
  await ev({ type: 'delivered', ts: day + 4000, messageId: 'm1' })                                // delivery of a counted message
  for (let i = 0; i < 3; i++) await ev({ type: 'sent', ts: day - 1000 - i, messageId: `y${i}` })  // yesterday
  for (let i = 0; i < 4; i++) await ev({ type: 'sent', ts: day + 5000 + i, messageId: `c${i}`, campaignId: 'c1' })   // campaign mail: counted by its claims

  const drip = (seq, outcome, at = day + 10_000) => h.real.set(DRIP, `rec__s1__c${seq}`, { recordId: 'rec', step: 1, seq, keyGen: 1, runId: 'r', claimedAt: new Date(at).toISOString(), claimedAtMs: at, ...(outcome === undefined ? {} : { outcome }) })
  await drip(1, 'sent'); await drip(2, 'unknown'); await drip(3, undefined)                      // 3 that may have gone out
  await drip(4, 'failed'); await drip(5, 'deferred'); await drip(6, 'skipped')                    // definite non-sends
  await drip(7, 'sent', day - 60_000)                                                              // yesterday

  const camp = (id, at) => h.real.set(CLAIMS, id, { sendId: id, campaignId: 'c1', attempt: 1, runId: 'r', claimedAt: new Date(at).toISOString(), claimedAtMs: at })
  for (let i = 0; i < 4; i++) await camp(`today${i}`, day + 20_000 + i)
  await camp('before_midnight_in_lookback', day - 10 * MIN)                                       // a run that straddled 00:00 UTC
  await camp('before_lookback', day - Q.CAMPAIGN_CLAIM_LOOKBACK_MS - MIN)

  const r = await Q.readDailyQuota(now)
  assert.deepEqual(r, { limit: 100, reserve: 40, otherSendsToday: 6, dripAttemptsToday: 3, campaignAttemptsToday: 5, remaining: 100 - 40 - 6 - 3 - 5 })
})

test('Q2 a read that reaches its limit cannot be trusted: the reading throws', async () => {
  const h = harness()
  await otherMail(h, 3)
  await assert.rejects(() => Q.readDailyQuota(Date.now(), { readLimit: 3 }), /truncated/)
  const h2 = harness()
  for (let i = 0; i < 3; i++) await h2.real.set(CLAIMS, `k${i}`, { claimedAtMs: Date.now() - i })
  await assert.rejects(() => Q.readDailyQuota(Date.now(), { readLimit: 3 }), /truncated/)
  const h3 = harness()
  for (let i = 0; i < 3; i++) await h3.real.set(DRIP, `d${i}`, { claimedAtMs: Date.now() - i, outcome: 'failed' })
  await assert.rejects(() => Q.readDailyQuota(Date.now(), { readLimit: 3 }), /truncated/, 'even claims that do not count fill the read')
})

test('Q3 any of the three reads failing makes the reading throw', async () => {
  for (const coll of [EVENTS, DRIP, CLAIMS]) {
    const h = harness()
    h.ctl.fault = (call) => { if (call.op === 'query' && call.collection === coll) throw new Error('store down') }
    await assert.rejects(() => Q.readDailyQuota(Date.now()), /store down/, coll)
  }
})

// ════════════════════════════════════════════════════════════════════════════════
// Campaign loops
// ════════════════════════════════════════════════════════════════════════════════
test('Q4 a drain at a used-up budget stops before claiming: nothing sent, rows queued with the same attempt and key, campaign still sending', async () => {
  const h = harness()
  await queuedCampaign(h, ['a@example.test', 'b@example.test', 'c@example.test'])
  await otherMail(h, 60)
  const before = await rows(h)
  const r = await C.drainCampaign('c1')
  assert.equal(r.ok, true)
  assert.equal(r.stopped, 'quota_exhausted')
  assert.equal(r.processed, 0); assert.equal(r.sent, 0); assert.equal(r.failed, 0)
  assert.equal(r.done, false); assert.equal(r.remaining, 3)
  assert.equal(provider.requests.length, 0, 'nothing handed to the provider')
  assert.equal(await claimCount(h), 0, 'nothing claimed')
  assert.deepEqual(await rows(h), before, 'rows untouched: queued, same attempt, same key generation')
  assert.equal((await h.real.get(CAMPAIGNS, 'c1')).data.status, 'sending')
  noViolations()
})

test('Q5 a drain sends exactly what the budget allows, then stops; campaign events do not count twice', async () => {
  const h = harness()
  const emails = ['a@example.test', 'b@example.test', 'c@example.test', 'd@example.test', 'e@example.test']
  await queuedCampaign(h, emails)
  await otherMail(h, 57)   // remaining 3
  const r = await C.drainCampaign('c1')
  assert.equal(r.sent, 3); assert.equal(r.stopped, 'quota_exhausted'); assert.equal(r.remaining, 2)
  assert.equal(provider.requests.length, 3)
  assert.equal(new Set(provider.requests.map((x) => x.to)).size, 3, 'three different recipients')
  assert.equal(await claimCount(h), 3)
  const st = (await rows(h)).map((x) => x.status).sort()
  assert.deepEqual(st, ['queued', 'queued', 'sent', 'sent', 'sent'])
  for (const row of (await rows(h)).filter((x) => x.status === 'queued')) assert.equal(row.attempt || 1, 1, 'a waiting row keeps its attempt')
  // The webhook stored a campaign-attributed 'sent' event for each of the three: still 3 used, not 6.
  const q = await Q.readDailyQuota()
  assert.equal(q.campaignAttemptsToday, 3); assert.equal(q.otherSendsToday, 57); assert.equal(q.remaining, 0)
  noViolations()
})

test('Q6 the next UTC day the same drain carries on: each remaining recipient once, key generation unchanged, no requeue', async () => {
  const h = harness()
  const emails = ['a@example.test', 'b@example.test', 'c@example.test', 'd@example.test', 'e@example.test']
  await queuedCampaign(h, emails)
  await otherMail(h, 57)
  await C.drainCampaign('c1')
  assert.equal(provider.requests.length, 3)
  // A day passes: everything recorded so far moves to yesterday (before the claim lookback too).
  const shift = DAY + Q.CAMPAIGN_CLAIM_LOOKBACK_MS + 5 * MIN
  for (const e of await h.real.query(EVENTS, { limit: 10000 })) await h.real.update(EVENTS, e.id, { ts: e.data.ts - shift })
  for (const c of await h.real.query(CLAIMS, { limit: 10000 })) await h.real.update(CLAIMS, c.id, { claimedAtMs: c.data.claimedAtMs - shift })
  const r = await C.drainCampaign('c1')
  assert.equal(r.sent, 2); assert.equal(r.done, true); assert.equal(r.stopped, undefined)
  assert.equal(provider.requests.length, 5)
  const per = provider.requests.reduce((m, x) => m.set(x.to, (m.get(x.to) || 0) + 1), new Map())
  assert.deepEqual([...per.keys()].sort(), emails)
  for (const n of per.values()) assert.equal(n, 1, 'each recipient exactly once')
  for (const x of provider.requests) assert.match(String(x.key), /\/k1$/, 'generation-1 key: the budget stop never moved a key')
  assert.equal((await h.real.get(CAMPAIGNS, 'c1')).data.status, 'sent')
  noViolations()
})

test('Q7 an unreadable budget stops the drain before claiming (quota_unknown), for each of the three reads', async () => {
  for (const [coll, match] of [[EVENTS, (a) => a[1]?.where?.some((w) => w.field === 'ts')], [DRIP, () => true], [CLAIMS, (a) => a[1]?.where?.some((w) => w.field === 'claimedAtMs')]]) {
    const h = harness()
    await queuedCampaign(h, ['a@example.test', 'b@example.test'])
    h.ctl.fault = (call) => { if (call.op === 'query' && call.collection === coll && match(call.args)) throw new Error('store down') }
    const r = await C.drainCampaign('c1')
    h.ctl.fault = null
    assert.equal(r.ok, true, coll); assert.equal(r.stopped, 'quota_unknown', coll)
    assert.equal(provider.requests.length, 0, coll); assert.equal(await claimCount(h), 0, coll)
    assert.ok((await rows(h)).every((x) => x.status === 'queued' && (x.attempt || 1) === 1), coll)
  }
})

test('Q8 the daily cron path (processCampaignSends) applies the same budget', async () => {
  const h = harness()
  await queuedCampaign(h, ['a@example.test', 'b@example.test', 'c@example.test'])
  await otherMail(h, 59)   // remaining 1
  process.env.WEEKLY_DIGEST_ENABLED = 'true'
  try {
    const r = await C.processCampaignSends()
    assert.equal(r.sent, 1); assert.equal(r.stopped, 'quota_exhausted')
    assert.equal(provider.requests.length, 1); assert.equal(await claimCount(h), 1)
    assert.equal((await h.real.get(CAMPAIGNS, 'c1')).data.status, 'sending', 'recipients still waiting')
  } finally { delete process.env.WEEKLY_DIGEST_ENABLED }
  noViolations()
})

test('Q8b the admin drain action reports the stop', async () => {
  const h = harness()
  await queuedCampaign(h, ['a@example.test'])
  await otherMail(h, 60)
  const res = await post({ action: 'drain', id: 'c1' })
  const j = await res.json()
  assert.equal(j.stopped, 'quota_exhausted'); assert.equal(j.sent, 0)
  assert.equal(provider.requests.length, 0)
})

// ════════════════════════════════════════════════════════════════════════════════
// The two senders share one budget
// ════════════════════════════════════════════════════════════════════════════════
test('Q9 the drip yields to campaign attempts made today (including ones whose events have not arrived)', async () => {
  const h = harness()
  await dueSubscribers(h, 2)
  const at = Date.now() - MIN
  for (let i = 0; i < 60; i++) await h.real.set(CLAIMS, `cs_c1_x${i}__a1`, { sendId: `x${i}`, campaignId: 'c1', attempt: 1, runId: 'r', claimedAt: new Date(at).toISOString(), claimedAtMs: at })
  const r = await processWelcomeSequence(Date.now(), dripOpts())
  assert.equal(r.sent, 0); assert.equal(r.stopped, 'quota_exhausted')
  assert.equal(r.quota.campaignAttemptsToday, 60)
  assert.equal(provider.requests.length, 0)
  // Control: the same list with no campaign attempts is sent.
  const h2 = harness()
  await dueSubscribers(h2, 2)
  const r2 = await processWelcomeSequence(Date.now(), dripOpts())
  assert.equal(r2.sent, 2)
  noViolations()
  delete process.env.WELCOME_SEQUENCE_ENABLED; delete process.env.WELCOME_SEQUENCE_SINCE
})

test('Q10 a campaign yields to drip attempts made today', async () => {
  const h = harness()
  await queuedCampaign(h, ['a@example.test', 'b@example.test'])
  const at = Date.now() - MIN
  for (let i = 0; i < 60; i++) await h.real.set(DRIP, `nl_x${i}__s1__c1`, { recordId: `nl_x${i}`, step: 1, seq: 1, keyGen: 1, runId: 'r', claimedAt: new Date(at).toISOString(), claimedAtMs: at, outcome: 'sent' })
  const r = await C.drainCampaign('c1')
  assert.equal(r.stopped, 'quota_exhausted'); assert.equal(r.sent, 0)
  assert.equal(provider.requests.length, 0); assert.equal(await claimCount(h), 0)
})

test('Q11 a drain and the drip started together at the last slot: at most one attempt over, per extra run', async () => {
  for (let round = 0; round < 5; round++) {
    const h = harness()
    await queuedCampaign(h, ['a@example.test', 'b@example.test', 'c@example.test'])
    await dueSubscribers(h, 3)
    await otherMail(h, 59)   // remaining 1
    const [d, w] = await Promise.all([C.drainCampaign('c1'), processWelcomeSequence(Date.now(), dripOpts())])
    const attempts = provider.requests.length
    assert.ok(attempts >= 1 && attempts <= 2, `round ${round}: ${attempts} attempts (drain ${d.sent}, drip ${w.sent})`)
    const q = await Q.readDailyQuota()
    assert.ok(q.remaining >= -1, `round ${round}: remaining ${q.remaining}`)
  }
  delete process.env.WELCOME_SEQUENCE_ENABLED; delete process.env.WELCOME_SEQUENCE_SINCE
  noViolations()
})

// ════════════════════════════════════════════════════════════════════════════════
// Wiring
// ════════════════════════════════════════════════════════════════════════════════
test('Q12 shared constants agree across the modules', () => {
  assert.equal(Q.CAMPAIGN_CLAIMS_COLLECTION, C.CAMPAIGN_SEND_CLAIMS)
  assert.equal(Q.DAILY_PROVIDER_LIMIT, WELCOME_LIMITS.dailyProviderLimit)
  assert.equal(Q.ROUTINE_RESERVE, WELCOME_LIMITS.dailyReserve)
  assert.ok(Q.CAMPAIGN_CLAIM_LOOKBACK_MS >= 330_000, 'the lookback covers a whole run (lock TTL 330 s)')
})

test('Q13 the budget is read before every claim in both campaign loops, and the drip reads the shared budget', () => {
  const src = readFileSync(B + 'lib/newsletter/campaigns.ts', 'utf8')
  for (const fn of ['export async function drainCampaign', 'export async function processCampaignSends']) {
    const body = src.slice(src.indexOf(fn), src.indexOf('\n}\n', src.indexOf(fn)))
    const q = body.indexOf('await quotaStop()'), c = body.indexOf('await claimAttempt(')
    assert.ok(q > 0 && c > 0 && q < c, `${fn}: the budget check comes before the claim`)
    assert.equal(body.split('await claimAttempt(').length - 1, 1, `${fn}: one claim site`)
  }
  assert.ok(!src.includes('.delete('), 'campaigns.ts never deletes (scripts/test-scamcheck-digest.mjs)')
  const w = readFileSync(B + 'lib/newsletter/welcome-sequence.ts', 'utf8')
  assert.match(w, /await readDailyQuota\(now, \{ limit: lim\.dailyProviderLimit, reserve: lim\.dailyReserve, readLimit: lim\.quotaReadLimit \}\)/)
  assert.ok(!/campaignId/.test(w), 'welcome-sequence.ts stays free of campaign ids')
})
