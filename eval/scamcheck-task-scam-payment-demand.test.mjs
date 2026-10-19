// eval/scamcheck-task-scam-payment-demand.test.mjs
//
// Regression tests for the pay-to-get-paid signal, `advance_fee_demand` (2026-10).
//
// Bug: explicit task-scam payment demands scored "unclear" on the text checker —
// "Pay ₹1,000 verification fee to withdraw your balance." 6/100, "To continue, deposit
// ₹2,000 into your task account." 12/100. No rule covered paying, depositing or
// recharging in order to continue, unlock or withdraw, and a single danger signal (28)
// cannot reach "suspicious" (35) without a minimum score.
//
// Fix: one danger signal with the same minimum (55) as otp_request and
// upi_reverse_payment. Tier 1 fires alone: a payment instruction tied to withdrawing or
// releasing earnings or a balance, or paying into the scheme's task account, in one
// sentence. Tier 2 needs task or job-earnings wording anywhere in the message: a payment
// instruction with a weaker goal (unlock, continue, start, registration fee).
//
// Tier 1 also has goal-first forms: "a verification / clearance / withdrawal / processing /
// tax fee … is required / must be paid … to release your earnings"; "to withdraw …, pay
// ₹X" (a percentage directly after the verb counts as the amount: "pay 30% tax"); "to
// withdraw you must complete the prepaid task"; and "your earnings will be released after
// you pay ₹X" (a stated amount or percentage is required).
//
// Kept on purpose: a first-contact job offer with no payment demand stays "unclear";
// lottery / prize / cashback / refund / bonus / loan demands do not gain the signal; the
// classifier's category is never a score input; the UPI tip is dropped only when the
// "Pay ₹" of such a demand is the only payment reference.
//
// Final candidate of 11 Oct 2026 (after a failed review of a wider tightening, a selective
// pass, and the owner's decisions D-1 to D-6):
//   - one bank-service wording is left alone, "withdraw cash at / from another bank's
//     ATM", and only when the message has no earnings, task or job wording anywhere. PF,
//     units of a mutual fund, "his / her …", an application, a complaint and everything
//     else still count.
//   - "deposit" is a payment verb whatever is deposited; there is no cheque or document rule.
//   - there is no rule about what may stand between the payment and the withdrawal, so
//     "deposit ₹5,000 to open a Fixed Deposit and withdraw anytime" is flagged. It and the
//     other false positives that remain are pinned in the fixture as knownFalsePositive.
//   - a price list with no payment instruction ("to withdraw, a fee of ₹25 applies") is
//     not flagged; the two demands that the removed form used to catch are pinned as gaps.
//   - the word lists are the locked ones plus inflections and spellings. Wider wording of
//     the 9 Oct version ("and you can withdraw", "your pending commission", "our task
//     account", "fund your task account", "to cash out, pay …", "an activation fee is
//     payable …") is NOT matched and is pinned as documentedGap.
// Fixture categories S1 to S3 belong to the selective pass, F1 to F3 to the final one.
//
// Both paths are exercised: the REAL quick-check route, and the REAL analyzeScreenshot
// with OCR pre-seeded in the in-memory cache (no Vision / Vertex / BigQuery). Every fetch
// fails the test. All inputs are made up. "before" values are commit f7f18c5.
//
// Owner rulings of 19 Oct 2026, applied on top of the reviewed candidate (diff ddfe59cb):
//   - C-1: the scope guard finds sentence ends once per message (binary search, one result
//     per sentence): no longer quadratic on long messages. C-2: the closing advice line is
//     always kept, on both paths.
//   - class 1 fixed: "need to", "having to", "without" and "never, ever" join the negation
//     guard. F-08 fixed: "asked to" / "told to" stay awareness wording except after "I" or
//     "we", so a victim's own report ("I was told to pay …") warns and awareness text
//     ("you are asked to …", "… then told to deposit …") does not.
//   - Hinglish (option b): the planned Hinglish demand patterns are removed; Hinglish
//     messages keep production results. The production Hindi / Hinglish UPI rules are untouched.
//   - every remaining known false positive is accepted by the owner (acceptedByOwner); SK-02
//     and SK-06 are relabelled as correct warnings.
//
// Run: node --test --import ./eval/hooks.mjs eval/scamcheck-task-scam-payment-demand.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
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
const { analyzeScreenshot, analyzeTextSignals, ADVANCE_FEE_ADVICE, upiTipIsUnrelated } = await imp('lib/scam-intel/multimodal.ts')
const { ruleClassify, JOB_EARNINGS_TERMS } = await imp('lib/scam-intel/classify.ts')
const { POST } = await imp('app/api/scam-intel/quick-check/route.ts')

