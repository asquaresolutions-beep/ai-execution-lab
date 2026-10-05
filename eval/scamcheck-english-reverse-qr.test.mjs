// eval/scamcheck-english-reverse-qr.test.mjs
//
// Regression tests for English reverse-QR scam detection (audit 2026-10-05).
//
// Bug: "Your cashback of Rs 2000 is pending. Scan this QR to receive it." scored
// unclear/34 (quick-check) and unclear/26 (screenshot). Scanning a QR SENDS money,
// but the only matching detector (fake_payment) counts once and has no risk floor,
// and Fix 5's upi_reverse_payment patterns were Hindi/Hinglish only. The fix adds an
// English pattern to upi_reverse_payment: an imperative "scan (this) QR" tied to
// receiving money ("to receive it", "to claim your cashback", or "To receive your
// refund, scan this QR"), never after a negation or a third-party "ask you to".
// "Scan the QR to pay / get the menu / download the app" must not match.
//
// Both paths are exercised: the REAL quick-check route and the REAL analyzeScreenshot
// with OCR pre-seeded in the in-memory cache (no Vision/Vertex/BigQuery). Every fetch
// fails the test. All inputs are synthetic. "head" values are commit 269e45b.
//
// Run: node --test --import ./eval/hooks.mjs eval/scamcheck-english-reverse-qr.test.mjs

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
const { POST } = await imp('app/api/scam-intel/quick-check/route.ts')

let n = 0
async function quickCheck(value) {
  n++
  const res = await POST(new Request('http://localhost/api/scam-intel/quick-check', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': `10.97.${(n >> 8) & 255}.${n & 255}` },
    body: JSON.stringify({ type: 'message', value }),
  }))
  assert.equal(res.status, 200, `HTTP ${res.status} for ${value}`)
  return res.json()
}
// A unique fake PNG per call; its OCR result is pre-seeded under the module's own
// `ocr:<sha256[0..32]>` cache key, so analyzeScreenshot never calls an OCR provider.
async function screenshot(text) {
  n++
  const b64 = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]), Buffer.from(`enqr-${n}`)]).toString('base64')
  await setCached(`ocr:${createHash('sha256').update(b64).digest('hex').slice(0, 32)}`, 'ocr', { text, words: [], engine: 'seeded', lang: 'en' }, 3_600_000)
  return analyzeScreenshot(b64, 'image/png')
}
const ids = (signals) => signals.map((s) => s.id)

// ── Reverse-QR scams: detected on BOTH paths ─────────────────────────────
// [label, text, qc head risk, qc verdict, qc risk, shot head risk, shot verdict, shot risk]
const POSITIVE = [
  ['pending cashback', 'Your cashback of Rs 2000 is pending. Scan this QR to receive it.', 34, 'suspicious', 62, 26, 'suspicious', 40],
  ['approved refund', 'Refund of Rs 2000 approved. Scan this QR to receive it.', 34, 'suspicious', 62, 26, 'suspicious', 40],
  ['received refund, claim it', 'You have received a refund of Rs 499. Scan the QR to claim it.', 28, 'suspicious', 56, 23, 'suspicious', 37],
  ['prize money', 'Scan this QR to receive your Rs 5000 prize money', 46, 'likely_scam', 74, 58, 'likely_scam', 78],
  ['purpose first', 'To receive your refund, scan this QR code.', 34, 'suspicious', 62, 26, 'suspicious', 40],
  ['attached QR, payment', 'Please scan the attached QR code to get your payment of Rs 1500.', 6, 'suspicious', 55, 12, 'unclear', 33],
  ['marketplace buyer', 'I am sending money for the bike. Scan this QR and receive the amount.', 34, 'suspicious', 62, 26, 'suspicious', 40],
  ['QR below, cashback', 'Scan the QR code below to claim your cashback.', 34, 'suspicious', 62, 26, 'suspicious', 40],
  ['OLX advance', 'OLX buyer: scan my QR code to receive Rs 8000 advance.', 6, 'suspicious', 55, 12, 'unclear', 33],
  ['awareness then request', 'Never scan a QR from strangers. Scan this QR to receive your refund.', 34, 'suspicious', 62, 26, 'suspicious', 40],
]
for (const [label, text, qcHead, qcVerdict, qcRisk, shotHead, shotVerdict, shotRisk] of POSITIVE) {
  test(`quick-check detects reverse QR: ${label}`, async () => {
    const d = await quickCheck(text)
    assert.ok(ids(d.signals).includes('upi_reverse_payment'), `signals: ${ids(d.signals)}`)
    assert.equal(d.verdict, qcVerdict); assert.equal(d.riskScore, qcRisk)
    assert.ok(d.riskScore > qcHead && d.riskScore >= 35)
    assert.equal(d.trusted, false)
    assert.ok(d.advice.includes('Receiving money on UPI never needs a PIN or QR scan.'))
  })
  test(`screenshot detects reverse QR: ${label}`, async () => {
    const v = await screenshot(text)
    assert.ok(ids(v.visualSignals).includes('upi_reverse_payment'), `signals: ${ids(v.visualSignals)}`)
    assert.notEqual(v.verdict, 'likely_safe')
    assert.equal(v.verdict, shotVerdict); assert.equal(v.riskScore, shotRisk)
    assert.ok(v.riskScore > shotHead, 'screenshot risk must not be lower than before the fix')
  })
}

