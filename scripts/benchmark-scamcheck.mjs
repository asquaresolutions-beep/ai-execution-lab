#!/usr/bin/env node
// Benchmark ScamCheck against the labeled eval dataset (goal 2). Mirrors the
// REAL deterministic detection + entity extraction + calibration thresholds in
// lib/scam-intel/{multimodal,extract-entities,calibration}.ts (keep in sync).
// Offline by default; pass SCAMCHECK_URL to also hit the live screenshot API
// (text fixtures POST to /api/scam-intel/similar for the live classification).
//   node scripts/benchmark-scamcheck.mjs
//   SCAMCHECK_URL=https://... node scripts/benchmark-scamcheck.mjs --live
import { readFileSync } from 'node:fs'

const scam = JSON.parse(readFileSync(new URL('../datasets/scam-samples/manifest.json', import.meta.url)))
const legit = JSON.parse(readFileSync(new URL('../datasets/legit-samples/manifest.json', import.meta.url)))

// ── Detectors (mirror of lib/scam-intel/multimodal.ts DETECTORS) ──
const DETECTORS = [
  { id: 'fake_payment', sev: 'danger', re: /\b(refund (of|credited|received|amount|ke liye)|you (have )?received (rs|₹|inr|money|a refund)|money received|cashback (of|credited)|scan (the |this )?qr|collect request|claim (your|rs|₹)|received a refund|paise? (aa gaye|wapas|milenge))\b|congratulations[^.\n]{0,40}(refund|cashback|won|prize)/i },
  { id: 'urgency', sev: 'warn', re: /\b(urgent|immediately|within \d+\s?(min|hour|day)s?|account (will be )?(blocked|suspended|closed)|act now|last chance|expir(?:e|es|ing|ed)|failure to|do not ignore|turant|abhi|jaldi|aaj hi|warna|band ho ?jayega|block ho ?jayega)\b/i },
  { id: 'otp_request', sev: 'danger', re: /(?<!do not )(?<!don'?t )(?<!never )\b(share|send|tell|give|enter|forward)\b[^.\n]{0,15}\b(otp|one[\s-]?time password|cvv|pin|code)\b|\b(otp|cvv|pin|code)\b[^.\n]{0,14}\b(bhejo|batao|bhej do|share karo|chahiye)\b/i },
  { id: 'kyc_phish', sev: 'warn', re: /\b(kyc|verify your account|update (your )?(kyc|pan|details)|re-?activate|kyc (update|karo|karein|karna)|verify karo|account (verify|update) karo)\b/i },
  { id: 'impersonation', sev: 'warn', re: /\b(rbi|sbi|hdfc|icici|axis|kotak|pnb|paytm|phonepe|google ?pay|gpay|amazon|flipkart|netflix|india ?post|blue ?dart|dtdc|fedex|delhivery|courier|customs|customer care|bank official|income tax|uidai|aadhaar|npci|gst)\b/i },
  { id: 'reward_bait', sev: 'warn', re: /\b(congratulations|you (have )?won|lottery|prize|reward|work from home|earn \d|part[\s-]?time job|lucky draw|inaam|inam|jeeta|ghar baithe)\b/i },
  { id: 'suspicious_link', sev: 'danger', re: /\b(bit\.ly|tinyurl|t\.me|wa\.me|http:\/\/|[a-z0-9-]+\.(xyz|top|click|info)\b)/i },
  { id: 'contact_handoff', sev: 'warn', re: /\b(whatsapp|call (us|this number)|\+?\d{10,}|message me on|whatsapp (karo|par)|call karo)\b/i },
]
const ENT = {
  phones: /(?:\+?\d{1,3}[\s-]?)?(?:\d{5}[\s-]?\d{5}|\d{10}|\d{3}[\s-]?\d{3}[\s-]?\d{4})/g,
  urls: /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s)]*)?)/gi,
  shortener: /\b(bit\.ly|tinyurl\.com|t\.co|t\.me|wa\.me|goo\.gl|cutt\.ly|[a-z0-9-]+\.(?:xyz|top|click|info|live|buzz|tk|ml|ga))\b/i,
  amounts: /(?:₹|rs\.?|inr)\s?[\d,]+(?:\.\d{1,2})?|\b[\d,]{3,}\s?(?:rupees|rs)\b/gi,
  qrPaymentRefs: /\b(scan (?:this )?qr|qr code|collect request|payment request|upi (?:ref|reference|id)|merchant (?:vpa|id)|pay ₹|request money)\b/gi,
}
function entitiesOf(t) {
  const urls = [...new Set((t.match(ENT.urls) || []).filter((u) => !/@/.test(u) && u.includes('.')))]
  return {
    phones: [...new Set((t.match(ENT.phones) || []).map((p) => p.replace(/[\s-]/g, '')).filter((p) => p.replace(/\D/g, '').length >= 10 && p.replace(/\D/g, '').length <= 13))],
    urls, shorteners: urls.filter((u) => ENT.shortener.test(u)),
    amounts: [...new Set(t.match(ENT.amounts) || [])], qrPaymentRefs: [...new Set(t.match(ENT.qrPaymentRefs) || [])],
  }
}
// Calibration-lite (mirror of calibration.ts thresholds) → predicted scam?
function predict(text) {
  const sigs = DETECTORS.filter((d) => d.re.test(text)).map((d) => ({ id: d.id, sev: d.sev }))
  const e = entitiesOf(text)
  const entityRisk = [e.shorteners, e.upiIds || [], e.qrPaymentRefs, e.phones].filter((a) => a && a.length).length + (e.amounts.length ? 0 : 0)
  const urlDanger = e.shorteners.length ? 1 : 0
  const danger = sigs.filter((s) => s.sev === 'danger').length
  const warn = sigs.filter((s) => s.sev === 'warn').length
  let risk = Math.min(100, danger * 28 + warn * 12 + entityRisk * 6 + urlDanger * 10)
  const evidence = sigs.length + entityRisk + urlDanger
  if (risk >= 65 && evidence <= 1) risk = Math.round(risk * 0.6 + 50 * 0.4) // uncertainty penalty
  return { scam: risk >= 40, risk, signals: sigs.map((s) => s.id), entities: e }
}

