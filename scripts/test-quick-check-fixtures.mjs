#!/usr/bin/env node
// Fixtures for the quick-check pipeline (text/link/email/phone) — mirrors
// lib/scam-intel/{multimodal DETECTORS, url-intel, reputation}. Verifies scams
// are flagged AND legitimate business domains/emails are NOT (low false positives).
// Run: node scripts/test-quick-check-fixtures.mjs

const DETECTORS = [
  { id: 'fake_payment', sev: 'danger', re: /\b(refund (of|credited|received|amount|ke liye)|you (have )?received (rs|₹|inr|money|a refund)|money received|cashback (of|credited)|scan (the |this )?qr|collect request|claim (your|rs|₹)|received a refund)\b|congratulations[^.\n]{0,40}(refund|cashback|won|prize)/i },
  { id: 'urgency', sev: 'warn', re: /\b(urgent|immediately|within \d+\s?(min|hour|day)s?|account (will be )?(blocked|suspended|closed)|act now|last chance|expir(?:e|es|ing|ed)|failure to|do not ignore|warna|jaldi|turant)\b/i },
  { id: 'otp_request', sev: 'danger', re: /(?<!do not )(?<!don'?t )(?<!never )\b(share|send|tell|give|enter|forward)\b[^.\n]{0,15}\b(otp|one[\s-]?time password|cvv|pin|code)\b|\b(otp|cvv|pin|code)\b[^.\n]{0,14}\b(bhejo|batao|share karo|chahiye)\b/i },
  { id: 'kyc_phish', sev: 'warn', re: /\b(kyc|verify your account|update (your )?(kyc|pan|details)|re-?activate|kyc (update|karo))\b/i },
  { id: 'impersonation', sev: 'warn', re: /\b(rbi|sbi|hdfc|icici|axis|kotak|pnb|paytm|phonepe|google ?pay|amazon|flipkart|india ?post|fedex|customer care|income tax)\b/i },
  { id: 'reward_bait', sev: 'warn', re: /\b(congratulations|you (have )?won|lottery|prize|reward|work from home|earn \d|part[\s-]?time job|guaranteed return)\b/i },
  { id: 'suspicious_link', sev: 'danger', re: /\b(bit\.ly|tinyurl|t\.me|wa\.me|cutt\.ly|http:\/\/|[a-z0-9-]+\.(xyz|top|click|info|live|buzz)\b)/i },
]
const URLRE = /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s)]*)?)/gi
const SUS_TLD = /\.(xyz|top|click|info|live|buzz|tk|ml|ga)$/i
const TRUSTED = ['asquaresolution.com', 'scamcheck.asquaresolution.com', 'sbi.co.in', 'hdfcbank.com', 'icicibank.com', 'paytm.com', 'amazon.in', 'indiapost.gov.in', 'gov.in']
const STRONG = new Set(['otp_request', 'fake_payment', 'suspicious_link'])

const rootOf = (u) => u.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0]
const isTrusted = (host) => { const h = rootOf(host); return TRUSTED.some((d) => h === d || h.endsWith('.' + d)) }
const isSus = (host) => SUS_TLD.test(rootOf(host)) || /xn--/.test(rootOf(host))

function predict(type, value) {
  const signals = DETECTORS.filter((d) => d.re.test(value)).map((d) => ({ id: d.id, sev: d.sev }))
  const urls = [...new Set((value.match(URLRE) || []).filter((u) => u.includes('.') && !/@/.test(u)))]
  const checkDomains = type === 'link' ? [value, ...urls] : type === 'email' ? [(value.split('@')[1] || '')] : urls
  const urlDanger = checkDomains.filter(isSus).length
  const danger = signals.filter((s) => s.sev === 'danger').length
  const warn = signals.filter((s) => s.sev === 'warn').length
  let risk = Math.min(100, danger * 28 + warn * 12 + urlDanger * 10)
  if (signals.some((s) => s.id === 'otp_request')) risk = Math.max(risk, 55)
  const strong = signals.some((s) => STRONG.has(s.id)) || urlDanger > 0
  const trusted = checkDomains.some(isTrusted) && !strong && !checkDomains.some(isSus)
  if (trusted) risk = Math.min(risk, 15)
  return { scam: risk >= 35, risk, trusted, signals: signals.map((s) => s.id) }
}

const FIXTURES = [
  { name: 'phishing SMS (fake SBI KYC)', type: 'message', value: 'Your SBI account will be BLOCKED today. Verify KYC immediately at http://sbi-kyc-verify.xyz', expectScam: true },
  { name: 'fake banking alert (HDFC)', type: 'message', value: 'Unusual login detected on your HDFC account. Re-activate within 24 hours at http://hdfc-secure.top or it will be suspended.', expectScam: true },
  { name: 'fake UPI refund request', type: 'message', value: 'You have received a refund of Rs 4,999. Scan the QR or approve the collect request in your PhonePe app to credit it.', expectScam: true },
  { name: 'fake job scam', type: 'message', value: 'Congratulations! Work from home and earn 5000 daily. Pay Rs 199 registration to start: bit.ly/wfh-join', expectScam: true },
  { name: 'legit business email (A Square Solutions)', type: 'email', value: 'support@asquaresolution.com', expectScam: false },
  { name: 'legit bank email (HDFC official)', type: 'email', value: 'alerts@hdfcbank.com', expectScam: false },
  { name: 'legit link (gov.in)', type: 'link', value: 'https://cybercrime.gov.in', expectScam: false },
]

let fail = 0
for (const f of FIXTURES) {
  const p = predict(f.type, f.value)
  const ok = p.scam === f.expectScam
  if (!ok) fail++
  console.log(`${ok ? '✓' : '✗'} ${f.name.padEnd(40)} pred=${p.scam ? 'scam' : 'safe'} risk=${p.risk}${p.trusted ? ' (trusted)' : ''} [${p.signals.join(',')}]`)
}
console.log(`\n${FIXTURES.length - fail}/${FIXTURES.length} passed${fail ? ' — FAILURES present' : ' — low false positives on legit domains'}`)
process.exit(fail ? 1 : 0)