const { cases } = JSON.parse(readFileSync(B + 'eval/fixtures/task-scam-payment-demand.json', 'utf8'))
const frozen = JSON.parse(readFileSync(B + 'eval/fixtures/task-scam-frozen-reference.json', 'utf8'))

const SIGNAL = 'advance_fee_demand'
const LABEL = 'Pay-to-get-paid demand (deposit, recharge or fee to unlock or withdraw earnings)'
const UPI_TIP = 'Receiving money on UPI never needs a PIN or QR scan.'
const QR_TIP = 'A real credit never requires you to SCAN a QR or approve a "collect request" — scanning/approving SENDS money. Verify in your own bank app.'
const CLOSING = 'If in doubt, do not click, pay, or share details. Report at cybercrime.gov.in / 1930 (India).'
const SS_CLOSING = 'If money was lost or shared, call the cybercrime helpline 1930 or report at cybercrime.gov.in immediately.'

let n = 0
async function quickCheck(value, type = 'message') {
  n++
  const res = await POST(new Request('http://localhost/api/scam-intel/quick-check', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': `10.${98 + ((n >> 16) & 15)}.${(n >> 8) & 255}.${n & 255}` },
    body: JSON.stringify({ type, value }),
  }))
  assert.equal(res.status, 200, `HTTP ${res.status} for ${value}`)
  return res.json()
}
// A unique fake PNG per call; its OCR result is pre-seeded under the module's own
// `ocr:<sha256[0..32]>` cache key, so analyzeScreenshot never calls an OCR provider.
async function screenshot(text) {
  n++
  const b64 = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]), Buffer.from(`taskscam-${n}`)]).toString('base64')
  await setCached(`ocr:${createHash('sha256').update(b64).digest('hex').slice(0, 32)}`, 'ocr', { text, words: [], engine: 'seeded', lang: 'en' }, 3_600_000)
  return analyzeScreenshot(b64, 'image/png')
}
const ids = (signals) => signals.map((s) => s.id)
const flagged = (v) => v === 'suspicious' || v === 'likely_scam'
const positives = cases.filter((c) => c.expect === 'signal')
const negatives = cases.filter((c) => c.expect === 'none')

// ── The fixture covers every category of the plan, at the planned size ───────
test('fixture: every planned category is present at the planned minimum size', () => {
  const count = (prefix) => cases.filter((c) => c.category.startsWith(prefix)).length
  for (const [prefix, min] of [['1 ', 5], ['2 tier 1', 10], ['2a', 3], ['3 ', 6], ['4 ', 6], ['5 ', 25], ['6 ', 6], ['7 ', 3], ['8 ', 6], ['9 ', 4], ['10 ', 5], ['11 Hinglish', 8], ['11a', 2], ['K ', 15]]) {
    assert.ok(count(prefix) >= min, `category "${prefix}" has ${count(prefix)} cases, needs ${min}`)
  }
  assert.equal(new Set(cases.map((c) => c.id)).size, cases.length, 'case ids are unique')
})

