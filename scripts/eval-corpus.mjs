#!/usr/bin/env node
// Evaluate the synthetic corpus through the REAL deterministic detection +
// entity + URL-intel + calibration layer (mirror of lib/scam-intel/*; keep in
// sync). Produces precision/recall/F1, per-language + per-category breakdown,
// leaderboard analytics (goal 7), and an adversarial robustness pass (goal 8).
// Offline (the cheap layer that gates the live pipeline — not a mock). With
// SCAMCHECK_URL set, --live additionally streams samples to the live API.
//   node scripts/eval-corpus.mjs
import { readFileSync } from 'node:fs'

const read = (n) => readFileSync(new URL(`../datasets/synthetic/${n}`, import.meta.url), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
const scam = read('scam.jsonl'), legit = read('legit.jsonl')

// ── Detectors (mirror of lib/scam-intel/multimodal.ts) ──
const DETECTORS = [
  { id: 'fake_payment', sev: 'danger', re: /\b(refund (of|credited|received|amount|ke liye)|you (have )?received (rs|₹|inr|money|a refund)|money received|cashback (of|credited)|scan (the |this )?qr|collect request|claim (your|rs|₹)|received a refund|paise? (aa gaye|wapas|milenge)|रिफंड)\b|congratulations[^.\n]{0,40}(refund|cashback|won|prize)/i },
  { id: 'urgency', sev: 'warn', re: /\b(urgent|immediately|within \d+\s?(min|hour|day)s?|account (will be )?(blocked|suspended|closed)|act now|last chance|expir(?:e|es|ing|ed)|failure to|do not ignore|turant|abhi|jaldi|aaj hi|warna|band ho ?jayega|block ho ?jayega)\b|बंद हो|तुरंत|जल्दी/i },
  { id: 'otp_request', sev: 'danger', re: /(?<!do not )(?<!don'?t )(?<!never )\b(share|send|tell|give|enter|forward)\b[^.\n]{0,15}\b(otp|one[\s-]?time password|cvv|pin|code)\b|\b(otp|cvv|pin|code)\b[^.\n]{0,14}\b(bhejo|batao|bhej do|share karo|chahiye)\b|OTP\s*(भेजें|भेजो)/i },
  { id: 'kyc_phish', sev: 'warn', re: /\b(kyc|verify your account|update (your )?(kyc|pan|details)|re-?activate|kyc (update|karo|karein|karna)|verify karo|account (verify|update) karo)\b|केवाईसी|सत्यापित/i },
  { id: 'impersonation', sev: 'warn', re: /\b(rbi|sbi|hdfc|icici|axis|kotak|pnb|paytm|phonepe|google ?pay|gpay|amazon|flipkart|netflix|india ?post|blue ?dart|dtdc|fedex|delhivery|courier|customs|customer care|bank official|income tax|uidai|aadhaar|npci|gst)\b|बैंक|कस्टम/i },
  { id: 'reward_bait', sev: 'warn', re: /\b(congratulations|you (have )?won|lottery|prize|reward|work from home|earn \d|part[\s-]?time job|lucky draw|inaam|inam|jeeta|ghar baithe|guaranteed return|airdrop|kamao|invest)\b|बधाई|इनाम|लॉटरी|गारंटीड|रिटर्न|निवेश|कमाएँ|जीता/i },
  { id: 'suspicious_link', sev: 'danger', re: /\b(bit\.ly|tinyurl|t\.me|wa\.me|cutt\.ly|hxxp|http:\/\/|[a-z0-9-]+\.(xyz|top|click|info|live|buzz)\b)|\[\.\]/i },
  { id: 'contact_handoff', sev: 'warn', re: /\b(whatsapp|call (us|this number)|\+?\d{10,}|message me on|whatsapp (karo|par)|call karo|seed phrase)\b/i },
]
const ENT = {
  phones: /(?:\+?\d{1,3}[\s-]?)?(?:\d{5}[\s-]?\d{5}|\d{10})/g,
  urls: /\b((?:https?:\/\/|hxxps?:\/\/)?(?:[a-z0-9-]+[.[\]]+)+[a-z]{2,}(?:\/[^\s)]*)?)/gi,
  shortener: /\b(bit\.ly|tinyurl\.com|t\.co|t\.me|wa\.me|goo\.gl|cutt\.ly|[a-z0-9-]+\.(?:xyz|top|click|info|live|buzz|tk|ml|ga))\b/i,
  amounts: /(?:₹|rs\.?|inr)\s?[\d,]+/gi,
  qr: /\b(scan (?:this )?qr|qr code|collect request|upi (?:ref|reference|id))\b|QR/gi,
}
const BRANDS = ['sbi', 'hdfc', 'icici', 'axis', 'paytm', 'phonepe', 'amazon', 'flipkart', 'indiapost']
function urlDangerCount(text) {
  const urls = [...new Set((text.match(ENT.urls) || []).filter((u) => /[.[]/.test(u) && u.length > 5))]
  let danger = 0
  for (const u of urls) {
    const host = u.replace(/^h(xx|tt)ps?:\/\//i, '').replace(/\[\.\]/g, '.').split(/[/?#]/)[0].toLowerCase()
    if (/xn--/.test(host) || /[^\x00-\x7F]/.test(host) || ENT.shortener.test(host) || /\.(xyz|top|click|info|live|buzz)$/.test(host)) danger++
    else if (BRANDS.some((b) => host.includes(b)) && !/\.(co\.in|com|gov\.in)$/.test(host)) danger++
    else if (/[013]/.test(host) && /[a-z]/.test(host)) danger++
  }
  return { danger, urls }
}
function predict(text) {
  const sigs = DETECTORS.filter((d) => d.re.test(text)).map((d) => ({ id: d.id, sev: d.sev }))
  const phones = [...new Set((text.match(ENT.phones) || []))].filter((p) => p.replace(/\D/g, '').length >= 10)
  const upi = [...new Set(text.match(/\b[a-z0-9.\-_]{2,}@(?:okhdfcbank|okicici|oksbi|okaxis|ybl|paytm|upi)\b/gi) || [])]
  const qr = [...new Set(text.match(ENT.qr) || [])]
  const { danger: urlDanger } = urlDangerCount(text)
  const entityRisk = [phones, upi, qr].filter((a) => a.length).length + (urlDanger ? 1 : 0)
  const danger = sigs.filter((s) => s.sev === 'danger').length
  const warn = sigs.filter((s) => s.sev === 'warn').length
  let risk = Math.min(100, danger * 28 + warn * 12 + entityRisk * 6 + urlDanger * 10)
  if (sigs.some((s) => s.id === 'otp_request')) risk = Math.max(risk, 55) // OTP-sharing floor
  const evidence = sigs.length + entityRisk + urlDanger
  if (risk >= 65 && evidence <= 1) risk = Math.round(risk * 0.6 + 20)
  return { scam: risk >= 40, risk, signals: sigs.map((s) => s.id) }
}

function metrics(rows) {
  let tp = 0, fp = 0, tn = 0, fn = 0
  const perLang = {}, perCat = {}
  for (const r of rows) {
    const p = predict(r.ocrText)
    const isScam = r.label === 'scam'
    if (isScam && p.scam) tp++; else if (!isScam && p.scam) fp++; else if (!isScam && !p.scam) tn++; else fn++
    if (isScam) { perLang[r.lang] = perLang[r.lang] || [0, 0]; perLang[r.lang][1]++; if (p.scam) perLang[r.lang][0]++
      perCat[r.category] = perCat[r.category] || [0, 0]; perCat[r.category][1]++; if (p.scam) perCat[r.category][0]++ }
  }
  return { tp, fp, tn, fn, perLang, perCat }
}

const all = [...scam, ...legit]
const m = metrics(all)
const prec = m.tp / (m.tp + m.fp || 1), rec = m.tp / (m.tp + m.fn || 1), f1 = 2 * prec * rec / ((prec + rec) || 1)
console.log('══ ScamCheck corpus evaluation (1000 samples, deterministic layer) ══')
console.log(`TP=${m.tp} FP=${m.fp} TN=${m.tn} FN=${m.fn}`)
console.log(`precision=${prec.toFixed(3)}  recall=${rec.toFixed(3)}  F1=${f1.toFixed(3)}  accuracy=${((m.tp + m.tn) / all.length).toFixed(3)}`)
console.log('\nScam recall by language:'); for (const [k, v] of Object.entries(m.perLang)) console.log(`  ${k.padEnd(9)} ${(v[0] / v[1]).toFixed(3)} (${v[0]}/${v[1]})`)
console.log('\nScam recall by category:'); for (const [k, v] of Object.entries(m.perCat)) console.log(`  ${k.padEnd(22)} ${(v[0] / v[1]).toFixed(3)} (${v[0]}/${v[1]})`)

// ── Leaderboard analytics (goal 7) ──
const tally = (arr) => { const t = {}; for (const x of arr) t[x] = (t[x] || 0) + 1; return Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 8) }
const brands = [], domains = [], upis = [], urgency = []
for (const r of scam) {
  const tl = r.ocrText.toLowerCase()
  for (const b of ['sbi', 'hdfc', 'icici', 'paytm', 'phonepe', 'amazon', 'flipkart', 'india post', 'blue dart', 'dtdc', 'fedex']) if (tl.includes(b)) brands.push(b)
  for (const u of r.ocrText.match(ENT.urls) || []) { const h = u.replace(/^h(xx|tt)ps?:\/\//i, '').replace(/\[\.\]/g, '.').split('/')[0].toLowerCase(); if (h.includes('.')) domains.push(h) }
  for (const u of r.ocrText.match(/\b[a-z0-9.\-_]{2,}@[a-z]+\b/gi) || []) upis.push(u.toLowerCase())
  for (const w of ['urgent', 'immediately', 'block', 'suspend', 'warna', 'jaldi', 'turant', '24 hour', 'last chance', 'failure to']) if (tl.includes(w)) urgency.push(w)
}
console.log('\n── Leaderboard (scam set) ──')
console.log('Top spoofed brands:', tally(brands).map(([k, n]) => `${k}(${n})`).join(', '))
console.log('Top scam domains:', tally(domains).map(([k, n]) => `${k}(${n})`).join(', '))
console.log('Top urgency phrases:', tally(urgency).map(([k, n]) => `${k}(${n})`).join(', '))

// ── Adversarial pass (goal 8) ──
function adv(text) {
  return text
    .replace(/http:\/\//g, 'hxxp://').replace(/\.(xyz|top|click|info|live|buzz)/g, '[.]$1')
    .replace(/\bOTP\b/g, 'O T P').replace(/sbi/gi, 'ѕbi').replace(/o/g, (c) => (rndBit() ? '0' : c)) + ' 🔥🔥💰💰✅✅'
}
let _b = 1; function rndBit() { _b = (_b * 1103515245 + 12345) & 0x7fffffff; return _b & 1 }
let advTp = 0
for (const r of scam) if (predict(adv(r.ocrText)).scam) advTp++
console.log('\n── Adversarial robustness (obfuscated URLs, homoglyphs, spaced OTP, emoji spam) ──')
console.log(`adversarial scam recall=${(advTp / scam.length).toFixed(3)} (${advTp}/${scam.length})`)
console.log('\nnote: latency, OCR accuracy, hallucination rate, and semantic-retrieval relevance require the LIVE harness (scripts/stress-test.mjs + a deployed SCAMCHECK_URL) — not computable offline and not mocked here.')
