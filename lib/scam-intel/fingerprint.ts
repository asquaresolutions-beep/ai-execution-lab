// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/fingerprint.ts
// Scam "fingerprints" — a stable campaign identity + a human-readable label
// for a scam, derived from its category, spoofed brand, dominant tactic, and
// structural wording skeleton. Two scams with the same fingerprint belong to
// the same campaign. Pure / deterministic (no Vertex cost). (goals 4, 5)
// ─────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto'
import type { ExtractedEntities } from './extract-entities'

export interface FingerprintInput {
  category: string                 // scam category (otp_fraud, upi_fraud, ...)
  text: string                     // OCR text
  entities: ExtractedEntities
  signals: string[]                // visual-signal ids that fired
}

export interface ScamFingerprint {
  fingerprint: string              // stable 16-hex campaign id
  label: string                    // human-readable, e.g. "Fake SBI KYC Suspension"
  brand: string | null             // dominant spoofed brand
  domainCore: string | null        // SLD of the primary URL (campaign anchor)
  tactics: string[]
  structureHash: string            // wording-skeleton hash (cross-brand variants)
}

const BRAND_CANON: Array<[RegExp, string]> = [
  [/\bsbi\b/i, 'SBI'], [/\bhdfc\b/i, 'HDFC'], [/\bicici\b/i, 'ICICI'], [/\baxis\b/i, 'Axis'],
  [/\bkotak\b/i, 'Kotak'], [/\bpnb\b/i, 'PNB'], [/\bpaytm\b/i, 'Paytm'], [/\bphonepe\b/i, 'PhonePe'],
  [/\bgoogle ?pay|gpay\b/i, 'Google Pay'], [/\bamazon\b/i, 'Amazon'], [/\bflipkart\b/i, 'Flipkart'],
  [/\bindia ?post\b/i, 'India Post'], [/\bblue ?dart\b/i, 'Blue Dart'], [/\bdtdc\b/i, 'DTDC'],
  [/\bfedex\b/i, 'FedEx'], [/\bdelhivery\b/i, 'Delhivery'], [/\brbi\b/i, 'RBI'], [/\buidai|aadhaar\b/i, 'UIDAI'],
]

function dominantBrand(text: string): string | null {
  for (const [re, name] of BRAND_CANON) if (re.test(text)) return name
  return null
}

function domainCore(entities: ExtractedEntities): string | null {
  const url = entities.urls[0]
  if (!url) return null
  const host = url.replace(/^h(xx|tt)ps?:\/\//i, '').replace(/\[\.\]/g, '.').split(/[/?#]/)[0].toLowerCase()
  const labels = host.split('.')
  return labels.length >= 2 ? labels[labels.length - 2] : host
}

// Wording skeleton: strip digits / urls / amounts / punctuation, keep the
// ordered set of meaningful tokens → groups same template across brands/amounts.
function structureHash(text: string): string {
  const skel = text.toLowerCase()
    .replace(/https?:\/\/\S+|h(xx|tt)ps?:\/\/\S+/g, ' ')
    .replace(/[₹$]|rs\.?|inr/gi, ' ')
    .replace(/\d+/g, ' ')
    .replace(/[^a-zऀ-ॿ\s]/g, ' ')
    .split(/\s+/).filter((w) => w.length > 2)
    .slice(0, 24).join(' ')
  return createHash('sha1').update(skel).digest('hex').slice(0, 12)
}

// Category → label template. {brand} filled when present.
const LABELS: Record<string, (brand: string | null, sig: string[]) => string> = {
  phishing: (b) => `Fake ${b ?? 'Bank'} KYC/Account Suspension`,
  otp_fraud: (b) => `${b ?? 'Bank'} OTP-Theft Scam`,
  upi_fraud: (_b, s) => s.includes('fake_payment') ? 'Refund QR Collection Scam' : 'UPI Refund Scam',
  courier_customs: () => 'Courier Customs Fee Scam',
  investment_fraud: () => "Investment 'Guaranteed Returns' Scam",
  fake_job: () => 'Work-From-Home Job Scam',
  lottery_prize: () => 'Lottery / Prize Win Scam',
  loan_scam: () => 'Instant Loan Scam',
  tech_support: (b) => `Fake ${b ?? ''} Customer-Support Scam`.replace('  ', ' '),
  romance: () => 'Romance / Relationship Scam',
}

export function fingerprint(input: FingerprintInput): ScamFingerprint {
  const brand = dominantBrand(input.text)
  const core = domainCore(input.entities)
  const struct = structureHash(input.text)
  const labeller = LABELS[input.category] || (() => 'Suspicious Message')
  let label = labeller(brand, input.signals)
  // Heuristic overrides for sharper labels.
  if (input.signals.includes('kyc_phish') && brand) label = `Fake ${brand} KYC Suspension`
  else if (input.signals.includes('fake_payment') && (input.entities.qrPaymentRefs.length || input.signals.includes('fake_payment'))) {
    if (/refund/i.test(input.text) && input.entities.qrPaymentRefs.length) label = 'Refund QR Collection Scam'
  }
  // Campaign id: same brand + domain + structure ⇒ same campaign.
  const fp = createHash('sha1').update(`${input.category}|${brand ?? ''}|${core ?? ''}|${struct}`).digest('hex').slice(0, 16)
  return { fingerprint: fp, label, brand, domainCore: core, tactics: input.signals, structureHash: struct }
}