// ── Positives: the signal fires, the verdict warns, the advice leads ─────────
for (const c of positives) {
  test(`${c.knownFalsePositive ? `known false positive — accepted by owner ${c.acceptedByOwner}` : 'quick-check flags'} [${c.id}] ${c.category}: ${c.note || c.text.slice(0, 60)}`, async () => {
    const r = await quickCheck(c.text)
    assert.ok(ids(r.signals).includes(SIGNAL), `signal missing; got ${ids(r.signals)}`)
    assert.equal(r.signals.find((s) => s.id === SIGNAL).label, LABEL)
    assert.equal(r.signals.find((s) => s.id === SIGNAL).severity, 'danger')
    assert.ok(flagged(r.verdict), `verdict ${r.verdict}`)
    assert.ok(r.riskScore >= 55, `risk ${r.riskScore} is below the minimum`)
    assert.equal(r.verdict, c.after.verdict)
    assert.equal(r.riskScore, c.after.risk)
    assert.ok(c.before.risk < r.riskScore, `before ${c.before.risk}, after ${r.riskScore}`)
    assert.equal(r.advice[0], ADVANCE_FEE_ADVICE, 'the pay-to-get-paid advice is placed first')
    assert.ok(r.advice.includes(CLOSING), 'the closing advice line is kept')
  })
}

// ── Negatives: no signal, and nothing about the result moves ─────────────────
for (const c of negatives) {
  test(`quick-check leaves [${c.id}] ${c.category} unchanged: ${c.note || c.text.slice(0, 60)}`, async () => {
    const r = await quickCheck(c.text)
    assert.ok(!ids(r.signals).includes(SIGNAL), `unexpected signal on: ${c.text}`)
    assert.equal(r.verdict, c.before.verdict)
    assert.equal(r.riskScore, c.before.risk)
    assert.deepEqual([r.verdict, r.riskScore], [c.after.verdict, c.after.risk])
    assert.ok(!r.advice.includes(ADVANCE_FEE_ADVICE))
  })
}

// ── Decisions pinned by name ─────────────────────────────────────────────────
test('decision: a first-contact job offer with no payment demand stays unclear at the same score', async () => {
  const c = cases.find((x) => x.id === 'L-1')
  const r = await quickCheck(c.text)
  assert.deepEqual([r.verdict, r.riskScore, ids(r.signals).includes(SIGNAL)], ['unclear', c.before.risk, false])
  assert.equal(r.category, 'fake_job', 'the classifier still calls it a job offer; that alone adds no signal')
})

test('decision F1: a demand to pay in order to withdraw a balance fires with no task or job wording', async () => {
  const r = await quickCheck('Pay ₹1,000 verification fee to withdraw your balance.')
  assert.deepEqual([r.verdict, r.riskScore], ['suspicious', 55])
  assert.ok(ids(r.signals).includes(SIGNAL))
  assert.equal(r.category, 'other')
})

test('decision: each excluded category stays out when the demand sentence names it', async () => {
  for (const word of ['lottery', 'lucky draw', 'jackpot', 'prize', 'winnings', 'cashback', 'refund', 'bonus', 'loan']) {
    const out = await quickCheck(`Pay ₹500 fee to withdraw your ${word} amount.`)
    assert.ok(!ids(out.signals).includes(SIGNAL), `${word} must stay out of scope`)
    const kept = await quickCheck(`Pay ₹500 fee to withdraw your task earnings and ${word}.`)
    assert.ok(ids(kept.signals).includes(SIGNAL), `${word} next to task earnings stays in scope`)
  }
  const gift = await quickCheck('Pay ₹500 fee to withdraw your gift amount.')
  assert.ok(ids(gift.signals).includes(SIGNAL), '"gift" is not on the excluded list')
})

// The guard is per sentence, as designed. A category named in ANOTHER sentence does not
// stop a bare pay-to-withdraw demand (decision F1). Pinned so a change is deliberate: a
// message-wide guard would also let a stray "refund" or "bonus" silence a real demand.
test('decision: an excluded category named in another sentence does not stop the demand (pinned)', async () => {
  const leaks = cases.filter((c) => c.crossSentenceCategory)
  assert.equal(leaks.length, 3)
  for (const c of leaks) assert.ok(ids((await quickCheck(c.text)).signals).includes(SIGNAL), c.id)
  const stray = await quickCheck('Pay ₹1,000 verification fee to withdraw your balance. You will get a refund of the fee tomorrow.')
  assert.ok(ids(stray.signals).includes(SIGNAL), 'a stray "refund" elsewhere must not silence the demand')
})

test('decision: documented gaps stay unflagged until changed on purpose', async () => {
  const gaps = cases.filter((c) => c.documentedGap)
  assert.ok(gaps.length >= 4)
  for (const c of gaps) assert.ok(!ids((await quickCheck(c.text)).signals).includes(SIGNAL), c.id)
})