function evaluate(samples, gold) {
  return samples.map((s) => {
    const p = predict(s.ocrText)
    const entOk = (s.expectEntities || []).every((k) => p.entities[k] && p.entities[k].length)
    return { id: s.id, gold, predScam: p.scam, risk: p.risk, signals: p.signals, entOk, expectEntities: s.expectEntities || [] }
  })
}

const results = [...evaluate(scam.samples, true), ...evaluate(legit.samples, false)]
let tp = 0, fp = 0, tn = 0, fn = 0
for (const r of results) {
  if (r.gold && r.predScam) tp++
  else if (!r.gold && r.predScam) fp++
  else if (!r.gold && !r.predScam) tn++
  else fn++
  const mark = (r.gold === r.predScam) ? '✓' : '✗'
  console.log(`${mark} ${r.id.padEnd(26)} gold=${r.gold ? 'scam' : 'legit'} pred=${r.predScam ? 'scam' : 'legit'} risk=${String(r.risk).padStart(3)} [${r.signals.join(',')}]`)
}
const prec = tp / (tp + fp || 1)
const rec = tp / (tp + fn || 1)
const f1 = 2 * prec * rec / ((prec + rec) || 1)
const entChecked = results.filter((r) => r.expectEntities.length)
const entAcc = entChecked.filter((r) => r.entOk).length / (entChecked.length || 1)

console.log('\n── Benchmark (deterministic layer vs labeled dataset) ──')
console.log(`samples: ${results.length} (scam ${scam.samples.length}, legit ${legit.samples.length})`)
console.log(`TP=${tp} FP=${fp} TN=${tn} FN=${fn}`)
console.log(`precision=${prec.toFixed(3)}  recall=${rec.toFixed(3)}  F1=${f1.toFixed(3)}  accuracy=${((tp + tn) / results.length).toFixed(3)}`)
console.log(`entity-extraction accuracy=${entAcc.toFixed(3)} (${entChecked.length} samples with expected entities)`)
console.log('note: OCR accuracy, semantic-retrieval relevance, and hallucination rate require a LIVE run with real images (set SCAMCHECK_URL) + Vertex; not computable offline.')
process.exit(0)
