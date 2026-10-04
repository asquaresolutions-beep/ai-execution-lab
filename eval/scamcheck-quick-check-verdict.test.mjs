// eval/scamcheck-quick-check-verdict.test.mjs
//
// Regression tests for the ScamCheck quick-check "no evidence ⇒ likely safe" verdict.
//
// Bug (audit 2026-10-04, Fix 1A): /api/scam-intel/quick-check fell through to
// `likely_safe` for any input ≥ 12 chars with risk < 35 that matched no trusted
// entity — so an unknown UPI ID, phone number or domain was shown as a green
// "likely safe" and shared as such. Absence of evidence is not evidence of safety:
// only a trusted entity may yield `likely_safe`; everything else below the
// suspicious threshold is `unclear`. Scoring, thresholds and trust are unchanged.
//
// Offline and side-effect free: exercises the REAL route handler, in-memory store
// (no STORE_FILE), no AI/Firebase config, and every fetch fails the test. Each
// request uses its own client IP so the per-IP rate limit and guest quota never
// interfere. All inputs are synthetic.
//
// Run: node --test --import ./eval/hooks.mjs eval/scamcheck-quick-check-verdict.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
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
const { POST } = await imp('app/api/scam-intel/quick-check/route.ts')

let n = 0
async function check(type, value) {
  n++
  const res = await POST(new Request('http://localhost/api/scam-intel/quick-check', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': `10.99.${(n >> 8) & 255}.${n & 255}` },
    body: JSON.stringify({ type, value }),
  }))
  assert.equal(res.status, 200, `HTTP ${res.status} for ${type}:${value}`)
  return res.json()
}

// ── No-evidence inputs: must be `unclear`, never `likely_safe` ──────────────
// riskScore is pinned to the pre-fix value to prove scoring did not change.
const NO_EVIDENCE = [
  ['upi', 'refund.desk@ybl', 6],
  ['upi', 'randomperson99@axl', 6],
  ['phone', '+91 98765 43210', 6],
  ['link', 'https://randomshop-deals.com', 0],
  ['message', 'not-a-upi-at-all', 0],
]
for (const [type, value, risk] of NO_EVIDENCE) {
  test(`no evidence → unclear (not likely_safe): ${type} ${value}`, async () => {
    const d = await check(type, value)
    assert.notEqual(d.verdict, 'likely_safe')
    assert.equal(d.verdict, 'unclear')
    assert.equal(d.trusted, false)
    assert.equal(d.riskScore, risk, 'risk score must be unchanged by the verdict fix')
  })
}

// ── Guards: legitimate trusted entities and real detections are unchanged ───
test('guard: first-party email stays likely_safe + trusted', async () => {
  const d = await check('email', 'support@asquaresolution.com')
  assert.equal(d.verdict, 'likely_safe'); assert.equal(d.trusted, true)
})
test('guard: official bank link stays likely_safe + trusted', async () => {
  const d = await check('link', 'https://sbi.co.in/login')
  assert.equal(d.verdict, 'likely_safe'); assert.equal(d.trusted, true)
})
test('guard: multi-signal scam stays likely_scam (72)', async () => {
  const d = await check('message', 'URGENT: SBI KYC pending, account will be blocked. Lucky draw reward pending. Pay fee to winner.desk@ybl and call 9876543210 on WhatsApp.')
  assert.equal(d.verdict, 'likely_scam'); assert.equal(d.riskScore, 72)
})
test('guard: KYC threat stays suspicious (36)', async () => {
  const d = await check('message', 'Your HDFC account will be suspended today. Update KYC by replying with your Aadhaar and PAN.')
  assert.equal(d.verdict, 'suspicious'); assert.equal(d.riskScore, 36)
})
test('guard: OTP solicitation stays suspicious (55)', async () => {
  const d = await check('message', 'Share the OTP 4829 with our agent to stop the block')
  assert.equal(d.verdict, 'suspicious'); assert.equal(d.riskScore, 55)
})

// ── Invariant: `likely_safe` is only ever returned for a trusted entity ─────
test('invariant: likely_safe ⇒ trusted; unclear ⇒ not trusted', async () => {
  const inputs = [
    ...NO_EVIDENCE.map(([t, v]) => [t, v]),
    ['email', 'support@asquaresolution.com'], ['link', 'https://www.hdfcbank.com'],
    ['message', 'Hi, are we still meeting for lunch tomorrow at 1pm?'], ['upi', 'abc@ybl'],
  ]
  for (const [t, v] of inputs) {
    const d = await check(t, v)
    if (d.verdict === 'likely_safe') assert.equal(d.trusted, true, `${t}:${v} likely_safe without trust`)
    if (d.verdict === 'unclear') assert.equal(d.trusted, false, `${t}:${v} unclear but trusted`)
  }
})

test('no network calls were attempted', () => {
  assert.deepEqual(fetchCalls, [])
})