// ── Selective pass of 11 Oct 2026, pinned by name ───────────────────────────
const fires = async (t) => ids((await quickCheck(t)).signals).includes(SIGNAL)

test('selective: "withdraw his / her …" is a demand like any other', async () => {
  for (const t of ['Her account is ready: pay ₹700 to withdraw her share to your bank.', 'Ask your friend to deposit ₹1,000 to withdraw his commission.']) assert.ok(await fires(t), t)
})

test('selective: "deposit" stays a payment verb when documents are deposited with the money', async () => {
  assert.ok(await fires('Deposit your documents and ₹2,000 to withdraw your earnings.'))
})

test('selective: no rule about what stands between the payment and the withdrawal', async () => {
  for (const t of ['Pay ₹500 to pass the audit and withdraw.', 'Pay ₹500 to join the VIP group and withdraw.', 'Recharge ₹2,000 to increase your credit score and withdraw.']) assert.ok(await fires(t), t)
})

test('D-4: the inter-bank ATM fee notice is left alone, and nothing next to it', async () => {
  for (const t of ['Pay ₹25 ATM fee to withdraw cash at other bank ATMs.', "Pay ₹23 to withdraw cash from another bank's ATM.", "To withdraw cash at another bank's ATM, pay ₹23 per transaction.", 'Dear customer, you need to pay ₹23 to withdraw cash at other bank ATMs beyond the free limit.']) assert.ok(!(await fires(t)), `must stay unflagged: ${t}`)
  for (const t of ['Pay ₹2,500 processing fee to withdraw your PF.', 'Pay ₹1,500 card activation fee to withdraw cash from any ATM.', 'Pay ₹500 fee to withdraw your earnings at any ATM.', 'Pay ₹5,000 tax to withdraw your mutual fund units.', 'Pay 10% tax to withdraw your mutual fund profits.', 'Pay ₹500 to withdraw cash from your task wallet.']) assert.ok(await fires(t), `must be flagged: ${t}`)
})

test('D-4: the same ATM wording is a demand when the message talks about earnings, a task or a job', async () => {
  for (const t of ['Your earnings are loaded on the card. Pay ₹999 to withdraw cash at other bank ATMs.', "Your task balance is ₹4,200. Pay ₹500 to withdraw cash at another bank's ATM.", 'Work from home job payout is ready: pay ₹300 to withdraw cash from other bank ATMs.', "Commission credited to your card. To withdraw cash at another bank's ATM, pay ₹250."]) assert.ok(await fires(t), `must be flagged: ${t}`)
})

test('D-5: no fund-unit rule: the exit-load notice (a pinned false positive) and the tax demand are both flagged', async () => {
  assert.ok(await fires('Pay 1% exit load to withdraw your mutual fund units before one year.'))
  assert.ok(await fires('Pay ₹5,000 tax to withdraw your mutual fund units.'))
})

test('selective: a price list with no payment instruction is not a demand', async () => {
  for (const t of ['To withdraw, a fee of ₹25 applies.', 'To withdraw funds, a charge of ₹10 per transaction applies.', 'A withdrawal fee of ₹25 applies to every payout.']) assert.ok(!(await fires(t)), t)
})

test('D-1: a percentage directly after the payment verb counts as the amount in "to withdraw …, pay …"', async () => {
  for (const t of ['Customer service: Your balance is 12,400\nTo withdraw, please pay 30% tax first', 'To withdraw, pay a 20% security tax now.', 'To withdraw your earnings, please pay the 18% GST.']) assert.ok(await fires(t), t)
  for (const t of ['To withdraw early, pay attention to the tax rules.', 'To withdraw early, pay attention to the 30% tax rule.', 'To withdraw, pay nothing extra: only 2% is deducted automatically.']) assert.ok(!(await fires(t)), `not a payment of a percentage: ${t}`)
})

test('D-3: the unlisted form "to withdraw …, a fee of ₹X" is gone; the two demands it used to catch are documented gaps', async () => {
  for (const t of ['To withdraw your commission a tax of ₹1,200 applies, pay now.', 'To withdraw, a tax of ₹900 per withdrawal must be paid first.']) assert.ok(!(await fires(t)), `documented gap: ${t}`)
})

