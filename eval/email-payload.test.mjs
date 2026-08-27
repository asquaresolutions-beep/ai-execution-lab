// eval/email-payload.test.mjs
//
// Proves what the Resend HTTP payload ACTUALLY contains after wiring campaign tags.
//
// The helper tests in email-attribution.test.mjs check campaignTags() in isolation;
// these tests capture the real JSON body that send() would POST, so a regression in
// the wiring — not just the helper — is caught.
//
// Offline: the fetch stub NEVER performs I/O and refuses any host other than the
// Resend endpoint, recording violations so a stray call cannot be swallowed by
// send()'s try/catch. No production write, MemoryStore only.
//
// Run: node --test --import ./eval/hooks.mjs eval/email-payload.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const B = 'C:/Users/Acer/Desktop/ai-execution-lab/'
const imp = (p) => import(pathToFileURL(B + p).href)

// notify.ts captures RESEND_API_KEY at module load; without it send() no-ops and
// no payload would ever be built. Obvious fake — not a credential.
process.env.RESEND_API_KEY = 'test-key-not-a-real-secret'

const RESEND_URL = 'https://api.resend.com/emails'
/** @type {{url:string, body:any}[]} */
let captured = []
/** @type {string[]} */
let violations = []

globalThis.fetch = async (url, init) => {
  const u = String(url)
  if (u !== RESEND_URL) {
    // Recorded rather than thrown: send() catches exceptions, so throwing here
    // would be silently converted into { ok:false } and the test could still pass.
    violations.push(u)
    return new Response('{}', { status: 500 })
  }
  captured.push({ url: u, body: JSON.parse(String(init?.body ?? '{}')) })
  return new Response(JSON.stringify({ id: 'msg_test' }), { status: 200, headers: { 'content-type': 'application/json' } })
}

const { sendListEmail, notifyNewsletter, notifySubscribe } = await imp('lib/email/notify.ts')
const { setStore } = await imp('lib/store/adapter.ts')
const { MemoryStore } = await imp('lib/store/memory-store.ts')
const { CAMPAIGNS, enqueueCampaign, drainCampaign } = await imp('lib/newsletter/campaigns.ts')
const { processWelcomeSequence } = await imp('lib/newsletter/welcome-sequence.ts')

function reset() { captured = []; violations = [] }
const only = () => { assert.equal(violations.length, 0, `non-Resend request(s): ${violations.join(', ')}`); assert.equal(captured.length, 1, `expected exactly 1 send, got ${captured.length}`); return captured[0].body }

const MAIL = { to: 'reader@example.test', subject: 'Subject line', title: 'Title', bodyHtml: '<p>Body</p>' }

// ── 1 · The payload without a campaign is unchanged ─────────────────────────
test('a send with no campaignId posts NO tags field at all', async () => {
  reset()
  await sendListEmail({ ...MAIL })
  const body = only()
  assert.ok(!('tags' in body), 'tags must be absent, not an empty array')
  assert.deepEqual(Object.keys(body).sort(), ['from', 'headers', 'html', 'subject', 'text', 'to'])
})

test('a send WITH a campaignId carries exactly one campaignId tag', async () => {
  reset()
  await sendListEmail({ ...MAIL, campaignId: 'scamcheck-weekly-2026-09-02' })
  const body = only()
  assert.deepEqual(body.tags, [{ name: 'campaignId', value: 'scamcheck-weekly-2026-09-02' }])
})

// ── 2 · THE BACKWARD-COMPATIBILITY PROOF ────────────────────────────────────
test('tagging changes the payload ONLY by adding `tags` — every other byte is identical', async () => {
  reset()
  await sendListEmail({ ...MAIL })
  await sendListEmail({ ...MAIL, campaignId: 'camp-x' })
  assert.equal(violations.length, 0)
  assert.equal(captured.length, 2)

  const [plain, tagged] = captured.map((c) => c.body)
  assert.ok(tagged.tags, 'sanity: the second send must actually be tagged')
  delete tagged.tags
  // `tags` is spread LAST in notify.ts, so removing it restores the original key
  // ORDER as well as the values — a strict string compare is therefore valid and is
  // the strongest available statement of "nothing else moved".
  assert.equal(JSON.stringify(tagged), JSON.stringify(plain))
})

