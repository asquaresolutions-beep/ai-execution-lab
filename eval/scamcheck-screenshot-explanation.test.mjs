// eval/scamcheck-screenshot-explanation.test.mjs
//
// Regression tests for screenshot explanations that contradict the verdict
// (audit 2026-10-05, Fix 8C).
//
// Bug: analyzeScreenshot() returned the trust model's own explanation, written for
// ITS text-only verdict. When that verdict was `safe` but the final screenshot
// verdict was not, the card read e.g. "Suspicious" + "No strong scam signals
// detected." (Swiggy cashback). The fix shows the final verdict's own reason
// (explainability.whyFlagged) in that case, makes the `unclear` reason say that
// absence of evidence is not safety, and bumps the screenshot cache key so cached
// contradictory explanations are not served. Verdicts, risk and signals unchanged.
//
// Offline and side-effect free: REAL analyzeScreenshot with OCR pre-seeded in the
// in-memory cache (no Vision/Vertex/BigQuery), every fetch fails the test. Where a
// live trust model is needed, its result is pre-seeded in its own cache. All inputs
// are synthetic.
//
// Run: node --test --import ./eval/hooks.mjs eval/scamcheck-screenshot-explanation.test.mjs

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
const { setCached, cacheKey } = await imp('lib/ai/cache.ts')
const { analyzeScreenshot, screenshotExplanation } = await imp('lib/scam-intel/multimodal.ts')
const { computeTrustScore } = await imp('lib/scam-intel/trustscore.ts')

// A unique fake PNG per call; its OCR result is pre-seeded under the module's own
// `ocr:<sha256[0..32]>` cache key, so analyzeScreenshot never calls an OCR provider.
let n = 0
async function seedImage(text) {
  n++
  const b64 = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]), Buffer.from(`expl-${n}`)]).toString('base64')
  const hash = createHash('sha256').update(b64).digest('hex').slice(0, 32)
  await setCached(`ocr:${hash}`, 'ocr', { text, words: [], engine: 'seeded', lang: 'en' }, 3_600_000)
  return { b64, hash }
}
async function analyzeText(text) { return analyzeScreenshot((await seedImage(text)).b64, 'image/png') }

const REASSURING = /no strong scam signals|not a scam|looks (safe|genuine|legitimate)/i
const WHY = {
  likely_scam: 'Multiple fraud indicators with corroborating evidence.',
  suspicious: 'Some fraud indicators detected; treat with caution.',
  needs_review: 'Insufficient/low-confidence evidence — manual review recommended.',
  unclearSignals: 'Some risk signals were found, but not enough for a clear verdict — treat with caution.',
  unclearNone: 'No clear scam signals were found, but this does not prove the message is safe.',
}

// 1. suspicious screenshot whose trust model says safe (the reproduced bug).
test('suspicious + trust model safe: explanation is the suspicious reason, not reassurance', async () => {
  const text = 'Congratulations! You received cashback of Rs 50 on your Swiggy order via PhonePe.'
  assert.equal((await computeTrustScore(text)).verdict, 'safe', 'precondition: trust model calls the text safe')
  const v = await analyzeText(text)
  assert.equal(v.verdict, 'suspicious'); assert.equal(v.riskScore, 38)
  assert.doesNotMatch(v.explanation, REASSURING)
  assert.equal(v.explanation, WHY.suspicious)
  assert.equal(v.explanation, v.explainability.whyFlagged)
})

// 2. likely_scam screenshot whose trust model says safe. Offline, a trust-model
// `safe` can only reach likely_scam through live deep vision, so the trust model's
// result is pre-seeded to simulate a divergent live (AI) trust model.
test('likely_scam + trust model safe: explanation is the likely_scam reason', async () => {
  const text = 'Dear customer your SBI account will be blocked today. Update PAN at https://yono-kyc-portal.in or mail care@sbi.co.in'
  await setCached(cacheKey('trustscore', { text }), 'trustscore', {
    input: text, inputType: 'text', trustScore: 20, scamProbability: 0.8, verdict: 'safe', category: 'other', confidence: 0.5,
    signals: [], tactics: [], explanation: 'This looks like a genuine bank notice and is not a scam.', model: 'seeded',
  }, 3_600_000)
  const v = await analyzeText(text)
  assert.equal(v.verdict, 'likely_scam')
  assert.doesNotMatch(v.explanation, REASSURING)
  assert.equal(v.explanation, WHY.likely_scam)
  assert.equal(v.explanation, v.explainability.whyFlagged)
})

