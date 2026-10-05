// eval/scamcheck-hinglish-upi.test.mjs
//
// Regression tests for Hindi / Hinglish UPI scam detection (audit 2026-10-05, Fix 5).
//
// Bug: the shared text detectors (lib/scam-intel/multimodal.ts DETECTORS, used by
// both quick-check and the screenshot analyzer) missed the commonest Indian UPI scam
// instructions when written in Hindi/Hinglish — "apna UPI PIN daalo", "OTP de do",
// "QR code scan karke wapas bhej do", "collect request ... approve kar do" — scoring
// them 0–34 (`unclear`). The fix adds GATED patterns: a request verb only counts when
// it acts on an OTP / UPI PIN / QR / collect-or-payment request in the same clause,
// and never across a negation ("mat batao", "न बताएं"). Generic "bata do" / "bhej do"
// chat and fraud-awareness messages must not match.
//
// Both paths are exercised: the REAL quick-check route and the REAL analyzeScreenshot
// with OCR pre-seeded in the in-memory cache (no Vision/Vertex/BigQuery). Every fetch
// fails the test. All inputs are synthetic. Values pinned as "head" are the outputs
// of commit a0d86e8 (before this fix).
//
// Run: node --test --import ./eval/hooks.mjs eval/scamcheck-hinglish-upi.test.mjs

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
const { analyzeScreenshot, analyzeTextSignals } = await imp('lib/scam-intel/multimodal.ts')
const { POST } = await imp('app/api/scam-intel/quick-check/route.ts')

let n = 0
async function quickCheck(value) {
  n++
  const res = await POST(new Request('http://localhost/api/scam-intel/quick-check', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': `10.98.${(n >> 8) & 255}.${n & 255}` },
    body: JSON.stringify({ type: 'message', value }),
  }))
  assert.equal(res.status, 200, `HTTP ${res.status} for ${value}`)
  return res.json()
}
// A unique fake PNG per call; its OCR result is pre-seeded under the module's own
// `ocr:<sha256[0..32]>` cache key, so analyzeScreenshot never calls an OCR provider.
async function screenshot(text) {
  n++
  const b64 = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]), Buffer.from(`hi-${n}`)]).toString('base64')
  await setCached(`ocr:${createHash('sha256').update(b64).digest('hex').slice(0, 32)}`, 'ocr', { text, words: [], engine: 'seeded', lang: 'en' }, 3_600_000)
  return analyzeScreenshot(b64, 'image/png')
}
const NEW_SIGNALS = ['otp_request', 'upi_reverse_payment']
const ids = (signals) => signals.map((s) => s.id)