test('unsubscribe headers and the text/plain alternative survive tagging', async () => {
  reset()
  await sendListEmail({ ...MAIL, campaignId: 'camp-y' })
  const body = only()
  assert.match(body.headers['List-Unsubscribe'], /^<https:\/\/[^>]+\/api\/newsletter\/unsubscribe\?id=nl_[0-9a-f]{32}>/)
  assert.equal(body.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
  assert.match(body.html, /Unsubscribe/)
  assert.ok(body.text && body.text.length > 0, 'text/plain alternative must still be generated')
})

test('an unusable campaign id sends NO tag rather than a malformed one Resend would reject', async () => {
  for (const id of ['', '   ', '###']) {
    reset()
    await sendListEmail({ ...MAIL, campaignId: id })
    assert.ok(!('tags' in only()), `id ${JSON.stringify(id)} must not produce a tags field`)
  }
})

// ── 3 · The real campaign path, end to end ──────────────────────────────────
test('drainCampaign tags each email with the campaign it belongs to', async () => {
  reset()
  const store = new MemoryStore()
  setStore(store)
  await store.set(CAMPAIGNS, 'scamcheck-test-campaign', {
    id: 'scamcheck-test-campaign', brand: 'scamcheck', status: 'approved',
    subject: 's', title: 't', bodyHtml: '<p>b</p>', createdAt: new Date().toISOString(),
  })
  await store.set('newsletter', 'nl_one', { email: 'one@example.test', unsubscribed: false })

  const enq = await enqueueCampaign('scamcheck-test-campaign')
  assert.equal(enq.recipients, 1)
  const drained = await drainCampaign('scamcheck-test-campaign')
  assert.equal(drained.sent, 1, 'sanity: the drain must have actually sent')
  assert.equal(drained.failed, 0)

  const body = only()
  assert.deepEqual(body.tags, [{ name: 'campaignId', value: 'scamcheck-test-campaign' }])
  assert.deepEqual(body.to, ['one@example.test'], 'recipient selection is unchanged')
})

test('recipient selection, idempotency and send ids are untouched by tagging', async () => {
  reset()
  const store = new MemoryStore()
  setStore(store)
  await store.set(CAMPAIGNS, 'c-idem', {
    id: 'c-idem', brand: 'scamcheck', status: 'approved',
    subject: 's', title: 't', bodyHtml: '<p>b</p>', createdAt: new Date().toISOString(),
  })
  await store.set('newsletter', 'nl_a', { email: 'a@example.test' })
  await store.set('newsletter', 'nl_b', { email: 'b@example.test', unsubscribed: true })   // excluded
  await store.set('newsletter', 'nl_c', { email: '' })                                     // excluded

  assert.equal((await enqueueCampaign('c-idem')).recipients, 1, 'unsubscribed + blank still excluded')
  // Re-enqueue must add nobody — the deterministic send id is the document key.
  await store.update(CAMPAIGNS, 'c-idem', { status: 'approved' })
  assert.equal((await enqueueCampaign('c-idem')).recipients, 0, 're-enqueue must be idempotent')
  assert.equal(captured.length, 0, 'enqueue must not send anything')
})

// ── 4 · Non-campaign senders are provably unchanged ─────────────────────────
test('the welcome drip sends UNTAGGED mail', async () => {
  reset()
  const store = new MemoryStore()
  setStore(store)
  process.env.WELCOME_SEQUENCE_ENABLED = 'true'
  process.env.WELCOME_SEQUENCE_SINCE = new Date(Date.now() - 30 * 86_400_000).toISOString()
  // 3 days old → welcome step 1 (offset 2 days) is due.
  await store.set('newsletter', 'nl_w', {
    email: 'welcome@example.test',
    createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  })

  const res = await processWelcomeSequence()
  assert.equal(res.sent, 1, 'sanity: the drip must have actually sent, or this test proves nothing')
  const body = only()
  assert.ok(!('tags' in body), 'welcome-drip mail must carry no campaign tag')
  delete process.env.WELCOME_SEQUENCE_ENABLED
  delete process.env.WELCOME_SEQUENCE_SINCE
})

test('transactional + signup mail is untagged', async () => {
  reset()
  await notifySubscribe('sub@example.test')
  await notifyNewsletter({ email: 'signup@example.test', name: 'A' })
  assert.equal(violations.length, 0)
  assert.ok(captured.length >= 3, 'expected the subscribe mail plus admin+welcome pair')
  for (const c of captured) assert.ok(!('tags' in c.body), `${c.body.subject} must be untagged`)
})

// ── 5 · Static guard: only campaigns.ts may tag ─────────────────────────────
test('no caller outside lib/newsletter/campaigns.ts passes a campaignId to sendListEmail', () => {
  // A runtime test can only cover the callers it drives. This closes the gap for
  // lib/trustseal/monitoring/scan.ts and any future caller: tagging welcome or
  // monitoring mail with a campaign id would corrupt attribution silently.
  const files = [
    'lib/newsletter/welcome-sequence.ts',
    'lib/trustseal/monitoring/scan.ts',
  ]
  for (const f of files) {
    const src = readFileSync(B + f, 'utf8')
    assert.ok(/sendListEmail\(/.test(src), `${f} should still call sendListEmail`)
    assert.ok(!/campaignId/.test(src), `${f} must NOT pass campaignId`)
  }
  const camp = readFileSync(B + 'lib/newsletter/campaigns.ts', 'utf8')
  const tagged = camp.match(/sendListEmail\(\{[^}]*campaignId/g) || []
  assert.equal(tagged.length, 2, 'exactly the two campaign call sites tag their sends')
})
