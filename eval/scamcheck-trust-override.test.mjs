// eval/scamcheck-trust-override.test.mjs
//
// Regression tests for the ScamCheck trusted-domain override.
//
// Bug (audit 2026-10-04, Fix 2A): applyReputation() capped risk at 15 and set
// `trusted` whenever any official domain appeared in the input and no "strong"
// signal fired — so appending e.g. "Official site sbi.co.in" to a likely_scam
// (72) or suspicious (36–42) message turned it into a green `likely_safe`.
// Naming a real brand is trivial for a scammer: trust may confirm a LOW score,
// but must never lower one already at the suspicious threshold (35).
//
// Out of scope here (later fixes): trust GRANTED to a below-threshold message by
// a mere mention (Fix 2B), host parsing (Fix 3), wildcard allowlists (Fix 4).
//
// Offline and side-effect free: REAL production functions (applyReputation and
// the quick-check route handler), in-memory store, no AI/Firebase config, every
// fetch fails the test, one client IP per request. All inputs are synthetic.
//
// Run: node --test --import ./eval/hooks.mjs eval/scamcheck-trust-override.test.mjs

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
const { applyReputation } = await imp('lib/scam-intel/reputation.ts')
const { POST } = await imp('app/api/scam-intel/quick-check/route.ts')

let n = 0
async function check(type, value) {
  n++
  const res = await POST(new Request('http://localhost/api/scam-intel/quick-check', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': `10.97.${(n >> 8) & 255}.${n & 255}` },
    body: JSON.stringify({ type, value }),
  }))
  assert.equal(res.status, 200, `HTTP ${res.status} for ${type}:${value}`)
  return res.json()
}

// ── Unit: applyReputation (lib/scam-intel/reputation.ts) ───────────────────
test('unit: trusted mention does not lower a likely_scam score', () => {
  const r = applyReputation(72, { domains: ['sbi.co.in'] })
  assert.equal(r.risk, 72); assert.equal(r.trusted, false)
})
test('unit: trusted mention does not lower a suspicious score (email path too)', () => {
  assert.deepEqual([applyReputation(36, { domains: ['https://www.hdfcbank.com'] }).risk, applyReputation(36, { domains: ['https://www.hdfcbank.com'] }).trusted], [36, false])
  const e = applyReputation(42, { emails: ['alerts@hdfcbank.com'] })
  assert.equal(e.risk, 42); assert.equal(e.trusted, false)
})
test('unit: threshold boundary — 35 is kept, 34 is still capped (unchanged)', () => {
  const at = applyReputation(35, { domains: ['sbi.co.in'] })
  assert.equal(at.risk, 35); assert.equal(at.trusted, false)
  const below = applyReputation(34, { domains: ['sbi.co.in'] })
  assert.equal(below.risk, 15); assert.equal(below.trusted, true)
})
test('unit: unchanged — strong fraud signal keeps raw risk with impersonation note', () => {
  const r = applyReputation(55, { domains: ['sbi.co.in'], strongFraudSignal: true })
  assert.equal(r.risk, 55); assert.equal(r.trusted, false)
  assert.match(r.notes.join(' '), /likely impersonation/)
})
test('unit: unchanged — no trusted entity leaves risk untouched', () => {
  const r = applyReputation(50, { domains: ['randomshop-deals.com'] })
  assert.deepEqual(r, { risk: 50, trusted: false, notes: [] })
})