// ── Scam instructions: must now be detected on BOTH paths ─────────────────
// [label, text, signal, quick-check head risk, quick-check risk, screenshot head risk, screenshot verdict/risk]
const POSITIVE = [
  ['UPI PIN entry (Hinglish)', 'apna UPI PIN daalo', 'otp_request', 0, 55, 41, 'needs_review', 46],
  ['reverse QR (Hinglish)', 'QR code scan karke wapas bhej do', 'upi_reverse_payment', 6, 55, 12, 'unclear', 33],
  ['UPI PIN entry (Devanagari)', 'अपना UPI पिन डालें', 'otp_request', 0, 55, 39, 'needs_review', 45],
  ['accept payment request + PIN', 'payment request accept karo aur PIN enter karo', 'upi_reverse_payment', 6, 62, 44, 'likely_scam', 72],
  ['read out the OTP', 'OTP aaya hoga woh bata do', 'otp_request', 0, 55, 41, 'needs_review', 46],
  ['approve collect request', 'collect request bheji hai, approve kar do', 'upi_reverse_payment', 34, 62, 45, 'likely_scam', 70],
  ['give the OTP', 'OTP de do', 'otp_request', 0, 55, 21, 'needs_review', 44],
  ['tell the OTP (Devanagari)', 'ओटीपी बता दीजिए', 'otp_request', 0, 55, 9, 'needs_review', 33],
  // Same intents, different wording — the patterns are not sentence-specific.
  ['scan QR, money will arrive', 'Is QR ko scan karo, paise aa jayenge', 'upi_reverse_payment', 0, 55, 9, 'unclear', 33],
  ['scan QR to receive money', 'Paise lene ke liye ye QR scan kijiye', 'upi_reverse_payment', 0, 55, 9, 'unclear', 33],
  ['reverse QR (Devanagari)', 'क्यूआर कोड स्कैन करके पैसे वापस भेज दो', 'upi_reverse_payment', 0, 55, 9, 'unclear', 33],
  ['accept collect request for refund (Devanagari)', 'कलेक्ट रिक्वेस्ट स्वीकार करें, रिफंड मिल जाएगा', 'upi_reverse_payment', 0, 55, 9, 'unclear', 33],
  ['refund + UPI PIN at sentence end (Devanagari)', 'आपका रिफंड मंजूर हुआ है। पैसे पाने के लिए अपना UPI पिन डालें।', 'otp_request', 0, 55, 39, 'needs_review', 45],
]
for (const [label, text, signal, qcHead, qcRisk, shotHead, shotVerdict, shotRisk] of POSITIVE) {
  test(`quick-check detects: ${label}`, async () => {
    const d = await quickCheck(text)
    assert.ok(ids(d.signals).includes(signal), `missing ${signal}: ${ids(d.signals)}`)
    assert.ok(['suspicious', 'likely_scam'].includes(d.verdict), `verdict ${d.verdict}`)
    assert.equal(d.riskScore, qcRisk)
    assert.ok(d.riskScore > qcHead && d.riskScore >= 35, 'risk must rise to at least the suspicious threshold')
    assert.equal(d.trusted, false)
  })
  test(`screenshot detects: ${label}`, async () => {
    const v = await screenshot(text)
    assert.ok(ids(v.visualSignals).includes(signal), `missing ${signal}: ${ids(v.visualSignals)}`)
    assert.notEqual(v.verdict, 'likely_safe')
    assert.equal(v.verdict, shotVerdict)
    assert.equal(v.riskScore, shotRisk)
    assert.ok(v.riskScore > shotHead, 'screenshot risk must not be lower than before the fix')
  })
}

test('English control is unchanged: approve collect request + enter UPI PIN → likely_scam/74', async () => {
  const d = await quickCheck('Your Amazon refund of Rs 1499 is pending. To receive it, approve the collect request and enter UPI PIN.')
  assert.equal(d.verdict, 'likely_scam'); assert.equal(d.riskScore, 74)
  assert.ok(!ids(d.signals).includes('upi_reverse_payment'), 'English text is handled by the existing detectors')
})