test('selection rule: a trust-model `safe` explanation is replaced for every non-safe verdict', () => {
  const tsText = 'No strong scam signals detected. Never share OTP, UPI PIN, or card details.'
  for (const verdict of ['likely_scam', 'suspicious', 'needs_review', 'unclear']) {
    assert.equal(screenshotExplanation('safe', verdict, `why:${verdict}`, tsText), `why:${verdict}`)
  }
  // A genuinely safe verdict keeps the trust model's benign explanation.
  assert.equal(screenshotExplanation('safe', 'likely_safe', 'why', tsText), tsText)
  // A non-safe trust model already explains a risk — its explanation is kept.
  for (const ts of ['caution', 'likely_scam', 'high_risk']) assert.equal(screenshotExplanation(ts, 'suspicious', 'why', 'Likely phishing.'), 'Likely phishing.')
  // No trust model result (short text / failure): the heuristic explanation is kept.
  assert.equal(screenshotExplanation(null, 'needs_review', 'why', 'Heuristic assessment from extracted text.'), 'Heuristic assessment from extracted text.')
})

// 3. Benign low-risk screenshot: calm, but never claims safety (P0: no likely_safe).
test('benign low-risk screenshot: unclear with a calm reason that does not claim safety', async () => {
  const v = await analyzeText('Hi, are we still meeting for lunch tomorrow at 1pm?')
  assert.equal(v.verdict, 'unclear'); assert.equal(v.riskScore, 9)
  assert.equal(v.explanation, WHY.unclearNone)
  assert.doesNotMatch(v.explanation, REASSURING)
})

// 4. unclear / needs_review stay coherent.
test('unclear with a detected signal does not claim no signals were found', async () => {
  const v = await analyzeText('Sir galti se 5000 bhej diya, QR code scan karke wapas bhej do')
  assert.equal(v.verdict, 'unclear'); assert.equal(v.riskScore, 33)
  assert.ok(v.visualSignals.some((s) => s.id === 'upi_reverse_payment'))
  assert.equal(v.explanation, WHY.unclearSignals)
})
test('needs_review + trust model safe: explanation is the needs_review reason', async () => {
  const v = await analyzeText('Hi lunch 1pm?')
  assert.equal(v.verdict, 'needs_review'); assert.equal(v.riskScore, 9)
  assert.equal(v.explanation, WHY.needs_review)
})
test('needs_review + trust model not safe: the trust model risk explanation is kept', async () => {
  const v = await analyzeText('OTP de do sir, verification ke liye chahiye')
  assert.equal(v.verdict, 'needs_review'); assert.equal(v.riskScore, 46)
  assert.match(v.explanation, /^Likely otp fraud\./)
})
test('likely_scam + trust model not safe: the trust model risk explanation is kept', async () => {
  const v = await analyzeText('Your HDFC account will be suspended today. Update KYC by replying with your Aadhaar and PAN. Ref hdfcbank.com')
  assert.equal(v.verdict, 'likely_scam'); assert.equal(v.riskScore, 71)
  assert.match(v.explanation, /^Likely otp fraud\./)
})

// 5. P0 regression + cache.
test('no screenshot verdict is likely_safe, and no non-safe verdict is explained as safe', async () => {
  for (const text of ['Hi, lunch at 1pm tomorrow?', 'Your SBI account statement for September is ready. View it in the YONO app.', 'pay to refund.desk@ybl to get your money back', 'Congratulations! You received cashback of Rs 50 on your Swiggy order via PhonePe.']) {
    const v = await analyzeText(text)
    assert.notEqual(v.verdict, 'likely_safe', text)
    assert.doesNotMatch(v.explanation, REASSURING, text)
  }
})
test('a contradictory explanation cached under the pre-fix key is not served', async () => {
  const text = 'Congratulations! You received cashback of Rs 50 on your Swiggy order via PhonePe.'
  const { b64, hash } = await seedImage(text)
  await setCached(`screenshot:v3:${hash}:std`, 'screenshot', { verdict: 'suspicious', riskScore: 38, explanation: 'No strong scam signals detected.' }, 3_600_000)
  const v = await analyzeScreenshot(b64, 'image/png')
  assert.notEqual(v.cached, true, 'stale pre-fix explanation was served from cache')
  assert.equal(v.explanation, WHY.suspicious)
  // The fixed result is cached under the new key and served unchanged.
  const again = await analyzeScreenshot(b64, 'image/png')
  assert.equal(again.cached, true); assert.equal(again.explanation, WHY.suspicious); assert.equal(again.verdict, 'suspicious')
})

test('no network calls were attempted', () => {
  assert.deepEqual(fetchCalls, [])
})
