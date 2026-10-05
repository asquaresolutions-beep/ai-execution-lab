// eval/scamcheck-upi-handle-prefix.test.mjs
//
// Regression tests for the explicit UPI handle-prefix look-alike path (audit 2026-10-05, Fix 7).
//
// Before: a dotted UPI name such as "sbi.kyc.refund@okaxis" was accidentally extracted
// as the URL "sbi.kyc.refund", and that fake URL was the only thing sending the
// handle to brand-impersonation / look-alike analysis. Now the host-like part before
// "@" is reported as `upiHandlePrefixes` and routed to the same existing analysis
// explicitly, and it is no longer listed as a URL. Detection must be unchanged:
// verdicts, risk scores, impersonation hits and URL findings are pinned to 43ff8ce.
// (The UPI regex itself, including its known email false positives, is unchanged.)
//
// Offline and side-effect free: REAL quick-check route and REAL analyzeScreenshot
// with OCR pre-seeded in the in-memory cache; every fetch fails the test. All inputs
// are synthetic.
//
// Run: node --test --import ./eval/hooks.mjs eval/scamcheck-upi-handle-prefix.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

for (const k of Object.keys(process.env)) {
  if (/^(FIREBASE|STORE_FILE|VERTEX|GOOGLE_|GCP_|BIGQUERY|GEMINI|RESEND|UPSTASH|KV_)/.test(k)) delete process.env[k]
}
process.env.LOG_LEVEL = 'error'

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const imp = (p) => import(pathToFileURL(B + p).href)

const fetchCalls = []
globalThis.fetch = async (url) => { fetchCalls.push(String(url)); throw new Error(`network blocked in test: ${url}`) }

const { setStore } = await imp('lib/store/adapter.ts')
const { MemoryStore } = await imp('lib/store/memory-store.ts')
setStore(new MemoryStore())
const { setCached } = await imp('lib/ai/cache.ts')
const { analyzeScreenshot } = await imp('lib/scam-intel/multimodal.ts')
const { extractEntities } = await imp('lib/scam-intel/extract-entities.ts')
const { applyReputation, upiReputation } = await imp('lib/scam-intel/reputation.ts')
const { POST } = await imp('app/api/scam-intel/quick-check/route.ts')

let n = 0
async function quickCheck(type, value) {
  n++
  const res = await POST(new Request('http://localhost/api/scam-intel/quick-check', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': `10.96.${(n >> 8) & 255}.${n & 255}` },
    body: JSON.stringify({ type, value }),
  }))
  assert.equal(res.status, 200, `HTTP ${res.status} for ${type}:${value}`)
  return res.json()
}
async function screenshot(text) {
  n++
  const b64 = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]), Buffer.from(`upipfx-${n}`)]).toString('base64')
  await setCached(`ocr:${createHash('sha256').update(b64).digest('hex').slice(0, 32)}`, 'ocr', { text, words: [], engine: 'seeded', lang: 'en' }, 3_600_000)
  return analyzeScreenshot(b64, 'image/png')
}