// ── Benign controls: related words, but no scam instruction ────────────────
// [label, text, quick-check verdict/risk, screenshot verdict/risk] — all identical to head.
const BENIGN = [
  ['RBI awareness (Devanagari)', 'RBI कभी भी OTP नहीं मांगता', 'unclear', 12, 'needs_review', 40],
  ['never scan a QR (English)', 'Never scan a QR code to receive money', 'unclear', 6, 'unclear', 12],
  ['Hindi bank OTP notification', 'आपका OTP 482913 है। इसे किसी के साथ साझा न करें। -SBI', 'unclear', 12, 'needs_review', 40],
  ['Hinglish bank OTP notification', 'Aapka OTP 482913 hai. Ise kisi ko na batayein. -HDFC Bank', 'unclear', 12, 'needs_review', 40],
  ['English bank OTP notification', 'Your OTP is 482913. Do not share it with anyone. -HDFC Bank', 'unclear', 12, 'needs_review', 40],
  ['account statement (English)', 'Your SBI account statement for September is ready. View it in the YONO app.', 'unclear', 12, 'unclear', 18],
  ['account statement (Hinglish)', 'Aapka SBI account statement taiyaar hai. Abhi YONO app me dekhein.', 'unclear', 24, 'unclear', 24],
  ['family chat', 'Beta, kal ghar jaldi aana, mummy ka birthday hai', 'unclear', 12, 'unclear', 15],
  ['friends chat with "kar do" / "bata do"', 'Bhai kal match dekhne chalein? Ticket book kar do aur time bata do', 'unclear', 0, 'unclear', 9],
  ['friends chat with "bhej do"', 'Meeting ka time bata do aur address bhej do', 'unclear', 0, 'unclear', 9],
  ['family chat (Devanagari)', 'आज शाम को घर आ जाओ, खाना साथ में खाएंगे', 'unclear', 0, 'unclear', 9],
  ['postal PIN code', 'Apna pin code bata do, parcel bhejna hai', 'unclear', 0, 'needs_review', 41],
  ['postal PIN code (Devanagari)', 'कृपया अपना पिन कोड बताएं ताकि डिलीवरी हो सके', 'unclear', 0, 'unclear', 9],
  ['pin a chat message', 'Group me message pin kar do', 'unclear', 0, 'needs_review', 41],
  ['"pin" inside other words', 'Spin the wheel later, shopping first', 'unclear', 0, 'unclear', 9],
  ['negated UPI PIN (Devanagari)', 'कभी भी अपना यूपीआई पिन किसी को मत बताओ', 'unclear', 0, 'unclear', 9],
  ['negated OTP (Hinglish)', 'OTP kisi ko na dein, bank kabhi nahi maangta', 'unclear', 0, 'needs_review', 41],
  ['negated OTP to delivery agent', 'Swiggy wale ko OTP mat dena jab tak order na mile', 'unclear', 0, 'needs_review', 41],
  ['awareness: UPI PIN and OTP', 'Bank kabhi bhi UPI PIN ya OTP nahi maangta, kisi ko na batayein', 'unclear', 0, 'needs_review', 41],
  ['awareness: QR never pays you', 'QR scan karke paise nahi milte, savdhan rahein', 'unclear', 0, 'unclear', 9],
  ['awareness: no QR needed to receive', 'Paise lene ke liye QR scan karne ki zarurat nahi hoti', 'unclear', 0, 'unclear', 9],
  ['paying a shop by QR', 'Dukaan pe QR scan karke payment kar do', 'unclear', 0, 'unclear', 9],
  ['OTP question, not a request', 'OTP aaya? bata do kab aaoge', 'unclear', 0, 'needs_review', 41],
  ['approve a leave request', 'Approve kar do leave request, kal chhutti hai', 'unclear', 0, 'unclear', 9],
  ['lunch message (English)', 'Hi, lunch at 1pm tomorrow?', 'unclear', 0, 'unclear', 9],
]
for (const [label, text, qcVerdict, qcRisk, shotVerdict, shotRisk] of BENIGN) {
  test(`benign stays unchanged: ${label}`, async () => {
    const d = await quickCheck(text)
    assert.equal(d.verdict, qcVerdict); assert.equal(d.riskScore, qcRisk)
    assert.ok(d.riskScore < 35)
    for (const s of NEW_SIGNALS) assert.ok(!ids(d.signals).includes(s), `${s} fired on benign text`)
    const v = await screenshot(text)
    assert.equal(v.verdict, shotVerdict); assert.equal(v.riskScore, shotRisk)
    for (const s of NEW_SIGNALS) assert.ok(!ids(v.visualSignals).includes(s), `${s} fired on benign screenshot`)
  })
}

test('quick-check advice explains that receiving money never needs a QR scan', async () => {
  const d = await quickCheck('QR code scan karke wapas bhej do')
  assert.ok(d.advice.includes('Receiving money on UPI never needs a PIN or QR scan.'))
})

test('detectors stay linear on long adversarial input', () => {
  for (const s of ['otp '.repeat(1000), 'qr scan karke '.repeat(300), 'collect request '.repeat(250), 'ओटीपी पिन क्यूआर '.repeat(250)]) {
    const t = Date.now(); analyzeTextSignals(s)
    assert.ok(Date.now() - t < 500, `slow on ${s.slice(0, 20)}…`)
  }
})

test('no network calls were attempted', () => {
  assert.deepEqual(fetchCalls, [])
})