test('D-6: wording outside the locked lists is not matched; inflections and spellings of locked words are', async () => {
  for (const t of ['Last step: pay ₹999 and you can withdraw immediately.', 'Deposit ₹1,000 to release your pending commission.', 'Deposit ₹2,000 into our task account today.', 'Fund your task account with ₹1,500 to open the order.', 'To cash out, pay ₹200 handling fee.', 'An activation fee of ₹500 is required to release your earnings.', 'A verification fee of ₹1,200 is payable to release your earnings.', 'Send only ₹500 to withdraw your earnings.']) assert.ok(!(await fires(t)), `documented gap: ${t}`)
  for (const t of ['Pay ₹1,500 so you can withdraw your earnings.', 'Remit ₹750 so that you can cash out your commission this evening.', 'A tax clearance fee of ₹450 must be paid to release your commission.', 'Deposit ₹1,000 to release your commission. Offer ends today!!!']) assert.ok(await fires(t), `must be flagged: ${t}`)
  for (const t of ["A genuine company won't ask you to pay to withdraw your salary.", "You shouldn't pay to withdraw your own earnings.", 'You never have to pay to withdraw your earnings.', "Don't ever pay to withdraw your earnings."]) assert.ok(!(await fires(t)), `negated, must stay unflagged: ${t}`)
})

test('D-2: "your earnings will be released after you pay ₹X", and its two known legitimate look-alikes', async () => {
  assert.ok(await fires('You completed 20 like tasks and earned ₹1,850. Your earnings will be released after you pay the ₹350 activation charge.'))
  assert.ok(await fires('Your payout will be released after you pay 5% tax.'))
  // KNOWN FALSE POSITIVES, pinned on the owner's instruction: both are legitimate, both are flagged.
  for (const t of ['Your salary will be credited after you pay back the ₹5,000 advance.', 'Your commission will be paid out once you pay the ₹1,000 annual membership renewal.']) assert.ok(await fires(t), `known false positive, still flagged: ${t}`)
  assert.ok(!(await fires('Your commission will be credited on the 5th of every month.')))
  assert.ok(!(await fires('Your money will be sent to the seller after you pay at checkout.')))
  for (const t of ['Your payout will be released once you pay your outstanding seller fees.', 'Your salary will be credited after you deposit the signed documents.']) assert.ok(!(await fires(t)), `no stated amount, must stay unflagged: ${t}`)
})

// ── "Pay ₹": the narrow suppression of the UPI tip ──────────────────────────
for (const c of cases.filter((x) => x.upiTip)) {
  test(`pay-rupee [${c.id}]: UPI tip ${c.upiTip} — ${c.note}`, async () => {
    const r = await quickCheck(c.text)
    assert.equal(r.advice.includes(UPI_TIP), c.upiTip === 'shown')
    assert.equal(r.advice.includes(ADVANCE_FEE_ADVICE), c.expect === 'signal')
  })
}

test('pay-rupee: the payment reference, the entities and its 6 points are untouched', async () => {
  const text = cases.find((x) => x.id === 'PR-06').text
  const ts = analyzeTextSignals(text)
  assert.deepEqual(ts.entities.qrPaymentRefs.map((s) => s.toLowerCase()), ['pay ₹'])
  assert.equal(upiTipIsUnrelated(ts.entities, ts.signals), true)
  const r = await quickCheck(text)
  assert.equal(r.riskScore, 28 + 12 + 12 + 6, 'danger + urgency + contact hand-off + the payment reference')
  assert.ok(!r.advice.includes(UPI_TIP))
})

