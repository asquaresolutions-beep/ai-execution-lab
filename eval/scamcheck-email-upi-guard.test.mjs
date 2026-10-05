// eval/scamcheck-email-upi-guard.test.mjs
//
// Regression tests for the UPI email guard + screenshot brand-impersonation signal
// (audit 2026-10-05, Fix 7).
//
// 1. The UPI regex matched the start of email domains: care@sbi.co.in → UPI "care@sbi",
//    adding false UPI risk/advice/evidence. The handle must now not be followed by more
//    handle characters or by ".tld"; sentence punctuation after a real UPI ID still works.
// 2. On screenshots, a look-alike email domain (kyc-team@sbi-support.in) only reached
//    scoring as a +10 risky URL; quick-check's detectImpersonations never ran there, so
//    removing the false UPI made the screenshot safer (likely_scam/70 → needs_review/67).
//    The screenshot analyzer now runs the SAME detectImpersonations over links, UPI handle
//    prefixes and email addresses, as one `brand_impersonation` signal at the existing
//    weights (danger 28 / warn 12). No floor, no weight change.
//
// "before" values are commit b027990. Offline: REAL quick-check route and REAL
// analyzeScreenshot with OCR pre-seeded in the in-memory cache; every fetch fails the
// test. All inputs are synthetic.
//
// Run: node --test --import ./eval/hooks.mjs eval/scamcheck-email-upi-guard.test.mjs

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
const { POST } = await imp('app/api/scam-intel/quick-check/route.ts')

let n = 0
async function quickCheck(type, value) {
  n++
  const res = await POST(new Request('http://localhost/api/scam-intel/quick-check', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': `10.95.${(n >> 8) & 255}.${n & 255}` },
    body: JSON.stringify({ type, value }),
  }))
  assert.equal(res.status, 200, `HTTP ${res.status} for ${type}:${value}`)
  return res.json()
}
async function screenshot(text) {
  n++
  const b64 = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]), Buffer.from(`emailguard-${n}`)]).toString('base64')
  await setCached(`ocr:${createHash('sha256').update(b64).digest('hex').slice(0, 32)}`, 'ocr', { text, words: [], engine: 'seeded', lang: 'en' }, 3_600_000)
  return analyzeScreenshot(b64, 'image/png')
}
const ids = (signals) => signals.map((s) => s.id)

// ── C. Email addresses no longer produce UPI IDs ─────────────────────────
test('emails at bank/PSP domains are not UPI IDs (incl. trailing punctuation)', () => {
  for (const email of ['care@sbi.co.in', 'alerts@sbi.co.in', 'alerts@icici.co.in', 'accounts@icici.co.in', 'care@icici.co.in', 'help@paytm.com', 'kyc-team@sbi-support.in', 'support@sbi-kyc.in', 'alerts@paytm-refund.top']) {
    for (const p of ['', '.', ',', ')', '!', ';', '?']) assert.deepEqual(extractEntities(`Write to ${email}${p} today`).upiIds, [], `${email}${p}`)
  }
})
// ── E. Valid UPI IDs are unchanged ────────────────────────────────────────
test('valid UPI IDs are still extracted, with sentence punctuation', () => {
  for (const id of ['user@okaxis', 'merchant@paytm', 'rahul@axl', 'ramesh.kumar@okaxis', 'priya_sharma@oksbi', 'anil-traders@okhdfcbank', 'meera@ibl', 'raj@upi']) {
    for (const p of ['', '.', ',', ')', '!', ';', '?']) assert.deepEqual(extractEntities(`Pay to ${id}${p}`).upiIds, [id], `${id}${p}`)
  }
})
test('no new UPI handles were added (fam/kotak/pthdfc still not extracted)', () => {
  for (const id of ['neha@fam', 'vikas@kotak', 'sunita@pthdfc']) assert.deepEqual(extractEntities(`Pay to ${id}`).upiIds, [], id)
})