// ── Look-alike handles: detection pinned to 43ff8ce ──────────────────────
// [handle, look-alike brand, technique, screenshot verdict/risk for "pay to <handle>" — Fix 7 screenshot impersonation check; was 70/26/26/26 at 43ff8ce]
const LOOKALIKE = [
  ['sbi.kyc.refund@okaxis', 'sbi', 'deceptive-subdomain', 'likely_scam', 84],
  ['paytm.care@okaxis', 'paytm', 'wrong-tld', 'needs_review', 40],
  ['sbi.help@okaxis', 'sbi', 'wrong-tld', 'needs_review', 40],
  ['paytm.support@okaxis', 'paytm', 'wrong-tld', 'suspicious', 40],
]
for (const [handle, brand, technique, shotVerdict, shotRisk] of LOOKALIKE) {
  const prefix = handle.slice(0, handle.indexOf('@'))
  test(`extraction: ${handle} is a UPI ID with handle prefix ${prefix}, not a URL`, () => {
    const e = extractEntities(`pay to ${handle}`)
    assert.deepEqual(e.upiIds, [handle])
    assert.deepEqual(e.upiHandlePrefixes, [prefix])
    assert.deepEqual(e.urls, [], 'the handle prefix must not be listed as a link')
  })
  test(`quick-check (upi): ${handle} stays likely_scam/85 via the explicit prefix path`, async () => {
    const d = await quickCheck('upi', handle)
    assert.equal(d.verdict, 'likely_scam'); assert.equal(d.riskScore, 85); assert.equal(d.trusted, false)
    assert.ok(d.impersonation.some((i) => i.host === prefix && i.brand === brand && i.techniques.includes(technique)), JSON.stringify(d.impersonation))
    assert.ok(d.urlFindings.some((f) => f.host === prefix && f.risks.includes(`brand_lookalike:${brand}`)))
    assert.deepEqual(d.entities.urls, [])
  })
  test(`quick-check (message): pay to ${handle} stays likely_scam/85`, async () => {
    const d = await quickCheck('message', `pay to ${handle}`)
    assert.equal(d.verdict, 'likely_scam'); assert.equal(d.riskScore, 85)
  })
  test(`screenshot: pay to ${handle} keeps its look-alike finding and risk`, async () => {
    const v = await screenshot(`pay to ${handle}`)
    assert.equal(v.verdict, shotVerdict); assert.equal(v.riskScore, shotRisk)
    assert.ok(v.urlFindings.some((f) => f.host === prefix && f.risks.includes(`brand_lookalike:${brand}`)))
    assert.ok(v.explainability.evidence.some((x) => x.startsWith(`Risky URL ${prefix}`)))
  })
}

test('a real link next to a UPI ID is still a URL; only the handle prefix moves', () => {
  const e = extractEntities('Pay Rs 10 to sbi.kyc.refund@okaxis. Official site https://www.sbi.co.in')
  assert.deepEqual(e.urls, ['https://www.sbi.co.in'])
  assert.deepEqual(e.upiHandlePrefixes, ['sbi.kyc.refund'])
})
test('valid UPI IDs are still extracted; undotted names produce no prefix', () => {
  for (const id of ['ramesh.kumar@okaxis', 'priya_sharma@oksbi', 'anil-traders@okhdfcbank', 'meera@ibl', 'raj@upi', 'rahul@axl', 'user@okaxis', 'merchant@paytm']) {
    for (const p of ['.', ',', ')', '!', ';', '?']) assert.deepEqual(extractEntities(`Pay to ${id}${p}`).upiIds, [id], `${id}${p}`)
  }
  assert.deepEqual(extractEntities('pay to anil-traders@okhdfcbank').upiHandlePrefixes, [])
  assert.deepEqual(extractEntities('pay to ramesh.kumar@okaxis').upiHandlePrefixes, ['ramesh.kumar'])
})
test('ordinary emails keep their domain as a URL and get no UPI handle prefix', () => {
  const e = extractEntities('Reply to support@example.com or priya.sharma@gmail.com')
  assert.deepEqual(e.upiIds, []); assert.deepEqual(e.upiHandlePrefixes, [])
  assert.ok(e.urls.includes('example.com') && e.urls.includes('gmail.com'))
})

// ── Trust invariants ─────────────────────────────────────────────────────
test('UPI never grants trust, lowers risk, or creates likely_safe', async () => {
  for (const id of ['ramesh.kumar@okaxis', 'sbi@oksbi', 'merchant@paytm', 'support@asquaresolution.com', 'sbi.kyc.refund@okaxis']) {
    const d = await quickCheck('upi', id)
    assert.equal(d.trusted, false, id); assert.notEqual(d.verdict, 'likely_safe', id)
  }
  const d = await quickCheck('message', 'Pay Rs 10 to sbi.kyc.refund@okaxis. Official site https://www.sbi.co.in')
  assert.equal(d.verdict, 'likely_scam'); assert.equal(d.riskScore, 85); assert.equal(d.trusted, false)
  assert.equal(upiReputation('user@okaxis').reputation, 'known')
  for (const risk of [0, 20, 50]) {
    const r = applyReputation(risk, { upiIds: ['user@okaxis', 'merchant@paytm'] })
    assert.equal(r.risk, risk); assert.equal(r.trusted, false)
  }
})

test('no network calls were attempted', () => {
  assert.deepEqual(fetchCalls, [])
})