test('pay-rupee: suppression needs the signal, and yields to any UPI-specific evidence', () => {
  const sig = [{ id: SIGNAL }]
  assert.equal(upiTipIsUnrelated({ upiIds: [], qrPaymentRefs: ['Pay ₹'] }, sig), true)
  assert.equal(upiTipIsUnrelated({ upiIds: [], qrPaymentRefs: ['Pay ₹'] }, []), false, 'no signal: never suppressed')
  assert.equal(upiTipIsUnrelated({ upiIds: ['a@ybl'], qrPaymentRefs: ['Pay ₹'] }, sig), false, 'a UPI ID keeps the tip')
  assert.equal(upiTipIsUnrelated({ upiIds: [], qrPaymentRefs: ['Pay ₹', 'QR code'] }, sig), false, 'QR wording keeps the tip')
  assert.equal(upiTipIsUnrelated({ upiIds: [], qrPaymentRefs: ['Pay ₹'] }, [...sig, { id: 'upi_reverse_payment' }]), false)
  assert.equal(upiTipIsUnrelated({ upiIds: [], qrPaymentRefs: ['Pay ₹'] }, [...sig, { id: 'fake_payment' }]), false)
  assert.equal(upiTipIsUnrelated({ upiIds: [], qrPaymentRefs: [] }, sig), false, 'nothing to suppress')
})

// ── Screenshot path: same detector list, same minimum, then the usual blend ──
for (const c of positives) {
  test(`screenshot carries the signal [${c.id}]: ${c.note || c.text.slice(0, 60)}`, async () => {
    const r = await screenshot(c.text)
    assert.ok(ids(r.visualSignals).includes(SIGNAL), `signal missing; got ${ids(r.visualSignals)}`)
    assert.equal(r.safetyAdvice[0], ADVANCE_FEE_ADVICE)
    assert.equal(r.verdict, c.screenshot.after.verdict)
    assert.equal(r.riskScore, c.screenshot.after.risk)
    assert.ok(r.riskScore >= c.screenshot.before.risk, `screenshot risk fell: ${c.screenshot.before.risk} → ${r.riskScore}`)
    assert.equal(r.deepAnalysisUsed, false, 'no image model in tests')
  })
}

test('screenshot: negatives gain no signal and no pay-to-get-paid advice', async () => {
  for (const c of negatives) {
    const r = await screenshot(c.text)
    assert.ok(!ids(r.visualSignals).includes(SIGNAL), c.id)
    assert.ok(!r.safetyAdvice.includes(ADVANCE_FEE_ADVICE), c.id)
  }
})

test('screenshot pay-rupee: the QR tip is dropped only in the narrow case', async () => {
  const only = await screenshot(cases.find((x) => x.id === 'PR-01').text)
  assert.ok(!only.safetyAdvice.includes(QR_TIP), 'only "Pay ₹": tip dropped')
  const withUpi = await screenshot(cases.find((x) => x.id === 'PR-02').text)
  assert.ok(withUpi.safetyAdvice.includes(QR_TIP), 'a UPI ID keeps the tip')
  const genuine = await screenshot(cases.find((x) => x.id === 'PR-05').text)
  assert.ok(genuine.safetyAdvice.includes(QR_TIP), 'no demand: unchanged')
})

// ── Classifier consistency: the category is not a score input ───────────────
test('classifier: wherever the signal fires the verdict warns, whatever the category', async () => {
  const seen = new Set()
  for (const c of positives) {
    const r = await quickCheck(c.text)
    seen.add(r.category)
    assert.ok(flagged(r.verdict), `${c.id}: category ${r.category}, verdict ${r.verdict}`)
  }
  assert.ok(seen.has('other'), 'covers messages the classifier calls "other"')
  assert.ok(seen.has('fake_job'), 'covers messages the classifier calls "fake_job"')
})

test('classifier: "fake_job" with no payment demand does not gain the signal', async () => {
  const jobOnly = negatives.filter((c) => c.classifier === 'fake_job')
  assert.ok(jobOnly.length >= 4, `only ${jobOnly.length} such cases`)
  for (const c of jobOnly) {
    const r = await quickCheck(c.text)
    assert.equal(r.category, 'fake_job', c.id)
    assert.ok(!ids(r.signals).includes(SIGNAL), c.id)
  }
})