// ── A. Look-alike emails keep (or gain) detection ─────────────────────────
// [label, type, value, qc verdict/risk, shot verdict/risk, shot before (b027990)]
const LOOKALIKE = [
  ['E2 bare look-alike email', 'email', 'kyc-team@sbi-support.in', 'suspicious', 60, 'likely_scam', 73, 70],
  ['look-alike email sbi-kyc.in', 'email', 'support@sbi-kyc.in', 'suspicious', 60, 'likely_scam', 73, 70],
  ['look-alike email in a short message', 'message', 'Contact kyc-team@sbi-support.in', 'suspicious', 60, 'likely_scam', 73, 70],
  ['KYC message with look-alike email', 'message', 'Your SBI KYC is pending. Reply to kyc-team@sbi-support.in today or your account will be blocked.', 'suspicious', 60, 'likely_scam', 82, 79],
  ['look-alike email sbi-co.in', 'email', 'care@sbi-co.in', 'suspicious', 60, 'needs_review', 29, 26],
]
for (const [label, type, value, qcV, qcR, shotV, shotR, shotBefore] of LOOKALIKE) {
  test(`look-alike stays detected: ${label}`, async () => {
    const d = await quickCheck(type, value)
    assert.equal(d.verdict, qcV); assert.equal(d.riskScore, qcR); assert.equal(d.trusted, false)
    assert.ok(ids(d.signals).includes('brand_impersonation'))
    assert.deepEqual(d.entities.upiIds, [], 'no false UPI')
    const v = await screenshot(value)
    assert.ok(ids(v.visualSignals).includes('brand_impersonation'), `screenshot signals: ${ids(v.visualSignals)}`)
    assert.equal(v.verdict, shotV); assert.equal(v.riskScore, shotR)
    assert.ok(v.riskScore >= shotBefore, 'screenshot must not be safer than before the fix')
  })
}
test('known gap (unchanged): onlinesbi-verify.com is not an impersonation hit', async () => {
  const d = await quickCheck('email', 'alerts@onlinesbi-verify.com')
  assert.equal(d.verdict, 'unclear'); assert.equal(d.riskScore, 10)
  const v = await screenshot('alerts@onlinesbi-verify.com')
  assert.equal(v.verdict, 'unclear'); assert.equal(v.riskScore, 14)
  assert.ok(!ids(v.visualSignals).includes('brand_impersonation'))
})

// ── B. Legitimate addresses: no impersonation hit; only the false-UPI +6/+3 goes ──
// [type, value, qc verdict/risk, shot verdict/risk]
const LEGIT = [
  ['email', 'care@sbi.co.in', 'likely_safe', 12, 'needs_review', 18],
  ['email', 'alerts@sbi.co.in', 'likely_safe', 12, 'needs_review', 18],
  ['email', 'care@icici.co.in', 'unclear', 12, 'needs_review', 18],
  ['email', 'alerts@icici.co.in', 'unclear', 12, 'needs_review', 18],
  ['email', 'help@paytm.com', 'likely_safe', 12, 'needs_review', 18],
  ['message', 'For help write to care@sbi.co.in or call the branch.', 'unclear', 12, 'unclear', 18],
  ['message', 'Mail your statement to accounts@icici.co.in by Friday.', 'unclear', 12, 'unclear', 18],
  ['message', 'Contact help@paytm.com for wallet issues.', 'unclear', 12, 'unclear', 18],
]
for (const [type, value, qcV, qcR, shotV, shotR] of LEGIT) {
  test(`legitimate address: ${value}`, async () => {
    const d = await quickCheck(type, value)
    assert.equal(d.verdict, qcV); assert.equal(d.riskScore, qcR)
    assert.deepEqual(d.entities.upiIds, []); assert.ok(!ids(d.signals).includes('brand_impersonation'))
    const v = await screenshot(value)
    assert.equal(v.verdict, shotV); assert.equal(v.riskScore, shotR)
    assert.ok(!ids(v.visualSignals).includes('brand_impersonation'), 'official domain must not be a look-alike')
    assert.deepEqual(v.entities.upiIds, [])
  })
}

// ── Documented corrections from removing the false UPI ───────────────────
test('CQ3: reverse-QR + care@sbi.co.in is suspicious/68 (was likely_scam/74 only via the false UPI)', async () => {
  const d = await quickCheck('message', 'Refund approved. Scan the QR to claim it. For help mail care@sbi.co.in')
  assert.equal(d.verdict, 'suspicious'); assert.equal(d.riskScore, 68)
  assert.ok(ids(d.signals).includes('upi_reverse_payment'))
})
test('H12: KYC scam keeps its tier without the false UPI (suspicious/36, screenshot likely_scam/73)', async () => {
  const text = 'Dear customer, your SBI YONO account will be blocked today. Update PAN at https://yono-kyc-portal.in/update or contact care@sbi.co.in'
  const d = await quickCheck('message', text)
  assert.equal(d.verdict, 'suspicious'); assert.equal(d.riskScore, 36)
  const v = await screenshot(text)
  assert.equal(v.verdict, 'likely_scam'); assert.equal(v.riskScore, 73)
})

