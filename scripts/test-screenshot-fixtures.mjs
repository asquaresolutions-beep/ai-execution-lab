#!/usr/bin/env node
// Runnable smoke test for multimodal ScamCheck detection (task 11).
// Node can't import the TS modules, so this MIRRORS the canonical detectors in
// lib/scam-intel/multimodal.ts (DETECTORS) + lib/scam-intel/extract-entities.ts
// (RE) — keep them in sync. It validates that each fixture's OCR text triggers
// the expected signals + entities. Run: node scripts/test-screenshot-fixtures.mjs

// ── Fixtures (mirror of lib/scam-intel/__fixtures__/screenshot-scams.ts) ──
const FIXTURES = [
  { name: 'fake SBI SMS', ocrText: 'Dear Customer, your SBI account will be BLOCKED today due to incomplete KYC. Update immediately at http://sbi-kyc-verify.xyz or your account is suspended. For help call 9876543210. - SBI',
    expect: { mustSignals: ['kyc_phish', 'urgency', 'impersonation', 'suspicious_link'], mustEntities: ['urls', 'shorteners', 'phones'], minRisk: 60 } },
  { name: 'fake courier customs screenshot', ocrText: 'India Post: Your parcel is held at customs clearance. A customs fee of Rs 25 is pending. Pay now to release your package: http://bit.ly/parcel-clear-pay. Failure to pay within 24 hours will return the parcel.',
    expect: { mustSignals: ['suspicious_link', 'impersonation', 'urgency'], mustEntities: ['urls', 'shorteners', 'amounts'], minRisk: 50 } },
  { name: 'fake UPI refund scam', ocrText: 'Congratulations! You have received a refund of ₹4,999. To credit the amount, scan the QR code below or approve the collect request in your UPI app (PhonePe/Google Pay). Refund reference UPI REF 8821934.',
    expect: { mustSignals: ['fake_payment', 'reward_bait', 'impersonation'], mustEntities: ['amounts', 'qrPaymentRefs'], minRisk: 55 } },
  { name: 'fake KYC verification image', ocrText: 'URGENT: Your HDFC Bank PAN-Aadhaar KYC is incomplete and your account is suspended. Verify now at http://hdfc-kyc.top within 24 hours. Share the OTP sent to your phone to confirm. Do not ignore this message.',
    expect: { mustSignals: ['kyc_phish', 'otp_request', 'urgency', 'impersonation', 'suspicious_link'], mustEntities: ['urls', 'shorteners'], minRisk: 70 } },
]