test('classifier: each shared earnings term is both a "fake_job" trigger and tier 2 context', async () => {
  const terms = { 'work from home': 'Work from home with us.', 'part-time job': 'A part-time job for students.', 'earn … daily': 'You can earn ₹900 daily.', 'telegram task': 'Join the Telegram task team.' }
  assert.equal(JOB_EARNINGS_TERMS, String.raw`work from home|part[\s-]?time job|earn .{0,15}(?:daily|per day)|telegram task`, 'the shared terms changed: update this test and its four examples')
  const demand = 'Pay ₹300 to start.'
  assert.ok(!ids((await quickCheck(demand)).signals).includes(SIGNAL), 'the weak demand alone has no context')
  for (const [term, sentence] of Object.entries(terms)) {
    assert.equal(ruleClassify(sentence).category, 'fake_job', `classifier on "${term}"`)
    const r = await quickCheck(`${sentence} ${demand}`)
    assert.ok(ids(r.signals).includes(SIGNAL), `"${term}" must count as context`)
  }
  for (const generic of ['We are hiring.', 'Our recruit drive is open.', 'A registration fee applies.']) {
    assert.equal(ruleClassify(generic).category, 'fake_job', `classifier on "${generic}"`)
    assert.ok(!ids((await quickCheck(`${generic} ${demand}`)).signals).includes(SIGNAL), `"${generic}" must NOT count as context`)
  }
})

test('classifier: the category of every earlier test input is exactly what it was', () => {
  for (const x of frozen.inputs) assert.equal(ruleClassify(x.text).category, x.classifier, x.text.slice(0, 60))
})

// ── Frozen reference: nothing else moved ─────────────────────────────────────
test(`frozen reference: ${frozen.inputs.length} earlier test inputs keep verdict and score, except the listed change`, async () => {
  const intended = new Map(frozen.intendedChanges.map((c) => [c.text, c]))
  assert.equal(intended.size, 1)
  let changed = 0
  for (const x of frozen.inputs) {
    const r = await quickCheck(x.text)
    const want = intended.get(x.text)
    if (want) {
      changed++
      assert.deepEqual([r.verdict, r.riskScore], [want.after.verdict, want.after.risk])
      assert.ok(ids(r.signals).includes(SIGNAL))
    } else {
      assert.deepEqual([r.verdict, r.riskScore], [x.verdict, x.risk], x.text.slice(0, 80))
      assert.ok(!ids(r.signals).includes(SIGNAL), x.text.slice(0, 80))
    }
  }
  assert.equal(changed, 1)
})

// ── Owner rulings of 19 Oct 2026 ─────────────────────────────────────────────
test('ruling 19 Oct 2026: every remaining known false positive carries the owner\'s acceptance', () => {
  const kfp = cases.filter((c) => c.knownFalsePositive)
  assert.equal(kfp.length, 21)
  for (const c of kfp) assert.equal(c.acceptedByOwner, '2026-10-19', c.id)
  for (const id of ['SK-02', 'SK-06']) { const c = cases.find((x) => x.id === id); assert.ok(!c.knownFalsePositive && c.expect === 'signal' && c.relabelled, id) }
})

test('ruling 19 Oct 2026, class 1: awareness text with a negation is not a demand; the plain demand still is', async () => {
  for (const t of [cases.find((x) => x.id === 'FK-02').text, "You don't need to pay anything to withdraw your earnings.", 'You do not need to pay a fee to withdraw your earnings.', 'Never, ever pay ₹500 to withdraw your earnings.']) assert.ok(!(await fires(t)), `negated, must stay unflagged: ${t}`)
  for (const t of ['You need to pay ₹500 to withdraw your earnings.', 'You will need to pay ₹500 to withdraw your earnings.', 'Without delay, pay ₹500 to withdraw your earnings.']) assert.ok(await fires(t), `must be flagged: ${t}`)
})

test('ruling 19 Oct 2026, F-08: a victim\'s own report ("I / we … asked or told to") warns; other "asked / told to" stays awareness', async () => {
  for (const t of ['I was told to pay ₹500 to withdraw my earnings. Is this real?', 'I was asked to pay ₹500 to withdraw my earnings.', "I'm told to deposit ₹2,000 to withdraw my commission.", 'We were asked to pay ₹1,000 to withdraw our earnings.']) assert.ok(await fires(t), `must be flagged: ${t}`)
  for (const t of [cases.find((x) => x.id === 'AW-04').text, cases.find((x) => x.id === 'AW-05').text, 'Victims are told to pay a fee to withdraw their earnings.', 'If you are told to pay ₹500 to withdraw your earnings, it is a scam.', "You'll be asked to pay a fee to withdraw your earnings: never do it.", "If you're asked to deposit money to withdraw your commission, stop."]) assert.ok(!(await fires(t)), `awareness, must stay unflagged: ${t}`)
})