// ── Route: appending an official domain must not lower the verdict ─────────
const RANK = { unclear: 0, likely_safe: 0, suspicious: 1, likely_scam: 2 }
const PAIRS = [
  // [id, base message, appended official-domain mention, expected base verdict, expected base risk]
  ['likely_scam + UPI fee instruction', 'URGENT: SBI KYC pending, account will be blocked. Lucky draw reward pending. Pay fee to winner.desk@ybl and call 9876543210 on WhatsApp.', ' Official site sbi.co.in', 'likely_scam', 72],
  ['suspicious + UPI transfer instruction', 'HDFC KYC expired. Transfer Rs 10 to kyc.verify@axl to reactivate your account immediately or it will be suspended.', ' Official: hdfcbank.com', 'suspicious', 42],
  ['suspicious + UPI payment + call-back', 'Dear customer, your Paytm wallet is blocked. Send Rs 1 verification payment to wallet.help@ybl and call 9876543210 urgently.', ' Visit https://paytm.com', 'suspicious', 36],
  ['suspicious KYC threat + domain ref', 'Your HDFC account will be suspended today. Update KYC by replying with your Aadhaar and PAN.', ' Ref hdfcbank.com', 'suspicious', 36],
  ['suspicious KYC link + official email', 'Dear customer your SBI account will be blocked today. Update PAN at https://yono-kyc-portal.in/update', ' or contact care@sbi.co.in', 'suspicious', 36],
  ['suspicious call-back + official URL', 'Verify your account immediately or it will be suspended. Call 9876543210', ' Visit https://www.sbi.co.in', 'suspicious', 42],
]
for (const [id, base, mention, verdict, risk] of PAIRS) {
  test(`route: official mention does not lower verdict — ${id}`, async () => {
    const a = await check('message', base)
    assert.equal(a.verdict, verdict); assert.equal(a.riskScore, risk)
    const b = await check('message', base + mention)
    assert.ok(RANK[b.verdict] >= RANK[a.verdict], `${a.verdict}/${a.riskScore} → ${b.verdict}/${b.riskScore}`)
    assert.equal(b.verdict, verdict)
    // The appended words are themselves scored (e.g. "sbi" → impersonation keyword),
    // so risk may rise — trust must simply never pull it back down.
    assert.ok(b.riskScore >= risk, `mention lowered risk ${risk} → ${b.riskScore}`)
    assert.equal(b.trusted, false)
    assert.notEqual(b.verdict, 'likely_safe')
  })
}

// ── Legitimate counterexamples: trust still confirms a low-risk CHECKED link/email ─
const LEGIT = [
  ['link', 'https://www.hdfcbank.com'],
  ['link', 'https://www.onlinesbi.sbi/login'],
  ['email', 'alerts@hdfcbank.com'],
  ['email', 'support@asquaresolution.com'],
]
for (const [type, value] of LEGIT) {
  test(`counterexample stays likely_safe + trusted: ${type} ${value.slice(0, 50)}`, async () => {
    const d = await check(type, value)
    assert.equal(d.verdict, 'likely_safe'); assert.equal(d.trusted, true)
  })
}

// ── Benign MESSAGES that only mention an official domain (Fix 2B) ───────────
// A domain named inside pasted text cannot prove who sent it, so it no longer
// earns trust: these move from likely_safe (green) to unclear (grey). Accepted
// behaviour change — they must never be pushed to suspicious/likely_scam either.
const BENIGN_MENTIONS = [
  'Your SBI account statement for September is ready. View it in the YONO app or at https://www.onlinesbi.sbi',
  'Your OTP is 482913. Do not share it with anyone. -HDFC Bank hdfcbank.com',
  'Order 4021 delivered. Rate your experience on the Amazon app. amazon.in',
]
for (const value of BENIGN_MENTIONS) {
  test(`benign mention is unclear (not trusted, not scam): message ${value.slice(0, 50)}`, async () => {
    const d = await check('message', value)
    assert.equal(d.verdict, 'unclear'); assert.equal(d.trusted, false)
    assert.notEqual(d.verdict, 'likely_scam')
  })
}