// ── Detectors (mirror of multimodal.ts DETECTORS) ──
const DETECTORS = [
  { id: 'fake_payment', sev: 'danger', re: /\b(payment successful|₹\s?\d|paid to|upi ref|transaction id|money received|credited|debited|cashback)\b/i },
  { id: 'urgency', sev: 'warn', re: /\b(urgent|immediately|within \d+\s?(min|hour|day)s?|account (will be )?(blocked|suspended|closed)|act now|last chance|expir(?:e|es|ing|ed)|failure to|do not ignore)\b/i },
  { id: 'otp_request', sev: 'danger', re: /\b(otp|one[\s-]?time password|cvv|pin|share .*code|do not share)\b/i },
  { id: 'kyc_phish', sev: 'danger', re: /\b(kyc|verify your account|update (your )?(kyc|pan|details)|re-?activate)\b/i },
  { id: 'impersonation', sev: 'warn', re: /\b(rbi|sbi|hdfc|icici|axis|kotak|pnb|paytm|phonepe|google ?pay|gpay|amazon|flipkart|netflix|india ?post|blue ?dart|dtdc|fedex|delhivery|courier|customs|customer care|bank official|income tax|uidai|aadhaar|npci|gst)\b/i },
  { id: 'reward_bait', sev: 'warn', re: /\b(congratulations|you (have )?won|lottery|prize|reward|work from home|earn \d|part[\s-]?time job)\b/i },
  { id: 'suspicious_link', sev: 'danger', re: /\b(bit\.ly|tinyurl|t\.me|wa\.me|http:\/\/|[a-z0-9-]+\.(xyz|top|click|info)\b)/i },
  { id: 'contact_handoff', sev: 'warn', re: /\b(whatsapp|call (us|this number)|\+?\d{10,}|message me on)\b/i },
]
// ── Entity regexes (mirror of extract-entities.ts RE) ──
const ENT = {
  phones: /(?:\+?\d{1,3}[\s-]?)?(?:\d{5}[\s-]?\d{5}|\d{10}|\d{3}[\s-]?\d{3}[\s-]?\d{4})/g,
  urls: /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s)]*)?)/gi,
  shortener: /\b(bit\.ly|tinyurl\.com|t\.co|t\.me|wa\.me|goo\.gl|cutt\.ly|rb\.gy|is\.gd|rebrand\.ly|[a-z0-9-]+\.(?:xyz|top|click|info|live|buzz|tk|ml|ga))\b/i,
  amounts: /(?:₹|rs\.?|inr)\s?[\d,]+(?:\.\d{1,2})?|\b[\d,]{3,}\s?(?:rupees|rs)\b/gi,
  qrPaymentRefs: /\b(scan (?:this )?qr|qr code|collect request|payment request|upi (?:ref|reference|id)|merchant (?:vpa|id)|pay ₹|request money)\b/gi,
}
function entitiesOf(t) {
  const urls = [...new Set((t.match(ENT.urls) || []).filter((u) => !/@/.test(u) && u.includes('.')))]
  return {
    phones: [...new Set((t.match(ENT.phones) || []).map((p) => p.replace(/[\s-]/g, '')).filter((p) => p.replace(/\D/g, '').length >= 10 && p.replace(/\D/g, '').length <= 13))],
    urls,
    shorteners: urls.filter((u) => ENT.shortener.test(u)),
    amounts: [...new Set(t.match(ENT.amounts) || [])],
    qrPaymentRefs: [...new Set(t.match(ENT.qrPaymentRefs) || [])],
  }
}
function signalsOf(t) { return DETECTORS.filter((d) => d.re.test(t)).map((d) => ({ id: d.id, sev: d.sev })) }
function riskOf(signals, entityRisk) {
  const danger = signals.filter((s) => s.sev === 'danger').length
  const warn = signals.filter((s) => s.sev === 'warn').length
  return Math.min(100, danger * 28 + warn * 12 + entityRisk * 6)
}

let failures = 0
for (const f of FIXTURES) {
  const sigs = signalsOf(f.ocrText)
  const sigIds = sigs.map((s) => s.id)
  const ents = entitiesOf(f.ocrText)
  const entRisk = (ents.shorteners.length ? 1 : 0) + (ents.qrPaymentRefs.length ? 1 : 0) + (ents.phones.length ? 1 : 0) + (ents.amounts.length ? 1 : 0)
  const risk = riskOf(sigs, entRisk)

  const missingSignals = f.expect.mustSignals.filter((s) => !sigIds.includes(s))
  const missingEntities = f.expect.mustEntities.filter((k) => !(ents[k] && ents[k].length))
  const riskOk = risk >= f.expect.minRisk
  const ok = !missingSignals.length && !missingEntities.length && riskOk

  console.log(`${ok ? '✓ PASS' : '✗ FAIL'}  ${f.name}  risk=${risk}`)
  console.log(`        signals: ${sigIds.join(', ') || '(none)'}`)
  console.log(`        entities: phones=${ents.phones.length} urls=${ents.urls.length} short=${ents.shorteners.length} amounts=${ents.amounts.length} qr=${ents.qrPaymentRefs.length}`)
  if (!ok) {
    failures++
    if (missingSignals.length) console.log(`        MISSING signals: ${missingSignals.join(', ')}`)
    if (missingEntities.length) console.log(`        MISSING entities: ${missingEntities.join(', ')}`)
    if (!riskOk) console.log(`        risk ${risk} < expected ${f.expect.minRisk}`)
  }
}
console.log(`\n${FIXTURES.length - failures}/${FIXTURES.length} fixtures passed.`)
process.exit(failures ? 1 : 0)