test('ruling 19 Oct 2026, Hinglish (option b): P1 adds no Hinglish pattern; those messages keep production results', async () => {
  const hinglish = cases.filter((x) => /^11/.test(x.category) && x.expect === 'none')
  assert.ok(hinglish.length >= 10)
  assert.equal(cases.find((x) => x.id === 'HG-12').expect, 'signal', 'an ENGLISH demand inside a mixed message is still flagged by the English rule')
  for (const c of hinglish) {
    const r = await quickCheck(c.text)
    assert.ok(!ids(r.signals).includes(SIGNAL), c.id)
    assert.deepEqual([r.verdict, r.riskScore], [c.before.verdict, c.before.risk], c.id)
  }
  assert.ok(!(await fires('Kamai nikalne ke liye pehle ₹1,000 jama karo.')))
})

test('C-2: the closing advice line is kept on both paths when many other lines apply (probe A-01)', async () => {
  const text = 'Pay ₹600 to withdraw your commission. Share the OTP sent to you. Visit http://paytm-kyc-update.xyz or pay to paytm.refund@ybl now.'
  const r = await quickCheck(text)
  assert.equal(r.advice[0], ADVANCE_FEE_ADVICE)
  assert.equal(r.advice.at(-1), CLOSING)
  assert.ok(r.advice.length <= 5, `${r.advice.length} advice lines`)
  const s = await screenshot(text)
  assert.equal(s.safetyAdvice[0], ADVANCE_FEE_ADVICE)
  assert.equal(s.safetyAdvice.at(-1), SS_CLOSING)
  assert.ok(s.safetyAdvice.length <= 6, `${s.safetyAdvice.length} tips`)
})

// ── Robustness ───────────────────────────────────────────────────────────────
test('C-1: 1 MB messages built from the review\'s stress shapes finish in near-linear time', () => {
  const fill = (unit, n) => unit.repeat(Math.ceil(n / unit.length)).slice(0, n)
  const time = (t) => { const t0 = performance.now(); analyzeTextSignals(t); return performance.now() - t0 }
  for (const unit of ['Pay ₹5 to withdraw your lottery winnings. ', 'Pay ₹5 to withdraw your lottery winnings, ', 'Pay ₹5 to withdraw your lottery winnings\n', 'Your commission is ready. Pay ₹5 to unlock your bonus. ', 'commission, pay ₹5 to unlock your bonus, ']) {
    const small = time(fill(unit, 131_072)), big = time(fill(unit, 1_048_576))
    assert.ok(big < 5000, `${Math.round(big)} ms at 1 MB for "${unit.trim()}"`)
    assert.ok(big < 16 * Math.max(small, 25), `8× the input took ${Math.round(small)} → ${Math.round(big)} ms for "${unit.trim()}"`)
  }
})

test('robustness: 10,000-character messages, including shapes built to stress the patterns, finish quickly', () => {
  const fill = (unit) => unit.repeat(Math.ceil(10_000 / unit.length)).slice(0, 10_000)
  const inputs = [
    fill('Your order has shipped and will arrive on Tuesday between 9 and 11 in the morning '),
    fill('pay '), fill('pay ₹5 to '), fill('send ₹5 and get ₹5 and get ₹5 '), fill('to withdraw pay '),
    fill('withdrawal ke liye '), fill('deposit, recharge or top up before you can '), fill('a verification fee is required '),
  ]
  for (const text of inputs) {
    assert.equal(text.length, 10_000)
    const t0 = performance.now()
    analyzeTextSignals(text)
    const ms = performance.now() - t0
    assert.ok(ms < 1500, `${Math.round(ms)} ms for "${text.slice(0, 30)}…"`)
  }
})

test('robustness: the handlers made no network call', () => {
  assert.deepEqual(fetchCalls, [])
})