// ── Fix 2B regression cases (audit 2026-10-04, synthetic) ───────────────────
// Scams that carry an official domain and only warn-level signals scored < 35
// and were turned green by the mention. They must no longer be trusted/green.
const MENTION_SCAMS = [
  ['A1 refund fee + UPI + official domain', 'Your SBI refund is on hold. Pay the Rs 99 processing fee to refund.desk@ybl to release it today, account will be blocked otherwise. Details at sbi.co.in'],
  ['A2 reward fee + UPI + official domain', 'Your HDFC credit card reward points of Rs 5,000 will lapse tonight. Pay Rs 49 handling charge to reward.help@ybl to redeem. hdfcbank.com'],
  ['B1 brand name + unknown link + official domain', 'SBI alert: your YONO access is paused. Re-activate at https://yono-secure-access.in today. Official site sbi.co.in'],
  ['B2 look-alike sender + official domain', 'From: alerts@hdfc-netbanking-support.in — Your HDFC account needs verification. hdfcbank.com'],
]
for (const [id, value] of MENTION_SCAMS) {
  test(`2B: official mention no longer makes a scam green — ${id}`, async () => {
    const d = await check('message', value)
    assert.notEqual(d.verdict, 'likely_safe'); assert.equal(d.trusted, false)
    assert.doesNotMatch(d.reputationNotes.join(' '), /treated as likely legitimate/)
    assert.ok(!d.advice.some((a) => /verified\/official entity/.test(a)), 'no "verified/official entity" advice')
  })
}
test('2B: C4 benign branch-info mention is unclear, not suspicious', async () => {
  const d = await check('message', 'Branch timings and holiday list are available at sbi.co.in')
  assert.equal(d.verdict, 'unclear'); assert.equal(d.trusted, false)
})
test('2B: B3 shortener + official mention stays likely_scam (strong signal unchanged)', async () => {
  const d = await check('message', 'SBI: verify now at bit.ly/sbi-kyc-now or your account will be blocked. sbi.co.in')
  assert.equal(d.verdict, 'likely_scam'); assert.equal(d.trusted, false)
})
test('2B: A3 look-alike parcel link + official mention stays untrusted', async () => {
  const d = await check('message', 'India Post: your parcel is held at the hub. Pay Rs 25 redelivery fee at indiapost-redelivery.in today. indiapost.gov.in')
  assert.notEqual(d.verdict, 'likely_safe'); assert.equal(d.trusted, false)
})
test('2B: D3 link check with a backslash-@ fragment of an official domain is not trusted', async () => {
  const d = await check('link', 'https://evil.example\\@sbi.co.in')
  assert.notEqual(d.verdict, 'likely_safe'); assert.equal(d.trusted, false)
})
test('2B: D1 checked official link keeps likely_safe + trusted', async () => {
  const d = await check('link', 'https://www.sbi.co.in/web/personal-banking')
  assert.equal(d.verdict, 'likely_safe'); assert.equal(d.trusted, true)
})
test('2B: E1 unknown UPI ID stays unclear', async () => {
  const d = await check('upi', 'refund.desk@ybl')
  assert.equal(d.verdict, 'unclear'); assert.equal(d.trusted, false)
})

// ── Documented trade-off: a legitimate-STYLE message at/above the threshold ──
// SYNTHETIC legitimate-style counterexample (written to resemble a routine bank
// KYC reminder; not a real or verified SBI/RBI message). Its own wording trips
// three warn-level detectors — urgency ("within 30 days"), kyc_phish ("update
// your KYC"), impersonation ("RBI"/"SBI") — so the raw score is 3 × 12 = 36.
//   Before Fix 2A: the onlinesbi.sbi mention capped it to 15 + trusted → likely_safe (green).
//   After  Fix 2A: trust no longer lowers a ≥35 score → suspicious / 36 (amber).
// This is the accepted false-positive cost of Fix 2A: the same wording is used by
// real KYC phishing, and a mentioned domain cannot prove the sender is the bank.
// If this assertion ever flips back to likely_safe, the trust override has returned.
test('trade-off (Fix 2A): synthetic legitimate-style RBI/KYC reminder is suspicious/36, no longer likely_safe/15', async () => {
  const msg = 'Dear Customer, as per RBI guidelines please update your KYC within 30 days to avoid account restrictions. Visit your nearest branch or https://www.onlinesbi.sbi -SBI'
  const d = await check('message', msg)
  assert.deepEqual(d.signals.map((s) => s.id).sort(), ['impersonation', 'kyc_phish', 'urgency'])
  assert.ok(d.signals.every((s) => s.severity === 'warn'), 'no strong/danger signal is involved')
  assert.deepEqual(d.entities.urls, ['https://www.onlinesbi.sbi'])
  assert.equal(d.verdict, 'suspicious')
  assert.equal(d.riskScore, 36)
  assert.equal(d.trusted, false)
  assert.doesNotMatch(d.reputationNotes.join(' '), /treated as likely legitimate/)
  // Same inputs at the unit level: the official domain no longer caps 36 → 15.
  const r = applyReputation(36, { domains: ['https://www.onlinesbi.sbi'] })
  assert.equal(r.risk, 36); assert.equal(r.trusted, false)
})

// Fix 2B: a below-threshold message is no longer *granted* trust by a mention
// (was likely_safe 15; now unclear 30). Formerly a node:test todo.
test('Fix 2B: mention no longer grants trust below the threshold', async () => {
  const d = await check('message', 'Your SBI refund is on hold. Pay the Rs 99 processing fee to refund.desk@ybl to release it today, account will be blocked otherwise. Details at sbi.co.in')
  assert.notEqual(d.verdict, 'likely_safe')
})

test('no network calls were attempted', () => {
  assert.deepEqual(fetchCalls, [])
})
