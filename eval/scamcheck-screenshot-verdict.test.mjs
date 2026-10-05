// eval/scamcheck-screenshot-verdict.test.mjs
//
// Regression tests for the screenshot analyzer's fail-closed verdict
// (audit 2026-10-05, P0).
//
// Bug: analyzeScreenshot() returned `likely_safe` for ANY screenshot with OCR text
// and risk < 35, so a scam the deterministic detectors missed — e.g. the Hinglish
// reverse-QR message below — was shown as a green "Likely safe". Same principle as
// the quick-check Fix 1A: absence of evidence is not evidence of safety. Screenshots
// have no trusted-entity path, so below the suspicious threshold the verdict is
// `unclear`. needs_review, suspicious and likely_scam are unchanged. Verdicts cached
// under the old key must not be served after the fix (cache key bumped).
//
// Offline and side-effect free: REAL analyzeScreenshot with OCR pre-seeded in the
// in-memory cache (no Vision/Vertex/BigQuery), every fetch fails the test.
// All inputs are synthetic.
//
// Run: node --test --import ./eval/hooks.mjs eval/scamcheck-screenshot-verdict.test.mjs

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

// A unique fake PNG per call; its OCR result is pre-seeded under the module's own
// `ocr:<sha256[0..32]>` cache key, so analyzeScreenshot never calls an OCR provider.
let n = 0
function fakeImage() {
  n++
  const b64 = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]), Buffer.from(`shot-${n}`)]).toString('base64')
  return { b64, hash: createHash('sha256').update(b64).digest('hex').slice(0, 32) }
}
async function analyzeText(text) {
  const { b64, hash } = fakeImage()
  await setCached(`ocr:${hash}`, 'ocr', { text, words: [], engine: 'seeded', lang: 'en' }, 3_600_000)
  return analyzeScreenshot(b64, 'image/png')
}

// 1–2: below threshold with OCR text → unclear (were likely_safe), risk unchanged.
const BELOW = [
  ['reverse-QR Hinglish scam', 'Sir galti se 5000 bhej diya, QR code scan karke wapas bhej do', 12],
  ['benign lunch message', 'Hi, lunch at 1pm tomorrow?', 9],
  ['unknown-UPI payment request', 'pay to refund.desk@ybl to get your money back', 12],
  ['benign statement notice', 'Your SBI account statement for September is ready. View it in the YONO app.', 18],
]
for (const [id, text, risk] of BELOW) {
  test(`below threshold → unclear, never likely_safe: ${id}`, async () => {
    const v = await analyzeText(text)
    assert.notEqual(v.verdict, 'likely_safe')
    assert.equal(v.verdict, 'unclear')
    assert.equal(v.riskScore, risk, 'detector scoring must be unchanged')
  })
}

// 3–6: everything else unchanged from HEAD ca66ff2.
const UNCHANGED = [
  ['suspicious: merchant cashback', 'Congratulations! You received cashback of Rs 50 on your Swiggy order via PhonePe.', 'suspicious', 38],
  ['suspicious: QR prize', 'Scan this QR to receive your Rs 5000 prize money', 'suspicious', 58],
  ['likely_scam: KYC threat with link', 'Dear customer your SBI account will be blocked today. Update PAN at https://yono-kyc-portal.in or mail care@sbi.co.in', 'likely_scam', 76],
  ['likely_scam: KYC reply request', 'Your HDFC account will be suspended today. Update KYC by replying with your Aadhaar and PAN. Ref hdfcbank.com', 'likely_scam', 71],
  ['needs_review: Hinglish OTP request', 'OTP de do sir, verification ke liye chahiye', 'needs_review', 41],
  ['needs_review: short text (<25 chars)', 'Hi lunch 1pm?', 'needs_review', 9],
  ['needs_review: empty OCR text', '', 'needs_review', 8],
  ['unclear: whitespace-only OCR text', '                              ', 'unclear', 8],
]
for (const [id, text, verdict, risk] of UNCHANGED) {
  test(`unchanged: ${id} → ${verdict}/${risk}`, async () => {
    const v = await analyzeText(text)
    assert.equal(v.verdict, verdict); assert.equal(v.riskScore, risk)
  })
}

test('no screenshot verdict is likely_safe (no trusted basis exists for screenshots)', async () => {
  for (const [, text] of [...BELOW, ...UNCHANGED]) assert.notEqual((await analyzeText(text)).verdict, 'likely_safe', text)
})

test('a verdict cached under the pre-fix key is not served', async () => {
  const { b64, hash } = fakeImage()
  const text = 'Sir galti se 5000 bhej diya, QR code scan karke wapas bhej do'
  await setCached(`ocr:${hash}`, 'ocr', { text, words: [], engine: 'seeded', lang: 'en' }, 3_600_000)
  // Simulate a stale green result stored by the previous code under the old key.
  await setCached(`screenshot:v2:${hash}:std`, 'screenshot', { verdict: 'likely_safe', riskScore: 12 }, 3_600_000)
  const v = await analyzeScreenshot(b64, 'image/png')
  assert.notEqual(v.cached, true, 'stale pre-fix verdict was served from cache')
  assert.equal(v.verdict, 'unclear')
})

test('no network calls were attempted', () => {
  assert.deepEqual(fetchCalls, [])
})
