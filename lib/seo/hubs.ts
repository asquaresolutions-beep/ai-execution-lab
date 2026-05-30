// ─────────────────────────────────────────────────────────────────
// lib/seo/hubs.ts
// Authority-graph HUB pages: curated topical clusters that interlink the
// individual scam-type/facet pages. Hubs concentrate internal link equity
// and capture seasonal/event search spikes (festivals, elections, tax
// season). Deterministic data → static, free, evergreen-with-seasonality.
// ─────────────────────────────────────────────────────────────────

import { SCAM_TYPE_BY_ID, type ScamType } from './facets'

export type HubKind = 'seasonal' | 'event' | 'entity'

export interface ScamHub {
  id: string                 // slug → /scams/hub/<id>
  kind: HubKind
  title: string
  titleHi: string
  intro: string
  /** Scam-type ids most associated with this hub. */
  typeIds: string[]
  /** Months (1-12) when this hub peaks — used for freshness boosting. */
  peakMonths?: number[]
  relatedHubs?: string[]
}

export const HUBS: ScamHub[] = [
  {
    id: 'festival-scams', kind: 'seasonal',
    title: 'Festival Season Scams (Diwali, Holi & Sale Frauds)',
    titleHi: 'त्योहारी सीज़न के स्कैम (दिवाली, होली व सेल धोखाधड़ी)',
    intro: 'Festival sales and gifting spikes bring a surge of fake-offer, delivery, and cashback scams. Here are the patterns that peak around Diwali, Holi and big sale events.',
    typeIds: ['phishing', 'upi-fraud', 'courier-scam', 'lottery-scam'],
    peakMonths: [10, 11, 3], relatedHubs: ['online-shopping-scams', 'upi-payment-scams'],
  },
  {
    id: 'election-scams', kind: 'event',
    title: 'Election Season Scams (Fake Schemes & Donation Frauds)',
    titleHi: 'चुनावी सीज़न के स्कैम (फ़र्ज़ी योजनाएँ व चंदा धोखाधड़ी)',
    intro: 'Around elections, scammers exploit political messaging with fake government-scheme payouts, donation requests, and misinformation links. Verify before you click or pay.',
    typeIds: ['phishing', 'upi-fraud', 'lottery-scam'],
    relatedHubs: ['government-scheme-scams'],
  },
  {
    id: 'tax-season-scams', kind: 'seasonal',
    title: 'Tax Season Scams (Fake Refunds & Income-Tax Frauds)',
    titleHi: 'टैक्स सीज़न के स्कैम (फ़र्ज़ी रिफंड व इनकम-टैक्स धोखाधड़ी)',
    intro: 'Fake income-tax refund SMS and "verify PAN/Aadhaar" links spike near filing deadlines. The Income Tax Department never asks for OTPs or card details over SMS.',
    typeIds: ['phishing', 'kyc-fraud', 'otp-fraud'],
    peakMonths: [3, 4, 7], relatedHubs: ['kyc-aadhaar-scams'],
  },
  {
    id: 'upi-payment-scams', kind: 'entity',
    title: 'UPI & Digital Payment Scams in India',
    titleHi: 'UPI व डिजिटल भुगतान स्कैम',
    intro: 'Everything that targets UPI users — collect-request tricks, fake refunds, QR-code scams and autopay frauds — and exactly how to stay safe.',
    typeIds: ['upi-fraud', 'otp-fraud', 'phishing'],
  },
  {
    id: 'job-investment-scams', kind: 'entity',
    title: 'Job & Investment Scams (Tasks, Trading & Crypto)',
    titleHi: 'नौकरी व निवेश स्कैम (टास्क, ट्रेडिंग व क्रिप्टो)',
    intro: 'Work-from-home "task" scams and guaranteed-return investment frauds are among the costliest. Learn the upfront-fee and withdrawal-block red flags.',
    typeIds: ['fake-job', 'investment-fraud', 'loan-scam'],
  },
]

export const HUB_BY_ID = new Map(HUBS.map((h) => [h.id, h]))

export function hubTypes(hub: ScamHub): ScamType[] {
  return hub.typeIds.map((id) => SCAM_TYPE_BY_ID.get(id)).filter((t): t is ScamType => !!t)
}

/** Hubs currently "in season" (peak month within ±1 of now) → freshness boost. */
export function inSeasonHubs(now = new Date()): ScamHub[] {
  const m = now.getMonth() + 1
  return HUBS.filter((h) => h.peakMonths?.some((pm) => Math.abs(pm - m) <= 1 || Math.abs(pm - m) >= 11))
}

export function allHubIds(): string[] {
  return HUBS.map((h) => h.id)
}
