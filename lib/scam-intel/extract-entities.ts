// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/extract-entities.ts
// Deterministic entity + signal extraction from OCR'd screenshot text.
// Pure (no Vertex cost) — phone numbers, URLs, link shorteners, UPI IDs,
// QR/payment references, amounts, urgency + impersonation markers. Feeds the
// trustscore / semantic-search / scam-intel pipelines and the screenshot UI.
// ─────────────────────────────────────────────────────────────────

export interface ExtractedEntities {
  phones: string[]
  urls: string[]
  shorteners: string[]      // subset of urls that are link shorteners / risky TLDs
  upiIds: string[]          // name@bank VPAs
  amounts: string[]         // ₹ / Rs / INR amounts
  qrPaymentRefs: string[]   // QR / collect-request / payment-reference mentions
  urgencyMarkers: string[]
  impersonationMarkers: string[]
}

const RE = {
  // Indian + intl phone numbers (10-13 digits, optional +country, spacing).
  phone: /(?:\+?\d{1,3}[\s-]?)?(?:\d{5}[\s-]?\d{5}|\d{10}|\d{3}[\s-]?\d{3}[\s-]?\d{4})/g,
  url: /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s)]*)?)/gi,
  shortener: /\b(bit\.ly|tinyurl\.com|t\.co|t\.me|wa\.me|goo\.gl|cutt\.ly|rb\.gy|is\.gd|rebrand\.ly|[a-z0-9-]+\.(?:xyz|top|click|info|live|buzz|tk|ml|ga))\b/i,
  upi: /\b[a-z0-9.\-_]{2,}@(?:okhdfcbank|okicici|oksbi|okaxis|ybl|paytm|apl|ibl|upi|axl|hdfcbank|sbi|icici)\b/gi,
  amount: /(?:₹|rs\.?|inr)\s?[\d,]+(?:\.\d{1,2})?|\b[\d,]{3,}\s?(?:rupees|rs)\b/gi,
  qr: /\b(scan (?:this )?qr|qr code|collect request|payment request|upi (?:ref|reference|id)|merchant (?:vpa|id)|pay ₹|request money)\b/gi,
}

const URGENCY = [/\burgent\b/i, /\bimmediately\b/i, /within \d+\s?(min|hour|hrs?)/i, /\b(account|card|sim) (?:will be |is )?(blocked|suspended|deactivated|expired?)\b/i, /\blast (?:chance|warning|day)\b/i, /\bact now\b/i, /\bexpir(?:e|es|ing|ed)\b/i, /\bfailure to\b/i]
const IMPERSONATION = [/\b(sbi|hdfc|icici|axis|kotak|pnb|bank of baroda)\b/i, /\b(rbi|npci|income tax|gst|uidai|aadhaar)\b/i, /\b(paytm|phonepe|google ?pay|gpay|bhim|amazon|flipkart|netflix)\b/i, /\b(blue ?dart|dtdc|fedex|delhivery|india post|courier|customs)\b/i, /\b(customer (?:care|support)|official|verification team|help ?desk)\b/i]

function uniq(arr: string[]): string[] { return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean))) }

export function extractEntities(text: string): ExtractedEntities {
  const t = text || ''
  const urls = uniq((t.match(RE.url) ?? []).filter((u) => !/@/.test(u) && u.includes('.')))
  const phones = uniq((t.match(RE.phone) ?? []).map((p) => p.replace(/[\s-]/g, '')).filter((p) => p.replace(/\D/g, '').length >= 10 && p.replace(/\D/g, '').length <= 13))
  const shorteners = urls.filter((u) => RE.shortener.test(u))
  const matchAll = (re: RegExp) => uniq(t.match(re) ?? [])
  return {
    phones,
    urls,
    shorteners,
    upiIds: matchAll(RE.upi),
    amounts: matchAll(RE.amount),
    qrPaymentRefs: matchAll(RE.qr),
    urgencyMarkers: uniq(URGENCY.flatMap((re) => t.match(re) ?? [])),
    impersonationMarkers: uniq(IMPERSONATION.flatMap((re) => t.match(re) ?? [])),
  }
}

/** Count of risk-bearing entity classes — used to weight the risk score. */
export function entityRiskCount(e: ExtractedEntities): number {
  return (e.shorteners.length ? 1 : 0) + (e.upiIds.length ? 1 : 0) + (e.qrPaymentRefs.length ? 1 : 0) +
    (e.urgencyMarkers.length ? 1 : 0) + (e.impersonationMarkers.length ? 1 : 0) + (e.phones.length ? 1 : 0)
}