// ── D. UPI look-alike handles: quick-check unchanged, screenshot stronger ──
// [handle, screenshot verdict/risk for "pay to <handle>", before]
const HANDLES = [
  ['sbi.kyc.refund@okaxis', 'likely_scam', 84, 70],
  ['paytm.care@okaxis', 'needs_review', 40, 26],
  ['sbi.help@okaxis', 'needs_review', 40, 26],
  ['paytm.support@okaxis', 'suspicious', 40, 26],
]
for (const [handle, shotV, shotR, before] of HANDLES) {
  test(`UPI look-alike handle ${handle}: quick-check likely_scam/85, screenshot not lower`, async () => {
    const d = await quickCheck('upi', handle)
    assert.equal(d.verdict, 'likely_scam'); assert.equal(d.riskScore, 85)
    const v = await screenshot(`pay to ${handle}`)
    assert.equal(v.verdict, shotV); assert.equal(v.riskScore, shotR); assert.ok(v.riskScore > before)
    assert.ok(ids(v.visualSignals).includes('brand_impersonation'))
  })
}

// ── G. Screenshot look-alike URLs now match quick-check's impersonation check ──
// [url, qc verdict/risk, shot verdict/risk, shot before]
const URLS = [
  ['https://sbi-support.in/kyc', 'suspicious', 60, 'likely_scam', 75, 69],
  ['https://sbi.co.in.evil.example/', 'likely_scam', 85, 'suspicious', 37, 23],
]
for (const [url, qcV, qcR, shotV, shotR, before] of URLS) {
  test(`look-alike URL on screenshots: ${url}`, async () => {
    const d = await quickCheck('link', url)
    assert.equal(d.verdict, qcV); assert.equal(d.riskScore, qcR)
    const v = await screenshot(url)
    assert.ok(ids(v.visualSignals).includes('brand_impersonation'))
    assert.equal(v.verdict, shotV); assert.equal(v.riskScore, shotR); assert.ok(v.riskScore > before)
  })
}

// ── H. Legitimate screenshot controls: unchanged, no brand_impersonation ──
const LEGIT_SHOTS = [
  ['https://www.sbi.co.in', 'needs_review', 18],
  ['Your SBI account statement for September is ready. View it in the YONO app.', 'unclear', 18],
  ['Hi, are we still meeting for lunch tomorrow at 1pm?', 'unclear', 9],
  ['Get 10% cashback on Amazon Pay UPI this weekend. T&C apply. See amazon.in/offers', 'needs_review', 48],
]
for (const [text, verdict, risk] of LEGIT_SHOTS) {
  test(`legitimate screenshot unchanged: ${text.slice(0, 40)}`, async () => {
    const v = await screenshot(text)
    assert.equal(v.verdict, verdict); assert.equal(v.riskScore, risk)
    assert.ok(!ids(v.visualSignals).includes('brand_impersonation'))
    assert.notEqual(v.verdict, 'likely_safe')
  })
}

test('a screenshot result cached under the pre-fix key (v4) is not served', async () => {
  const text = 'kyc-team@sbi-support.in'
  n++
  const b64 = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]), Buffer.from(`emailguard-cache-${n}`)]).toString('base64')
  const hash = createHash('sha256').update(b64).digest('hex').slice(0, 32)
  await setCached(`ocr:${hash}`, 'ocr', { text, words: [], engine: 'seeded', lang: 'en' }, 3_600_000)
  await setCached(`screenshot:v4:${hash}:std`, 'screenshot', { verdict: 'needs_review', riskScore: 67 }, 3_600_000)
  const v = await analyzeScreenshot(b64, 'image/png')
  assert.notEqual(v.cached, true, 'stale pre-fix result was served from cache')
  assert.equal(v.verdict, 'likely_scam'); assert.equal(v.riskScore, 73)
})

test('no network calls were attempted', () => {
  assert.deepEqual(fetchCalls, [])
})