// ── Benign / awareness: identical to head, no new signal ──────────────────
// [label, text, qc verdict, qc risk, shot verdict, shot risk]
const BENIGN = [
  ['never scan to receive', 'Never scan a QR code to receive money', 'unclear', 6, 'unclear', 12],
  ['do not scan for a refund', 'Do not scan any QR code to receive a refund.', 'unclear', 6, 'unclear', 12],
  ["don't need to scan", "You don't need to scan a QR code to receive money.", 'unclear', 6, 'unclear', 12],
  ['scammers ask you to scan', "Scammers ask you to scan a QR code to receive money. Don't fall for it.", 'unclear', 6, 'unclear', 12],
  ['no one will ask you to scan', 'No one will ever ask you to scan a QR to receive a payment.', 'unclear', 0, 'unclear', 9],
  ['"scanning" (not imperative)', 'Scanning a QR code never gives you money - it only sends money.', 'unclear', 6, 'unclear', 12],
  ['scan to pay a bill', 'Scan the QR code to pay your electricity bill.', 'unclear', 34, 'unclear', 26],
  ['scan for the menu', 'Scan the QR code on the table to get the menu.', 'unclear', 34, 'unclear', 26],
  ['scan to download an app, discount', 'Scan this QR to download our app and get 10% off.', 'unclear', 34, 'unclear', 26],
  ['scan at the counter to pay', 'Scan the QR at the counter to pay Rs 250.', 'unclear', 28, 'unclear', 23],
  ['scan to check in', 'Scan this QR code to check in for your flight.', 'unclear', 34, 'unclear', 26],
  ['UPI awareness', 'Receiving money on UPI never needs a QR scan or PIN.', 'unclear', 0, 'needs_review', 41],
]
for (const [label, text, qcVerdict, qcRisk, shotVerdict, shotRisk] of BENIGN) {
  test(`benign unchanged: ${label}`, async () => {
    const d = await quickCheck(text)
    assert.equal(d.verdict, qcVerdict); assert.equal(d.riskScore, qcRisk)
    assert.ok(!ids(d.signals).includes('upi_reverse_payment'), 'upi_reverse_payment fired on benign text')
    const v = await screenshot(text)
    assert.equal(v.verdict, shotVerdict); assert.equal(v.riskScore, shotRisk)
    assert.ok(!ids(v.visualSignals).includes('upi_reverse_payment'), 'upi_reverse_payment fired on benign screenshot')
  })
}

test('no network calls were attempted', () => {
  assert.deepEqual(fetchCalls, [])
})
